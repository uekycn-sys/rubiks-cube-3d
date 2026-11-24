import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCubeStore } from '../../store/useCubeStore';
import { store } from '../../store/cubeStore';
import { CubeEngine } from '../../engine/CubeEngine';
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
    solutionMoves,
    instructions,
    currentStepIndex,
    historyFacelets,
    isAutoPlay,
    autoPlayInterval,
    playbackSpeed,
    isTutorFinished,
  } = useCubeStore();

  const [isExecutingMove, setIsExecutingMove] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const totalSteps = solutionMoves.length;
  const currentInstruction = instructions[currentStepIndex];

  // Align camera and show guide when current step changes
  useEffect(() => {
    if (!engine) return;

    if (currentStepIndex < totalSteps && !isTutorFinished) {
      const step = solutionMoves[currentStepIndex];
      engine.showTutorGuide(step);
    } else {
      engine.hideTutorGuide();
    }
  }, [engine, currentStepIndex, totalSteps, solutionMoves, isTutorFinished]);

  // Keep active timeline capsule visible in horizontal scroll
  useEffect(() => {
    if (!timelineScrollRef.current) return;
    const activeEl = timelineScrollRef.current.children[currentStepIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentStepIndex]);

  // Handle Step Forward
  const handleNextStep = useCallback(async () => {
    if (!engine || isExecutingMove || currentStepIndex >= totalSteps) return;

    setIsExecutingMove(true);
    engine.hideTutorGuide();

    const move = solutionMoves[currentStepIndex];
    await engine.applyMove(move, playbackSpeed);

    const nextIndex = currentStepIndex + 1;
    store.setState({ currentStepIndex: nextIndex });
    setIsExecutingMove(false);

    if (nextIndex >= totalSteps) {
      store.setState({ isTutorFinished: true });
    }
  }, [engine, isExecutingMove, currentStepIndex, totalSteps, solutionMoves, playbackSpeed]);

  // Handle Step Backward
  const handlePrevStep = useCallback(() => {
    if (!engine || isExecutingMove || currentStepIndex <= 0) return;

    const prevIndex = currentStepIndex - 1;
    const targetFacelets = historyFacelets[prevIndex];

    engine.setStateFromFacelets(targetFacelets);
    store.setState({
      currentStepIndex: prevIndex,
      isTutorFinished: false,
    });
  }, [engine, isExecutingMove, currentStepIndex, historyFacelets]);

  // Handle Replay Current Step
  const handleReplayCurrentStep = useCallback(async () => {
    if (!engine || isExecutingMove || currentStepIndex >= totalSteps) return;

    setIsExecutingMove(true);
    engine.hideTutorGuide();

    // 1. Reset state to pre-step
    const preFacelets = historyFacelets[currentStepIndex];
    engine.setStateFromFacelets(preFacelets);

    // 2. Slow demonstration
    const move = solutionMoves[currentStepIndex];
    await engine.applyMove(move, 0.5);

    // 3. Re-show guide
    setIsExecutingMove(false);
  }, [engine, isExecutingMove, currentStepIndex, totalSteps, historyFacelets, solutionMoves]);

  // Handle Jump directly to any step
  const handleJumpToStep = (index: number) => {
    if (!engine || isExecutingMove || index < 0 || index > totalSteps) return;

    const targetFacelets = historyFacelets[index];
    engine.setStateFromFacelets(targetFacelets);
    store.setState({
      currentStepIndex: index,
      isTutorFinished: index === totalSteps,
    });
  };

  // Auto Play Loop
  useEffect(() => {
    if (!isAutoPlay || isExecutingMove || isTutorFinished || currentStepIndex >= totalSteps) {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setTimeout(() => {
      handleNextStep();
    }, autoPlayInterval);

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [isAutoPlay, isExecutingMove, isTutorFinished, currentStepIndex, totalSteps, autoPlayInterval, handleNextStep]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space' || e.code === 'ArrowRight') {
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
  }, [handleNextStep, handlePrevStep, handleReplayCurrentStep]);

  return (
    <>
      <div className="flex flex-col gap-3 glass-panel rounded-3xl p-4 sm:p-5 shadow-2xl border border-sky-500/25 max-w-xl w-full mx-auto select-none">
        {/* Top Header: Step Counter & Reset Camera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 font-mono text-xs font-bold border border-sky-400/30">
              第 {Math.min(currentStepIndex + 1, totalSteps)} / {totalSteps} 步
            </span>
            <span className="text-xs text-slate-400">
              进度 {Math.round((currentStepIndex / totalSteps) * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => engine?.alignCamera('HOME')}
              className="px-2.5 py-1 rounded-lg glass-button text-xs text-sky-300 font-medium flex items-center gap-1 shadow-sm"
              title="一键回正白顶绿前标准视角"
            >
              <span>🧭</span>
              <span>回正视角</span>
            </button>

            <button
              type="button"
              onClick={onExitTutor}
              className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
            >
              退出教学
            </button>
          </div>
        </div>

        {/* Current Gesture Guide Card */}
        {currentInstruction && currentStepIndex < totalSteps ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-4 border border-sky-400/30 shadow-inner">
            <div className="flex items-start gap-4">
              {/* Giant Formula Badge */}
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-slate-950 font-black text-3xl sm:text-4xl flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.5)] shrink-0 font-mono">
                {currentInstruction.move}
              </div>

              {/* Gesture Instructions */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white mb-1 tracking-wide">
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

            {/* Visual Guide Hint */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-sky-300">
                <span>💡 提示：</span>
                <span>请观察 3D 魔方上的发光层与弧形方向箭头，保持白顶绿前跟拧</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-center">
            <div className="text-2xl mb-1">🎉</div>
            <div className="font-bold text-emerald-300 text-sm">
              所有步骤演示完毕！手中魔方已成功复原！
            </div>
          </div>
        )}

        {/* Primary Rhythm Control Console */}
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-4 gap-2">
            {/* Step Back Button */}
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStepIndex <= 0 || isExecutingMove}
              className={`py-3 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 glass-button ${
                currentStepIndex <= 0
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-slate-200 hover:text-white cursor-pointer'
              }`}
              title="回退到上一步 (快捷键 ←)"
            >
              <span>⬅️</span>
              <span className="hidden sm:inline">上一步</span>
            </button>

            {/* Replay Current Button */}
            <button
              type="button"
              onClick={handleReplayCurrentStep}
              disabled={isExecutingMove || currentStepIndex >= totalSteps}
              className={`py-3 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 glass-button ${
                currentStepIndex >= totalSteps
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-sky-300 hover:text-sky-200 cursor-pointer'
              }`}
              title="重播当前步 (快捷键 R)"
            >
              <span>🔁</span>
              <span className="hidden sm:inline">重播当前步</span>
            </button>

            {/* Next Step Primary Button */}
            <button
              type="button"
              onClick={handleNextStep}
              disabled={isExecutingMove || currentStepIndex >= totalSteps}
              className={`col-span-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                currentStepIndex >= totalSteps
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : isExecutingMove
                  ? 'bg-sky-600 text-white cursor-wait'
                  : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 hover:scale-[1.02] shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-pointer'
              }`}
            >
              {isExecutingMove ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>演示中...</span>
                </>
              ) : (
                <>
                  <span>演示并执行下一步</span>
                  <span>➡️</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Controls: Auto-Play & Speed Bar */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            {/* Auto Play Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => store.setState({ isAutoPlay: !isAutoPlay })}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  isAutoPlay
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                    : 'glass-button text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{isAutoPlay ? '⏸️' : '▶️'}</span>
                <span>自动跟练</span>
              </button>

              {isAutoPlay && (
                <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800 text-[11px]">
                  {[1500, 3000, 5000].map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => store.setState({ autoPlayInterval: interval })}
                      className={`px-2 py-0.5 rounded ${
                        autoPlayInterval === interval
                          ? 'bg-sky-500/30 text-sky-200 font-bold'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {interval / 1000}s
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Playback Speed Selector */}
            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800 text-[11px]">
              <span className="text-slate-500 px-1">速度:</span>
              {[
                { label: '慢速 0.5x', speed: 0.5 },
                { label: '标准 1x', speed: 1.0 },
                { label: '快速 2x', speed: 2.0 },
              ].map((s) => (
                <button
                  key={s.speed}
                  type="button"
                  onClick={() => store.setState({ playbackSpeed: s.speed })}
                  className={`px-2 py-0.5 rounded transition-all ${
                    playbackSpeed === s.speed
                      ? 'bg-sky-500/30 text-sky-200 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal Step Timeline Capsule */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span>解法步骤胶囊条：</span>
            <span className="text-slate-500 font-mono">
              点击任意步骤快速跳转
            </span>
          </div>

          <div
            ref={timelineScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scroll-smooth"
          >
            {instructions.map((inst, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleJumpToStep(idx)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold shrink-0 transition-all duration-200 flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-sky-500 text-slate-950 ring-2 ring-sky-300 scale-105 shadow-[0_0_15px_rgba(56,189,248,0.6)]'
                      : isPast
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{inst.move}</span>
                  {isPast && <span className="text-[10px] text-emerald-400 font-sans">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Completion Celebration Modal */}
      {isTutorFinished && (
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
