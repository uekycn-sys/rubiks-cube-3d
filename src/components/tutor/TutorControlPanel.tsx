import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCubeStore } from '../../store/useCubeStore';
import { store } from '../../store/cubeStore';
import { CubeEngine } from '../../engine/CubeEngine';
import { CubeState } from '../../core/cubeState';
import { solveCube } from '../../core/solverService';
import { LBL_STAGES, solveLBL } from '../../core/lblSolver';
import { LblStageId, SolverMethod } from '../../core/types';
import { TutorCompletionModal } from './TutorCompletionModal';

interface TutorControlPanelProps {
  engine: CubeEngine | null;
  onExitTutor: () => void;
  onGoToLevels: () => void;
}

export const TutorControlPanel: React.FC<TutorControlPanelProps> = ({
  engine,
  onExitTutor,
  onGoToLevels,
}) => {
  const {
    solverMethod,
    lblSolution,
    initialTutorFacelets,
    solutionMoves,
    instructions,
    currentStepIndex,
    historyFacelets,
    autoPlayInterval,
    playbackSpeed,
    isTutorFinished,
  } = useCubeStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [activePlayType, setActivePlayType] = useState<'continuous' | 'followAlong'>('continuous');
  const [isExecutingSingleMove, setIsExecutingSingleMove] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  // Playback Session Lock & Version Token (prevents React closure race conditions)
  const playSessionIdRef = useRef(0);
  const isPlayingRef = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseResolverRef = useRef<(() => void) | null>(null);

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const capsuleRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const totalSteps = solutionMoves.length;
  const currentInstruction = instructions[currentStepIndex];

  // Abortable sleep helper for follow-along pauses
  const waitAbortable = (ms: number) =>
    new Promise<void>((resolve) => {
      pauseResolverRef.current = resolve;
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        pauseResolverRef.current = null;
        resolve();
      }, ms);
    });

  // 1. Align 3D guide arrow to current step
  useEffect(() => {
    if (!engine) return;

    if (currentStepIndex < totalSteps && !isTutorFinished) {
      const step = solutionMoves[currentStepIndex];
      engine.showTutorGuide(step);
    } else {
      engine.hideTutorGuide();
    }
  }, [engine, currentStepIndex, totalSteps, solutionMoves, isTutorFinished]);

  // 2. Center active step capsule in timeline
  useEffect(() => {
    const activeEl = capsuleRefs.current[currentStepIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentStepIndex]);

  // 3. Stop playback safely & clear pending wait timers immediately
  const stopPlayback = useCallback(() => {
    playSessionIdRef.current++;
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (pauseResolverRef.current) {
      const resolve = pauseResolverRef.current;
      pauseResolverRef.current = null;
      resolve();
    }
    engine?.cancelAnimations();
  }, [engine]);

  // 4. Start playback loop with guaranteed async landing
  const startPlayback = useCallback(
    async (type: 'continuous' | 'followAlong') => {
      if (!engine) return;

      // If already at end or finished, rewind to step 0 to replay
      if (store.getState().currentStepIndex >= totalSteps) {
        store.setState({ currentStepIndex: 0, isTutorFinished: false });
        const initFacelets = store.getState().historyFacelets[0];
        engine.setStateFromFacelets(initFacelets);
        await new Promise((r) => setTimeout(r, 80));
      }

      const sessionId = ++playSessionIdRef.current;
      isPlayingRef.current = true;
      setIsPlaying(true);
      setActivePlayType(type);

      while (isPlayingRef.current && playSessionIdRef.current === sessionId) {
        const latestIdx = store.getState().currentStepIndex;
        const moves = store.getState().solutionMoves;

        if (latestIdx >= moves.length) {
          store.setState({ isTutorFinished: true });
          break;
        }

        const move = moves[latestIdx];
        const currentSpeed = store.getState().playbackSpeed || 1.0;
        const waitInterval = store.getState().autoPlayInterval || 1500;

        // Show 3D guide arrow for current step
        engine.showTutorGuide(move);

        // Turn duration dynamically computed by speed
        // 0.5x -> 750ms, 1.0x -> 380ms, 2.0x -> 200ms, 4.0x -> 100ms
        const turnDuration = Math.max(80, Math.round(380 / currentSpeed));

        // Await full 3D rotation landing & orthogonal snap
        await engine.playMoveAsync(move, turnDuration);

        // Check if user clicked pause/stop during move execution
        if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) {
          break;
        }

        const nextIdx = latestIdx + 1;
        store.setState({ currentStepIndex: nextIdx });

        if (nextIdx >= moves.length) {
          store.setState({ isTutorFinished: true });
          break;
        }

        // Pause before next step (abortable immediately on Pause)
        const pauseMs = type === 'continuous' ? 120 : waitInterval;
        if (pauseMs > 0) {
          await waitAbortable(pauseMs);
        }
      }

      if (playSessionIdRef.current === sessionId) {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    },
    [engine, totalSteps]
  );

  // Toggle playback mode
  const handleTogglePlay = (type: 'continuous' | 'followAlong') => {
    if (isPlaying && activePlayType === type) {
      stopPlayback();
    } else {
      stopPlayback();
      setTimeout(() => startPlayback(type), 30);
    }
  };

  // 5. Handle Single Step Forward
  const handleNextStep = useCallback(async () => {
    if (!engine || isExecutingSingleMove || currentStepIndex >= totalSteps) return;
    stopPlayback();

    setIsExecutingSingleMove(true);
    const move = solutionMoves[currentStepIndex];
    const currentSpeed = store.getState().playbackSpeed || 1.0;
    const turnDuration = Math.max(80, Math.round(380 / currentSpeed));

    await engine.playMoveAsync(move, turnDuration);

    const nextIndex = currentStepIndex + 1;
    store.setState({ currentStepIndex: nextIndex });
    setIsExecutingSingleMove(false);

    if (nextIndex >= totalSteps) {
      store.setState({ isTutorFinished: true });
    }
  }, [engine, isExecutingSingleMove, currentStepIndex, totalSteps, solutionMoves, stopPlayback]);

  // 6. Handle Step Backward
  const handlePrevStep = useCallback(() => {
    if (!engine || isExecutingSingleMove || currentStepIndex <= 0) return;
    stopPlayback();

    const prevIndex = currentStepIndex - 1;
    const targetFacelets = historyFacelets[prevIndex];

    engine.setStateFromFacelets(targetFacelets);
    store.setState({
      currentStepIndex: prevIndex,
      isTutorFinished: false,
    });
  }, [engine, isExecutingSingleMove, currentStepIndex, historyFacelets, stopPlayback]);

  // 7. Handle Replay Current Step
  const handleReplayCurrentStep = useCallback(async () => {
    if (!engine || isExecutingSingleMove || currentStepIndex >= totalSteps) return;
    stopPlayback();

    setIsExecutingSingleMove(true);
    engine.hideTutorGuide();

    // Reset state to pre-step
    const preFacelets = historyFacelets[currentStepIndex];
    engine.setStateFromFacelets(preFacelets);

    // Slow demonstration
    const move = solutionMoves[currentStepIndex];
    await engine.playMoveAsync(move, 600);

    setIsExecutingSingleMove(false);
  }, [engine, isExecutingSingleMove, currentStepIndex, totalSteps, historyFacelets, solutionMoves, stopPlayback]);

  // 8. Handle Jump directly to any step
  const handleJumpToStep = (index: number) => {
    if (!engine || isExecutingSingleMove || index < 0 || index > totalSteps) return;
    stopPlayback();

    const targetFacelets = historyFacelets[index];
    engine.setStateFromFacelets(targetFacelets);
    store.setState({
      currentStepIndex: index,
      isTutorFinished: index === totalSteps,
    });
  };

  // 9. Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay('continuous');
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextStep();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStep();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleReplayCurrentStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStep, handlePrevStep, handleReplayCurrentStep, isPlaying, activePlayType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playSessionIdRef.current++;
      isPlayingRef.current = false;
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      if (pauseResolverRef.current) pauseResolverRef.current();
      engine?.cancelAnimations();
    };
  }, [engine]);

  // Quick-launch AI Tutor with a fresh 20-move scramble when no puzzle is loaded
  const handleStartSampleTutor = async (methodOverride?: SolverMethod) => {
    if (isGeneratingDemo) return;
    setIsGeneratingDemo(true);
    try {
      const targetMethod = methodOverride ?? solverMethod;
      const scramble = CubeState.generateScramble(20);
      const sim = new CubeState();
      sim.applyMoves(scramble);
      const facelets = sim.getFacelets();
      if (targetMethod === 'lbl') {
        const lbl = solveLBL(facelets);
        store.setupTutor(facelets, lbl.moves, lbl, 'lbl');
      } else {
        const solution = await solveCube(facelets);
        store.setupTutor(facelets, solution, null, 'kociemba');
      }
    } catch (err) {
      console.error('Failed to generate sample tutor:', err);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  // Switch between LBL (7-stage human method) and Kociemba (~20-move AI optimal)
  const handleSwitchMethod = async (nextMethod: SolverMethod) => {
    if (nextMethod === solverMethod || isGeneratingDemo) return;
    stopPlayback();
    setIsGeneratingDemo(true);
    try {
      if (nextMethod === 'lbl') {
        const lbl = solveLBL(initialTutorFacelets);
        store.setupTutor(initialTutorFacelets, lbl.moves, lbl, 'lbl');
      } else {
        const solution = await solveCube(initialTutorFacelets);
        store.setupTutor(initialTutorFacelets, solution, null, 'kociemba');
      }
      engine?.setStateFromFacelets(initialTutorFacelets);
    } catch (err) {
      console.error('Failed to switch solver method:', err);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  if (totalSteps === 0 && !isTutorFinished) {
    return (
      <div className="flex flex-col gap-4 w-full select-none p-2">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/50 p-5 border border-sky-400/30 text-center flex flex-col items-center gap-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-2xl">
            ✨
          </div>
          <h3 className="text-base font-bold text-white">AI 分步慢速教学引擎</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            支持用「层先法（7阶段口诀，看完就能学会）」或「Kociemba 极速最优解（约20步）」分步慢速演示，并配 3D 亮青箭头手把手指导。
          </p>
          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              type="button"
              onClick={() => handleStartSampleTutor('lbl')}
              disabled={isGeneratingDemo}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
            >
              {isGeneratingDemo ? '正在生成教程...' : '🎓 生成 20 步打乱，看「层先法」完整教学'}
            </button>
            <button
              type="button"
              onClick={() => handleStartSampleTutor('kociemba')}
              disabled={isGeneratingDemo}
              className="w-full py-2.5 px-4 rounded-xl glass-button text-sky-300 hover:text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              ⚡ 体验 Kociemba AI 极速最优解 (~20步)
            </button>
            <button
              type="button"
              onClick={() => store.setState({ mode: 'learn' })}
              className="w-full py-2.5 px-4 rounded-xl glass-button text-emerald-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              🖐️ 去「层先法学院」亲手带练
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 w-full select-none">
        {/* Top Header: Step Counter & Reset Camera */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 font-mono text-xs font-bold border border-sky-400/30">
              第 {Math.min(currentStepIndex + 1, totalSteps)} / {totalSteps} 步
            </span>
            <span className="text-xs text-slate-400 font-medium">
              剩余 {Math.max(0, totalSteps - currentStepIndex)} 步
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => engine?.alignCamera('HOME')}
              className="px-2.5 py-1 rounded-lg glass-button text-xs text-sky-300 font-medium flex items-center gap-1 shadow-sm cursor-pointer"
              title="一键回正白顶绿前红右标准双手持视角"
            >
              <span>🧭</span>
              <span>回正视角</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopPlayback();
                onExitTutor();
              }}
              className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all cursor-pointer"
            >
              退出教学
            </button>
          </div>
        </div>

        {/* Method Switcher (LBL vs Kociemba) & Hand-On Practice CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleSwitchMethod('lbl')}
              disabled={isGeneratingDemo}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                solverMethod === 'lbl'
                  ? 'bg-gradient-to-r from-sky-500 to-emerald-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎓 层先法教学
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMethod('kociemba')}
              disabled={isGeneratingDemo}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                solverMethod === 'kociemba'
                  ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ 最优解 (~20步)
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              stopPlayback();
              const currentFacelets = historyFacelets[currentStepIndex] || initialTutorFacelets;
              store.startLearnWithFacelets(currentFacelets);
            }}
            className="px-2.5 py-1.5 rounded-xl glass-button text-emerald-300 hover:text-white text-[11px] font-bold border-emerald-500/30 cursor-pointer"
            title="停在当前画面，切换到层先法学院由你自己亲手拧完"
          >
            🖐️ 亲手跟练此局
          </button>
        </div>

        {/* 7-Stage Quick Jump Pills when LBL is active */}
        {solverMethod === 'lbl' && lblSolution && (
          <div className="grid grid-cols-7 gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            {LBL_STAGES.map((stage) => {
              const startIdx = lblSolution.stageStartIndices[stage.id as LblStageId];
              const isAvailable = startIdx !== undefined;
              const isActiveStage = currentInstruction?.stageId === stage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => {
                    if (startIdx !== undefined) handleJumpToStep(startIdx);
                  }}
                  title={isAvailable ? `跳到 ${stage.name}` : `${stage.shortName}（初始已完成）`}
                  className={`py-1 px-0.5 rounded-lg text-[10px] font-semibold transition-all truncate ${
                    isActiveStage
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm cursor-pointer'
                      : isAvailable
                      ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer'
                      : 'bg-emerald-500/15 text-emerald-400/80 cursor-default'
                  }`}
                >
                  {isAvailable ? `${stage.id}.${stage.shortName}` : `✓${stage.shortName}`}
                </button>
              );
            })}
          </div>
        )}

        {/* Current Gesture Guide Card */}
        {currentInstruction && currentStepIndex < totalSteps ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-3.5 sm:p-4 border border-sky-400/30 shadow-inner">
            {currentInstruction.stageTitle && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2.5 border-b border-slate-800/80">
                <span className="text-[11px] font-bold text-sky-300">
                  {currentInstruction.stageTitle}
                </span>
                {currentInstruction.formulaName && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                    {currentInstruction.formulaName}
                    {currentInstruction.chunkLength
                      ? ` (${(currentInstruction.stepInChunk ?? 0) + 1}/${currentInstruction.chunkLength})`
                      : ''}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-start gap-3.5 sm:gap-4">
              {/* Giant Formula Badge */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-slate-950 font-black text-3xl sm:text-4xl flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.5)] shrink-0 font-mono">
                {currentInstruction.move}
              </div>

              {/* Gesture Instructions */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white mb-1 tracking-wide">
                  {currentInstruction.title}
                </h3>
                <div className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>手法要领：{currentInstruction.gesture}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentInstruction.explanation}
                </p>
              </div>
            </div>

            {(currentInstruction.mnemonic || currentInstruction.recognitionTip) && (
              <div className="mt-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] flex flex-col gap-0.5">
                {currentInstruction.recognitionTip && (
                  <div className="text-amber-300">👀 {currentInstruction.recognitionTip}</div>
                )}
                {currentInstruction.mnemonic && (
                  <div className="text-emerald-300">🎵 口诀：{currentInstruction.mnemonic}</div>
                )}
              </div>
            )}

            {/* Visual Guide Hint */}
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-sky-300">
                <span>💡 指引：</span>
                <span>请看 3D 霓虹亮青发光外层与双向弧形箭头跟随转动</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-center">
            <div className="text-2xl mb-1">🎉</div>
            <div className="font-bold text-emerald-300 text-sm">
              所有步骤演示完毕！手中魔方已成功复原！
            </div>
          </div>
        )}

        {/* Dual Primary Continuous / Follow-along Playback Modes */}
        <div className="grid grid-cols-2 gap-2">
          {/* Continuous Demo CTA */}
          <button
            type="button"
            onClick={() => handleTogglePlay('continuous')}
            className={`py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              isPlaying && activePlayType === 'continuous'
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 hover:shadow-[0_0_20px_rgba(56,189,248,0.4)]'
            }`}
          >
            <span>{isPlaying && activePlayType === 'continuous' ? '⏸ 暂停演示' : '▶ 一键动态演示通关'}</span>
          </button>

          {/* Follow-along Practice CTA */}
          <button
            type="button"
            onClick={() => handleTogglePlay('followAlong')}
            className={`py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              isPlaying && activePlayType === 'followAlong'
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                : 'bg-slate-800 text-emerald-300 border border-emerald-500/40 hover:bg-slate-700/80'
            }`}
          >
            <span>{isPlaying && activePlayType === 'followAlong' ? '⏸ 暂停跟练' : '⏱ 自动跟练模式'}</span>
          </button>
        </div>

        {/* Secondary Stepping Controls & Speeds */}
        <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 shadow-inner">
          {/* Step Back / Replay / Step Next row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStepIndex <= 0 || isExecutingSingleMove}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 glass-button ${
                currentStepIndex <= 0
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-slate-200 hover:text-white cursor-pointer active:scale-95'
              }`}
              title="回退到上一步 (快捷键 ←)"
            >
              <span>⏮ 上一步</span>
            </button>

            <button
              type="button"
              onClick={handleReplayCurrentStep}
              disabled={isExecutingSingleMove || currentStepIndex >= totalSteps}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 glass-button ${
                currentStepIndex >= totalSteps
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-sky-300 hover:text-sky-200 cursor-pointer active:scale-95'
              }`}
              title="重看当前步 (快捷键 R)"
            >
              <span>🔁 重看当前步</span>
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              disabled={isExecutingSingleMove || currentStepIndex >= totalSteps}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 glass-button ${
                currentStepIndex >= totalSteps
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-emerald-300 hover:text-emerald-200 cursor-pointer active:scale-95'
              }`}
              title="单步下一步 (快捷键 →)"
            >
              <span>单步执行 ⏭</span>
            </button>
          </div>

          {/* 4-Speed Settings & Follow-along Interval */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
            {/* Speed Selector (4 speeds: 0.5x, 1x, 2x, 4x) */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px]">倍速:</span>
              {[
                { label: '0.5x', speed: 0.5 },
                { label: '1x', speed: 1.0 },
                { label: '2x', speed: 2.0 },
                { label: '4x', speed: 4.0 },
              ].map((s) => (
                <button
                  key={s.speed}
                  type="button"
                  onClick={() => store.setState({ playbackSpeed: s.speed })}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    playbackSpeed === s.speed
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Follow-along interval selector (1.5s, 3s, 5s) */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[11px]">跟练停顿:</span>
              {[
                { label: '1.5s', ms: 1500 },
                { label: '3s', ms: 3000 },
                { label: '5s', ms: 5000 },
              ].map((item) => (
                <button
                  key={item.ms}
                  type="button"
                  onClick={() => store.setState({ autoPlayInterval: item.ms })}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    autoPlayInterval === item.ms
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step Capsules Timeline (Auto-scrolls to center on every move) */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>解法步骤胶囊条：</span>
              <span className="text-sky-300 font-mono">共 {totalSteps} 步</span>
            </span>
            <span className="text-slate-500 font-sans text-[10px]">
              点击任意胶囊快速跳转
            </span>
          </div>

          <div
            ref={timelineScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scroll-smooth no-scrollbar"
          >
            {instructions.map((inst, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <button
                  key={idx}
                  ref={(el) => (capsuleRefs.current[idx] = el)}
                  type="button"
                  onClick={() => handleJumpToStep(idx)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold shrink-0 transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                    isCurrent
                      ? 'bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 ring-2 ring-sky-300 scale-105 shadow-[0_0_15px_rgba(56,189,248,0.7)] font-black'
                      : isPast
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span className="text-[10px] opacity-70 font-sans">{idx + 1}.</span>
                  <span>{inst.move}</span>
                  {isPast && <span className="text-[10px] text-emerald-400 font-sans">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Completion Celebration Modal */}
      {isTutorFinished && totalSteps > 0 && (
        <TutorCompletionModal
          totalSteps={totalSteps}
          onRestartPaint={() => {
            store.setState({ mode: 'paint' });
            store.resetPaintToBlank();
          }}
          onGoToFreeMode={() => {
            store.setState({ mode: 'free' });
          }}
          onGoToLevels={onGoToLevels}
        />
      )}
    </>
  );
};
