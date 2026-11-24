import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LevelConfig, LEVELS } from '../../data/levels';
import { CubeEngine } from '../../engine/CubeEngine';
import { solveCube } from '../../core/solverService';
import { translateMove } from '../../core/moveTranslator';
import { soundManager } from '../../audio/SoundManager';
import { store } from '../../store/cubeStore';
import confetti from 'canvas-confetti';

interface LevelPlayOverlayProps {
  level: LevelConfig;
  engine: CubeEngine | null;
  onExitLevels: () => void;
  onNextLevel: (nextLevel: LevelConfig) => void;
}

export const LevelPlayOverlay: React.FC<LevelPlayOverlayProps> = ({
  level,
  engine,
  onExitLevels,
  onNextLevel,
}) => {
  const [stepCount, setStepCount] = useState(0);
  const [remainingTime, setRemainingTime] = useState<number | null>(level.maxSeconds || null);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [earnedStars, setEarnedStars] = useState(0);

  const startTimeRef = useRef(performance.now());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Victory Handler
  const handleVictory = useCallback(() => {
    if (isVictory) return;
    setIsVictory(true);

    const elapsedSeconds = Math.round((performance.now() - startTimeRef.current) / 1000);

    // Calculate stars
    let stars = 1;
    if (level.type === 'step_limit' && level.maxSteps) {
      stars = stepCount <= level.maxSteps ? 3 : 2;
    } else if (level.type === 'time_limit' && level.maxSeconds) {
      stars = elapsedSeconds <= level.maxSeconds / 2 ? 3 : 2;
    } else {
      stars = stepCount <= (level.maxSteps || 15) ? 3 : 2;
    }
    setEarnedStars(stars);

    // Persist stars & unlock next level
    if (typeof localStorage !== 'undefined') {
      const currentSaved = parseInt(localStorage.getItem(`level_stars_${level.id}`) || '0', 10);
      localStorage.setItem(`level_stars_${level.id}`, String(Math.max(currentSaved, stars)));

      const currentUnlocked = parseInt(localStorage.getItem('cube_unlocked_levels') || '1', 10);
      const nextUnlocked = Math.max(currentUnlocked, level.id + 1);
      localStorage.setItem('cube_unlocked_levels', String(nextUnlocked));
      store.setState({ unlockedLevels: nextUnlocked });
    }

    soundManager.playVictory();
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch {
      // Ignore
    }
  }, [isVictory, level, stepCount]);

  // Load level and apply scramble
  const loadLevelScramble = useCallback(() => {
    if (!engine) return;

    engine.setStateFromFacelets('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    for (const m of level.scramble) {
      engine.applyMove(m, 100); // Instant setup
    }

    setStepCount(0);
    setRemainingTime(level.maxSeconds || null);
    setIsVictory(false);
    setIsFailed(false);
    setAiHint(null);
    startTimeRef.current = performance.now();
  }, [engine, level]);

  useEffect(() => {
    loadLevelScramble();
  }, [loadLevelScramble]);

  // Countdown timer for time_limit levels
  useEffect(() => {
    if (level.type !== 'time_limit' || isVictory || isFailed) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setIsFailed(true);
          soundManager.playError();
          clearInterval(timerIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [level, isVictory, isFailed]);

  // Hook into engine move complete to update step count and check victory
  useEffect(() => {
    if (!engine) return;

    const originalCallback = engine.callbacks.onMoveComplete;
    engine.callbacks.onMoveComplete = (move, remaining) => {
      originalCallback?.(move, remaining);

      setStepCount((prev) => {
        const next = prev + 1;
        // Check step limit failure
        if (level.type === 'step_limit' && level.maxSteps && next > level.maxSteps) {
          setIsFailed(true);
          soundManager.playError();
        }
        return next;
      });

      // Clear AI hint on move
      setAiHint(null);

      // Check if cube is solved
      if (engine.isSolved()) {
        handleVictory();
      }
    };

    return () => {
      engine.callbacks.onMoveComplete = originalCallback;
    };
  }, [engine, level, handleVictory]);

  // AI Hint Generator
  const handleGetAiHint = async () => {
    if (!engine || isAiThinking || isVictory) return;
    setIsAiThinking(true);

    try {
      const facelets = engine.getFacelets();
      const solution = await solveCube(facelets);
      if (solution.length > 0) {
        const nextMove = solution[0];
        const instruction = translateMove(nextMove);
        setAiHint(`建议执行: ${nextMove}（${instruction.title}）`);
      } else {
        setAiHint('魔方已处于还原状态！');
      }
    } catch {
      setAiHint('AI 运算受阻，请检查当前状态');
    } finally {
      setIsAiThinking(false);
    }
  };

  // Switch to AI Tutor Mode for this level
  const handleSwitchToAiTutor = async () => {
    if (!engine) return;
    const facelets = engine.getFacelets();
    try {
      const solution = await solveCube(facelets);
      store.setupTutor(facelets, solution);
      store.setState({ mode: 'tutor' });
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <>
      {/* Top Level Info HUD */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-xl w-full px-4 pointer-events-auto select-none">
        <div className="w-full glass-panel rounded-2xl p-3 sm:p-4 shadow-2xl border border-sky-500/25 flex flex-col gap-2">
          {/* Top Line: Title & Counters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-xs font-bold border border-sky-400/30">
                Lv.{level.id}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {level.title}
              </h2>
            </div>

            {/* Counters */}
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1 text-slate-300">
                <span className="text-slate-500 font-sans">步数:</span>
                <span
                  className={`font-bold ${
                    level.maxSteps && stepCount > level.maxSteps
                      ? 'text-rose-400 font-bold animate-pulse'
                      : 'text-sky-300'
                  }`}
                >
                  {stepCount}
                  {level.maxSteps && ` / ${level.maxSteps}`}
                </span>
              </div>

              {remainingTime !== null && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-sans">倒计时:</span>
                  <span
                    className={`font-bold ${
                      remainingTime <= 10 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
                    }`}
                  >
                    {remainingTime}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description & Hint Line */}
          <p className="text-xs text-slate-300 leading-relaxed">
            {level.description}
          </p>

          {/* AI Hint Box if active */}
          {aiHint && (
            <div className="px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-400/40 text-sky-200 text-xs flex items-center gap-2 animate-fade-in">
              <span>💡</span>
              <span className="font-semibold">{aiHint}</span>
            </div>
          )}

          {/* Action Tools */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGetAiHint}
                disabled={isAiThinking}
                className="px-2.5 py-1 rounded-lg glass-button text-sky-300 hover:text-white flex items-center gap-1 text-xs"
              >
                <span>💡</span>
                <span>{isAiThinking ? '思考中...' : 'AI 提示下一步'}</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToAiTutor}
                className="px-2.5 py-1 rounded-lg glass-button text-emerald-300 hover:text-white flex items-center gap-1 text-xs"
              >
                <span>🎓</span>
                <span>切换 AI 教学</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadLevelScramble}
                className="px-2.5 py-1 rounded-lg glass-button text-slate-300 hover:text-white text-xs"
              >
                🔁 重置本关
              </button>

              <button
                type="button"
                onClick={onExitLevels}
                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 text-xs"
              >
                关卡列表 📋
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Victory Dialog */}
      {isVictory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-sm p-6 rounded-3xl glass-panel border border-sky-400/40 shadow-2xl flex flex-col items-center text-center">
            <div className="text-4xl mb-2 animate-bounce">🏆</div>
            <h3 className="text-lg font-bold text-white mb-1">
              挑战成功！第 {level.id} 关圆满达成！
            </h3>

            {/* Stars */}
            <div className="flex items-center gap-1.5 text-2xl text-amber-400 my-3">
              {'★'.repeat(earnedStars)}
              {'☆'.repeat(3 - earnedStars)}
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              您累计耗费了 <strong className="text-sky-300 font-mono">{stepCount}</strong> 步！
              {earnedStars === 3 ? '完美达成三星评定！' : '表现优异！'}
            </p>

            <div className="flex flex-col gap-2 w-full">
              {level.id < LEVELS.length && (
                <button
                  type="button"
                  onClick={() => {
                    const next = LEVELS.find((l) => l.id === level.id + 1);
                    if (next) onNextLevel(next);
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-bold text-xs tracking-wider shadow-lg hover:brightness-110 cursor-pointer"
                >
                  继续挑战下一关 ➡️
                </button>
              )}

              <button
                type="button"
                onClick={onExitLevels}
                className="w-full py-2.5 rounded-xl glass-button text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                返回关卡选择
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failure Dialog */}
      {isFailed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-sm p-6 rounded-3xl glass-panel border border-rose-500/40 shadow-2xl flex flex-col items-center text-center">
            <div className="text-3xl mb-2">⏱️</div>
            <h3 className="text-lg font-bold text-rose-300 mb-1">
              挑战失败
            </h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              {level.type === 'step_limit'
                ? `已超过关卡最大步数限制（${level.maxSteps} 步）`
                : '倒计时已耗尽！'}
            </p>

            <div className="flex flex-col gap-2 w-full">
              <button
                type="button"
                onClick={loadLevelScramble}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg cursor-pointer"
              >
                🔁 重新开始本关
              </button>

              <button
                type="button"
                onClick={onExitLevels}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-white text-xs"
              >
                返回关卡列表
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
