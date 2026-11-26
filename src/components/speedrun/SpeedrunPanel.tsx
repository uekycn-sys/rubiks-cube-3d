import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CubeEngine } from '../../engine/CubeEngine';
import { CubeState } from '../../core/cubeState';
import { PATTERNS, PatternConfig } from '../../data/levels';
import { soundManager } from '../../audio/SoundManager';
import { store } from '../../store/cubeStore';
import { solveCube } from '../../core/solverService';
import { LBL_STAGES, evaluateLblProgress, solveLBL } from '../../core/lblSolver';
import { LblProgressReport, SOLVED_FACELETS } from '../../core/types';

interface SpeedrunPanelProps {
  engine: CubeEngine | null;
  onAlignCamera: (view: any) => void;
}

export const SpeedrunPanel: React.FC<SpeedrunPanelProps> = ({ engine, onAlignCamera }) => {
  // Timer States
  const [timerStatus, setTimerStatus] = useState<'idle' | 'holding' | 'ready' | 'running' | 'stopped'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [scrambleString, setScrambleString] = useState<string>('');
  const [pbTimeMs, setPbTimeMs] = useState<number | null>(null);
  const [historyRecords, setHistoryRecords] = useState<number[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<string>('');
  const [isAiDemoRunning, setIsAiDemoRunning] = useState(false);
  const [lblProgress, setLblProgress] = useState<LblProgressReport>(() =>
    evaluateLblProgress(SOLVED_FACELETS)
  );
  const [lblHint, setLblHint] = useState<{
    stageName: string;
    formulaName: string;
    notation: string;
    mnemonic: string;
  } | null>(null);

  const timerStartTimeRef = useRef(0);
  const timerRafRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef(0);
  const aiDemoSessionRef = useRef(0);
  const isAiDemoRef = useRef(false);
  const pbTimeRef = useRef<number | null>(null);

  // Load PB & History from localStorage
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const savedPb = localStorage.getItem('cube_pb_ms');
      if (savedPb) {
        const parsed = parseInt(savedPb, 10);
        setPbTimeMs(parsed);
        pbTimeRef.current = parsed;
      }

      const savedHistory = localStorage.getItem('cube_timer_history');
      if (savedHistory) {
        try {
          setHistoryRecords(JSON.parse(savedHistory));
        } catch {
          // Ignore
        }
      }
    }
  }, []);

  // Format Milliseconds to MM:SS.CC
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((ms % 1000) / 10);

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${hundredths.toString().padStart(2, '0')}`;
  };

  // Stop Timer
  const stopTimer = useCallback(() => {
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current);
      timerRafRef.current = null;
    }
    setTimerStatus('stopped');

    const finalMs = performance.now() - timerStartTimeRef.current;
    setElapsedMs(finalMs);

    // Update PB & History
    if (typeof localStorage !== 'undefined') {
      const currentPb = pbTimeRef.current;
      if (!currentPb || finalMs < currentPb) {
        pbTimeRef.current = finalMs;
        setPbTimeMs(finalMs);
        localStorage.setItem('cube_pb_ms', String(finalMs));
      }

      setHistoryRecords((prev) => {
        const next = [finalMs, ...prev.slice(0, 4)];
        localStorage.setItem('cube_timer_history', JSON.stringify(next));
        return next;
      });
    }

    soundManager.playVictory();
  }, []);

  // Hook into engine move complete to update turn count, LBL progress and check solved
  useEffect(() => {
    if (!engine) return;

    setLblProgress(evaluateLblProgress(engine.getFacelets()));

    const originalCallback = engine.callbacks.onMoveComplete;
    engine.callbacks.onMoveComplete = (move, remaining) => {
      originalCallback?.(move, remaining);
      setLblProgress(evaluateLblProgress(engine.getFacelets()));
      if (isAiDemoRef.current) return;

      setTurnCount((prev) => prev + 1);
      setLblHint(null);

      // If timer is running and cube is solved, stop timer automatically
      if (timerStatus === 'running' && engine.isSolved()) {
        stopTimer();
      }
    };

    return () => {
      engine.callbacks.onMoveComplete = originalCallback;
    };
  }, [engine, timerStatus, stopTimer]);

  // Timer Animation Frame Loop
  const runTimerLoop = () => {
    setElapsedMs(performance.now() - timerStartTimeRef.current);
    timerRafRef.current = requestAnimationFrame(runTimerLoop);
  };

  // Spacebar timer handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (timerStatus === 'running') {
          stopTimer();
        } else if (timerStatus === 'idle' || timerStatus === 'stopped') {
          setTimerStatus('holding');
          holdStartTimeRef.current = performance.now();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (timerStatus === 'holding' || timerStatus === 'ready') {
          // If held long enough (>250ms), start running!
          const holdTime = performance.now() - holdStartTimeRef.current;
          if (holdTime > 250) {
            setTimerStatus('running');
            setTurnCount(0);
            timerStartTimeRef.current = performance.now();
            runTimerLoop();
          } else {
            setTimerStatus('idle');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    };
  }, [timerStatus, stopTimer]);

  // Generate and apply Scramble cleanly in 0ms
  const handleScramble = (length: number) => {
    if (!engine) return;
    aiDemoSessionRef.current++;
    isAiDemoRef.current = false;
    setIsAiDemoRunning(false);
    setSelectedPattern('');

    const moves = CubeState.generateScramble(length);
    setScrambleString(moves.join(' '));

    engine.applyMovesInstant(moves, true);
    setLblProgress(evaluateLblProgress(engine.getFacelets()));
    setLblHint(null);

    setElapsedMs(0);
    setTurnCount(0);
    setTimerStatus('idle');
  };

  // Apply Art Pattern cleanly in 0ms
  const handleApplyPattern = (pattern: PatternConfig) => {
    if (!engine) return;
    aiDemoSessionRef.current++;
    isAiDemoRef.current = false;
    setIsAiDemoRunning(false);

    setSelectedPattern(pattern.id);
    setScrambleString(pattern.moves.join(' '));

    engine.applyMovesInstant(pattern.moves, true);
    setLblProgress(evaluateLblProgress(engine.getFacelets()));
    setLblHint(null);

    setElapsedMs(0);
    setTurnCount(0);
    setTimerStatus('idle');
  };

  // Reset to solved
  const handleResetSolved = () => {
    if (!engine) return;
    aiDemoSessionRef.current++;
    isAiDemoRef.current = false;
    setIsAiDemoRunning(false);
    setSelectedPattern('');
    engine.applyMovesInstant([], true);
    setLblProgress(evaluateLblProgress(SOLVED_FACELETS));
    setLblHint(null);

    setElapsedMs(0);
    setTurnCount(0);
    setTimerStatus('idle');
    setScrambleString('');
  };

  // One-click AI Tutor call (uses preferred method: LBL or Kociemba)
  const handleCallAiTutor = async () => {
    if (!engine) return;
    aiDemoSessionRef.current++;
    isAiDemoRef.current = false;
    setIsAiDemoRunning(false);
    engine.cancelAnimations();

    const facelets = engine.getFacelets();
    try {
      const method = store.getState().solverMethod;
      if (method === 'lbl') {
        const lbl = solveLBL(facelets);
        store.setupTutor(facelets, lbl.moves, lbl, 'lbl');
      } else {
        const solution = await solveCube(facelets);
        store.setupTutor(facelets, solution, null, 'kociemba');
      }
      store.setState({ mode: 'tutor' });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Show contextual LBL hint for the current state
  const handleShowLblHint = () => {
    if (!engine) return;
    const facelets = engine.getFacelets();
    const sol = solveLBL(facelets);
    const chunk = sol.chunks[0];
    if (!chunk) {
      setLblHint(null);
      return;
    }
    const stageMeta = LBL_STAGES[chunk.stageId - 1];
    setLblHint({
      stageName: stageMeta.name,
      formulaName: chunk.formulaName,
      notation: chunk.formulaNotation,
      mnemonic: chunk.mnemonic,
    });
  };

  // One-click AI Dynamic Demo to restore cube
  const handleToggleAiDemo = async () => {
    if (!engine) return;

    if (isAiDemoRunning) {
      aiDemoSessionRef.current++;
      isAiDemoRef.current = false;
      setIsAiDemoRunning(false);
      engine.cancelAnimations();
      engine.hideTutorGuide();
      return;
    }

    const sessionId = ++aiDemoSessionRef.current;
    isAiDemoRef.current = true;
    setIsAiDemoRunning(true);

    try {
      const facelets = engine.getFacelets();
      const solution = await solveCube(facelets);

      for (let i = 0; i < solution.length; i++) {
        if (aiDemoSessionRef.current !== sessionId) break;
        const move = solution[i];
        engine.showTutorGuide(move);

        await engine.playMoveAsync(move, 280);

        if (aiDemoSessionRef.current !== sessionId) break;
        await new Promise((r) => setTimeout(r, 90));
      }
    } catch (err) {
      console.error(err);
    } finally {
      engine.hideTutorGuide();
      if (aiDemoSessionRef.current === sessionId) {
        isAiDemoRef.current = false;
        setIsAiDemoRunning(false);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      aiDemoSessionRef.current++;
      isAiDemoRef.current = false;
      engine?.cancelAnimations();
    };
  }, [engine]);

  // Calculate live TPS
  const currentSeconds = elapsedMs / 1000;
  const tps = currentSeconds > 0 ? (turnCount / currentSeconds).toFixed(2) : '0.00';

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* Top Header: Timer Display */}
      <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-inner">
        {/* Big Timer */}
        <div
          className={`font-mono font-black text-4xl sm:text-5xl tracking-wider transition-colors duration-200 ${
            timerStatus === 'holding'
              ? 'text-amber-400 animate-pulse'
              : timerStatus === 'ready'
              ? 'text-emerald-400 scale-105'
              : timerStatus === 'running'
              ? 'text-sky-300'
              : 'text-white'
          }`}
        >
          {formatTime(elapsedMs)}
        </div>

        {/* Status Hint */}
        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
          <span>
            {timerStatus === 'running'
              ? '⏱️ 计时中... (按空格或点击停止)'
              : timerStatus === 'holding'
              ? '长按空格准备中...'
              : '长按空格 0.3s 启动计时器'}
          </span>

          <div className="h-3 w-px bg-slate-700" />

          <span className="font-mono text-sky-400">
            步数: {turnCount}
          </span>

          <div className="h-3 w-px bg-slate-700" />

          <span className="font-mono text-emerald-400">
            TPS: {tps}
          </span>
        </div>
      </div>

      {/* Scramble Display if any */}
      {scrambleString && (
        <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between gap-2">
          <div className="overflow-x-auto font-mono text-slate-300 whitespace-nowrap text-[11px]">
            {scrambleString}
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(scrambleString)}
            className="text-[10px] text-sky-400 hover:text-sky-300 shrink-0 px-1.5 py-0.5 rounded bg-sky-500/10"
          >
            复制
          </button>
        </div>
      )}

      {/* Action Row 1: Scramble Buttons */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <button
          type="button"
          onClick={() => handleScramble(6)}
          className="py-2.5 px-2 rounded-xl glass-button text-slate-200 font-semibold hover:text-white flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <span>🌱</span>
          <span>入门(6步)</span>
        </button>

        <button
          type="button"
          onClick={() => handleScramble(12)}
          className="py-2.5 px-2 rounded-xl glass-button text-slate-200 font-semibold hover:text-white flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <span>⚡</span>
          <span>标准(12步)</span>
        </button>

        <button
          type="button"
          onClick={() => handleScramble(20)}
          className="py-2.5 px-2 rounded-xl glass-button text-sky-300 font-bold hover:text-white flex items-center justify-center gap-1 border-sky-500/30 whitespace-nowrap cursor-pointer"
        >
          <span>🏆</span>
          <span>WCA(20步)</span>
        </button>
      </div>

      {/* Action Row 2: World-Class Art Patterns */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80 text-xs">
        <div className="text-[11px] text-slate-400 font-medium">
          一键生成艺术花式图案：
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {PATTERNS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPattern(p)}
              className={`px-2.5 py-1.5 rounded-lg shrink-0 font-medium text-[11px] transition-all cursor-pointer ${
                selectedPattern === p.id
                  ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {p.nameZh}
            </button>
          ))}
        </div>
      </div>

      {/* Live LBL 7-Stage Progress & Contextual Hint */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
          <span>层先法实时进度 ({lblProgress.completedCount}/7)</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShowLblHint}
              disabled={lblProgress.isSolved}
              className="text-sky-300 hover:text-white font-semibold disabled:opacity-40 cursor-pointer"
            >
              🎓 层先法提示
            </button>
            <span className="text-slate-700">|</span>
            <button
              type="button"
              onClick={() => {
                if (!engine) return;
                store.startLearnWithFacelets(engine.getFacelets());
              }}
              className="text-emerald-300 hover:text-white font-semibold cursor-pointer"
            >
              🖐️ 亲手带练
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {LBL_STAGES.map((st, idx) => {
            const done = lblProgress.completedStages[idx];
            const active = !lblProgress.isSolved && lblProgress.currentStage === st.id;
            return (
              <div
                key={st.id}
                className={`py-0.5 rounded-md text-center text-[9px] font-semibold truncate border ${
                  done
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : active
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                    : 'bg-slate-900/80 border-slate-800 text-slate-500'
                }`}
              >
                {done ? `✓${st.shortName}` : st.shortName}
              </div>
            );
          })}
        </div>

        {lblHint && (
          <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-400/30 text-[11px] flex flex-col gap-0.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-300">{lblHint.stageName}</span>
              <span className="font-mono text-white font-bold">{lblHint.notation}</span>
            </div>
            <div className="text-emerald-300">
              {lblHint.formulaName}：{lblHint.mnemonic}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Quick Controls, Reset, AI Tutor */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetSolved}
            className="px-3 py-1.5 rounded-lg glass-button text-slate-300 hover:text-white"
          >
            重置还原
          </button>

          <button
            type="button"
            onClick={() => onAlignCamera('HOME')}
            className="px-2.5 py-1.5 rounded-lg glass-button text-sky-300 cursor-pointer"
            title="一键回正标准白顶绿前视角"
          >
            回正 🏠
          </button>
        </div>

        {/* Personal Best & History Capsule */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {pbTimeMs && (
            <div className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/30">
              <span>PB:</span>
              <span className="font-bold">{formatTime(pbTimeMs)}</span>
            </div>
          )}
          {historyRecords.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-slate-400 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800 text-[10px]">
              <span>历史:</span>
              <span>{historyRecords.slice(0, 3).map((r) => formatTime(r)).join(' | ')}</span>
            </div>
          )}
        </div>

        {/* Actions: AI Demo & AI Tutor */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleAiDemo}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
              isAiDemoRunning
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                : 'glass-button text-sky-300 hover:text-white border-sky-500/40'
            }`}
          >
            {isAiDemoRunning ? '⏸ 暂停' : '▶ 演示复原'}
          </button>

          <button
            type="button"
            onClick={handleCallAiTutor}
            disabled={isAiDemoRunning}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 text-slate-950 font-bold text-xs shadow-md hover:brightness-110 cursor-pointer"
          >
            ✨ AI 教学
          </button>
        </div>
      </div>
    </div>
  );
};
