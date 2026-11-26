import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { CubeEngine } from '../../engine/CubeEngine';
import { CubeState } from '../../core/cubeState';
import {
  LBL_STAGES,
  evaluateLblProgress,
  generateStagePracticeState,
  solveLBL,
} from '../../core/lblSolver';
import { translateMove } from '../../core/moveTranslator';
import {
  INVERSE_MOVES,
  LblProgressReport,
  LblSolution,
  LblStageId,
  Move,
  SOLVED_FACELETS,
} from '../../core/types';
import { store } from '../../store/cubeStore';
import { useCubeStore } from '../../store/useCubeStore';
import { soundManager } from '../../audio/SoundManager';
import { LblCheatSheetModal } from './LblCheatSheetModal';

type GuidanceLevel = 'guided' | 'formula' | 'challenge';

interface WrongMoveFeedback {
  actualMove: Move;
  expectedMove: Move;
  expectedText: string;
}

interface LblLearnPanelProps {
  engine: CubeEngine | null;
  onHighlightMoveChange?: (move: Move | null) => void;
}

export const LblLearnPanel: React.FC<LblLearnPanelProps> = ({
  engine,
  onHighlightMoveChange,
}) => {
  const { learnInitialFacelets, learnTargetStage } = useCubeStore();

  const [guidanceLevel, setGuidanceLevel] = useState<GuidanceLevel>('guided');
  const [autoCamera, setAutoCamera] = useState(true);
  const [peekArrow, setPeekArrow] = useState(false);
  const [showChallengeHint, setShowChallengeHint] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const [lblSolution, setLblSolution] = useState<LblSolution | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [moveInChunk, setMoveInChunk] = useState(0);
  const [chunkStartFacelets, setChunkStartFacelets] = useState<string>(SOLVED_FACELETS);
  const [pendingHalfMove, setPendingHalfMove] = useState<Move | null>(null);
  const [wrongMoveFeedback, setWrongMoveFeedback] = useState<WrongMoveFeedback | null>(null);

  const [progress, setProgress] = useState<LblProgressReport>(() =>
    evaluateLblProgress(SOLVED_FACELETS)
  );
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [userStepCount, setUserStepCount] = useState(0);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  const isProgrammaticRef = useRef(false);
  const demoSessionRef = useRef(0);
  const prevCompletedCountRef = useRef(0);
  const initializedRef = useRef(false);

  const latestRef = useRef({
    guidanceLevel,
    lblSolution,
    chunkIndex,
    moveInChunk,
    pendingHalfMove,
    isDemoRunning,
    moveHistory,
  });
  latestRef.current = {
    guidanceLevel,
    lblSolution,
    chunkIndex,
    moveInChunk,
    pendingHalfMove,
    isDemoRunning,
    moveHistory,
  };

  const currentChunk = lblSolution?.chunks[chunkIndex] ?? null;
  const currentExpectedMove = currentChunk?.moves[moveInChunk] ?? null;
  const activeTargetMove: Move | null = pendingHalfMove ?? currentExpectedMove;

  const loadFaceletsIntoAcademy = useCallback(
    (facelets: string, solution?: LblSolution) => {
      if (!engine) return;
      demoSessionRef.current++;
      setIsDemoRunning(false);
      isProgrammaticRef.current = true;
      engine.cancelAnimations();
      engine.setStateFromFacelets(facelets);
      isProgrammaticRef.current = false;

      const sol = solution ?? solveLBL(facelets);
      const rep = evaluateLblProgress(facelets);

      prevCompletedCountRef.current = rep.completedCount;
      setProgress(rep);
      setLblSolution(sol);
      setChunkIndex(0);
      setMoveInChunk(0);
      setChunkStartFacelets(facelets);
      setPendingHalfMove(null);
      setWrongMoveFeedback(null);
      setPeekArrow(false);
      setShowChallengeHint(false);
      setMoveHistory([]);
      setUserStepCount(0);
      setMilestoneBanner(null);

      if (sol.chunks[0] && autoCamera) {
        engine.alignCamera(sol.chunks[0].recommendedView);
      } else {
        engine.alignCamera('HOME');
      }
    },
    [engine, autoCamera]
  );

  // Start a fresh 20-move scramble for full-cycle LBL learning
  const handleStartFreshScramble = useCallback(() => {
    const scramble = CubeState.generateScramble(20);
    const sim = new CubeState();
    sim.applyMoves(scramble);
    loadFaceletsIntoAcademy(sim.getFacelets());
  }, [loadFaceletsIntoAcademy]);

  // Start focused practice at a specific LBL stage (1..7)
  const handlePracticeStage = useCallback(
    (stageId: LblStageId) => {
      const { facelets, solution } = generateStagePracticeState(stageId);
      loadFaceletsIntoAcademy(facelets, solution);
    },
    [loadFaceletsIntoAcademy]
  );

  // Initialize cube state when entering LBL Academy or receiving an external puzzle
  useEffect(() => {
    if (!engine) return;

    if (learnInitialFacelets) {
      const target = learnInitialFacelets;
      store.setState({ learnInitialFacelets: null, learnTargetStage: null });
      loadFaceletsIntoAcademy(target);
      initializedRef.current = true;
      return;
    }

    if (learnTargetStage) {
      const stage = learnTargetStage;
      store.setState({ learnTargetStage: null });
      handlePracticeStage(stage);
      initializedRef.current = true;
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      const current = engine.getFacelets();
      if (current === SOLVED_FACELETS) {
        handleStartFreshScramble();
      } else {
        loadFaceletsIntoAcademy(current);
      }
    }
  }, [
    engine,
    learnInitialFacelets,
    learnTargetStage,
    loadFaceletsIntoAcademy,
    handlePracticeStage,
    handleStartFreshScramble,
  ]);

  // Sync 3D guide arrow, target sticker highlight, and QuickTurnBar highlight
  useEffect(() => {
    if (!engine) return;

    if (progress.isSolved || !currentChunk || isDemoRunning) {
      engine.setGuidedMove(null);
      engine.clearFaceletHighlights();
      onHighlightMoveChange?.(null);
      return;
    }

    const shouldShowArrow =
      guidanceLevel === 'guided' || (guidanceLevel === 'formula' && peekArrow);

    if (shouldShowArrow && activeTargetMove) {
      engine.setGuidedMove(activeTargetMove);
      onHighlightMoveChange?.(activeTargetMove);
    } else {
      engine.setGuidedMove(null);
      onHighlightMoveChange?.(null);
    }

    if (guidanceLevel !== 'challenge' && moveInChunk === 0 && !pendingHalfMove) {
      engine.highlightFacelets(currentChunk.highlightFacelets);
    } else {
      engine.clearFaceletHighlights();
    }
  }, [
    engine,
    progress.isSolved,
    currentChunk,
    moveInChunk,
    pendingHalfMove,
    activeTargetMove,
    guidanceLevel,
    peekArrow,
    isDemoRunning,
    onHighlightMoveChange,
  ]);

  // Auto-orbit camera gently at the start of a new chunk when enabled
  useEffect(() => {
    if (!engine || !autoCamera || guidanceLevel === 'challenge') return;
    if (!currentChunk || progress.isSolved || isDemoRunning) return;
    engine.alignCamera(currentChunk.recommendedView);
  }, [engine, currentChunk?.id, autoCamera, guidanceLevel, progress.isSolved, isDemoRunning]);

  // Advance expected cursor after a matching move
  const advanceExpectedStep = useCallback((postFacelets: string) => {
    const { lblSolution: sol, chunkIndex: cIdx, moveInChunk: mIdx } = latestRef.current;
    if (!sol) return;

    const chunk = sol.chunks[cIdx];
    if (!chunk) return;

    setPendingHalfMove(null);

    if (mIdx + 1 < chunk.moves.length) {
      setMoveInChunk(mIdx + 1);
      return;
    }

    if (cIdx + 1 < sol.chunks.length) {
      setChunkIndex(cIdx + 1);
      setMoveInChunk(0);
      setChunkStartFacelets(postFacelets);
      return;
    }

    // Fallback: re-plan if anything remains
    const nextSol = solveLBL(postFacelets);
    setLblSolution(nextSol);
    setChunkIndex(0);
    setMoveInChunk(0);
    setChunkStartFacelets(postFacelets);
  }, []);

  // Re-plan LBL from the current cube state
  const handleReplanFromCurrent = useCallback(() => {
    if (!engine) return;
    const facelets = engine.getFacelets();
    const sol = solveLBL(facelets);
    setLblSolution(sol);
    setChunkIndex(0);
    setMoveInChunk(0);
    setChunkStartFacelets(facelets);
    setPendingHalfMove(null);
    setWrongMoveFeedback(null);
    setPeekArrow(false);
  }, [engine]);

  // Undo the last user turn cleanly
  const handleUndo = useCallback(async () => {
    if (!engine || latestRef.current.isDemoRunning) return;
    const history = latestRef.current.moveHistory;
    if (history.length === 0) return;

    const lastMove = history[history.length - 1];
    const inverse = INVERSE_MOVES[lastMove];

    isProgrammaticRef.current = true;
    await engine.playMoveAsync(inverse, 180);
    isProgrammaticRef.current = false;

    const afterFacelets = engine.getFacelets();
    const rep = evaluateLblProgress(afterFacelets);
    prevCompletedCountRef.current = rep.completedCount;
    setProgress(rep);
    setMoveHistory((prev) => prev.slice(0, -1));

    // If undoing a wrong move, just dismiss the coaching banner without replanning
    if (wrongMoveFeedback && lastMove === wrongMoveFeedback.actualMove) {
      setWrongMoveFeedback(null);
      return;
    }

    const sol = solveLBL(afterFacelets);
    setLblSolution(sol);
    setChunkIndex(0);
    setMoveInChunk(0);
    setChunkStartFacelets(afterFacelets);
    setPendingHalfMove(null);
    setWrongMoveFeedback(null);
  }, [engine, wrongMoveFeedback]);

  // Hook into engine.callbacks.onMoveComplete for real-time interactive coaching
  useEffect(() => {
    if (!engine) return;

    const originalCallback = engine.callbacks.onMoveComplete;
    engine.callbacks.onMoveComplete = (move, remaining) => {
      originalCallback?.(move, remaining);
      if (isProgrammaticRef.current) return;

      const {
        guidanceLevel: level,
        lblSolution: sol,
        chunkIndex: cIdx,
        moveInChunk: mIdx,
        pendingHalfMove: half,
      } = latestRef.current;

      setMoveHistory((prev) => [...prev, move]);
      setUserStepCount((prev) => prev + 1);
      setPeekArrow(false);
      setWrongMoveFeedback(null);

      const currentFacelets = engine.getFacelets();
      const rep = evaluateLblProgress(currentFacelets);
      setProgress(rep);

      if (rep.completedCount > prevCompletedCountRef.current && !rep.isSolved) {
        const stageName = LBL_STAGES[rep.completedCount - 1]?.shortName || '';
        setMilestoneBanner(`🎉 太棒了！已完成「${stageName}」(${rep.completedCount}/7)`);
        soundManager.playPaint();
      }
      prevCompletedCountRef.current = rep.completedCount;

      if (rep.isSolved) {
        setPendingHalfMove(null);
        setLblSolution(solveLBL(currentFacelets));
        setMilestoneBanner(null);
        soundManager.playVictory();
        try {
          confetti({ particleCount: 110, spread: 75, origin: { y: 0.6 } });
        } catch {
          // Ignore if canvas not available
        }
        return;
      }

      // Challenge mode: free play with live stage progress tracking (no step policing)
      if (level === 'challenge') {
        const nextSol = solveLBL(currentFacelets);
        setLblSolution(nextSol);
        setChunkIndex(0);
        setMoveInChunk(0);
        setChunkStartFacelets(currentFacelets);
        setPendingHalfMove(null);
        return;
      }

      const chunk = sol?.chunks[cIdx];
      const expectedMove = chunk?.moves[mIdx];
      if (!expectedMove) {
        const nextSol = solveLBL(currentFacelets);
        setLblSolution(nextSol);
        setChunkIndex(0);
        setMoveInChunk(0);
        setChunkStartFacelets(currentFacelets);
        return;
      }

      const expectedFace = expectedMove[0];
      const isDouble = expectedMove.includes('2');

      if (move === expectedMove) {
        advanceExpectedStep(currentFacelets);
        return;
      }

      if (isDouble && !half && (move === expectedFace || move === `${expectedFace}'`)) {
        setPendingHalfMove(move);
        return;
      }

      if (isDouble && half) {
        if (move === half) {
          advanceExpectedStep(currentFacelets);
          return;
        }
        if (move === INVERSE_MOVES[half]) {
          setPendingHalfMove(null);
          return;
        }
      }

      // Mismatched turn: coach the user gently with instant Undo or Re-plan
      soundManager.playError();
      setWrongMoveFeedback({
        actualMove: move,
        expectedMove,
        expectedText: translateMove(expectedMove).title,
      });
    };

    return () => {
      engine.callbacks.onMoveComplete = originalCallback;
    };
  }, [engine, advanceExpectedStep]);

  // Demonstrate the current formula chunk slowly in 3D
  const handleDemoCurrentChunk = async () => {
    if (!engine || !currentChunk || progress.isSolved) return;

    if (isDemoRunning) {
      demoSessionRef.current++;
      setIsDemoRunning(false);
      isProgrammaticRef.current = false;
      engine.cancelAnimations();
      return;
    }

    // Rewind to chunk start if user already started half or had wrong move
    if (wrongMoveFeedback || pendingHalfMove || moveInChunk > 0) {
      isProgrammaticRef.current = true;
      engine.setStateFromFacelets(chunkStartFacelets);
      isProgrammaticRef.current = false;
      setMoveInChunk(0);
      setPendingHalfMove(null);
      setWrongMoveFeedback(null);
    }

    const sessionId = ++demoSessionRef.current;
    setIsDemoRunning(true);
    isProgrammaticRef.current = true;

    try {
      for (let i = 0; i < currentChunk.moves.length; i++) {
        if (demoSessionRef.current !== sessionId) break;
        const m = currentChunk.moves[i];
        engine.showTutorGuide(m);
        setMoveInChunk(i);

        await engine.playMoveAsync(m, 440);
        if (demoSessionRef.current !== sessionId) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      if (demoSessionRef.current === sessionId) {
        const postFacelets = engine.getFacelets();
        const rep = evaluateLblProgress(postFacelets);
        prevCompletedCountRef.current = rep.completedCount;
        setProgress(rep);
        if (rep.isSolved) {
          soundManager.playVictory();
          setLblSolution(solveLBL(postFacelets));
        } else if (lblSolution && chunkIndex + 1 < lblSolution.chunks.length) {
          setChunkIndex(chunkIndex + 1);
          setMoveInChunk(0);
          setChunkStartFacelets(postFacelets);
        } else {
          setLblSolution(solveLBL(postFacelets));
          setChunkIndex(0);
          setMoveInChunk(0);
          setChunkStartFacelets(postFacelets);
        }
      }
    } finally {
      isProgrammaticRef.current = false;
      if (demoSessionRef.current === sessionId) {
        setIsDemoRunning(false);
      }
    }
  };

  // Rewind to start of current chunk so user can practice it themselves right after watching demo
  const handleRetryCurrentChunk = () => {
    if (!engine || isDemoRunning) return;
    isProgrammaticRef.current = true;
    engine.setStateFromFacelets(chunkStartFacelets);
    isProgrammaticRef.current = false;
    const rep = evaluateLblProgress(chunkStartFacelets);
    prevCompletedCountRef.current = rep.completedCount;
    setProgress(rep);
    setMoveInChunk(0);
    setPendingHalfMove(null);
    setWrongMoveFeedback(null);
  };

  // Keyboard shortcut Z for Undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      demoSessionRef.current++;
      isProgrammaticRef.current = false;
      engine?.setGuidedMove(null);
      engine?.clearFaceletHighlights();
      onHighlightMoveChange?.(null);
    };
  }, [engine, onHighlightMoveChange]);

  const currentStageId: LblStageId | null = currentChunk?.stageId ?? progress.currentStage;
  const currentStageMeta = currentStageId ? LBL_STAGES[currentStageId - 1] : null;
  const expectedInstruction = activeTargetMove ? translateMove(activeTargetMove) : null;

  return (
    <div className="flex flex-col gap-2.5 w-full select-none pb-2">
      {/* 1. Top Toolbar: Guidance Modes & Cheat Sheet */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
          {(
            [
              { id: 'guided', label: '🟢 手把手' },
              { id: 'formula', label: '🟡 看公式' },
              { id: 'challenge', label: '🔥 盲打实战' },
            ] as const
          ).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGuidanceLevel(g.id);
                setWrongMoveFeedback(null);
                setPeekArrow(false);
                if (g.id !== 'challenge' && engine) {
                  handleReplanFromCurrent();
                }
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                guidanceLevel === g.id
                  ? 'bg-gradient-to-r from-sky-500 to-emerald-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAutoCamera(!autoCamera)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              autoCamera
                ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="切换新公式时自动转动视角对准目标块"
          >
            🎥 {autoCamera ? '自动视角' : '手动视角'}
          </button>

          <button
            type="button"
            onClick={() => setShowCheatSheet(true)}
            className="px-2.5 py-1 rounded-lg glass-button text-amber-300 hover:text-white text-[11px] font-bold border-amber-400/30 cursor-pointer"
          >
            📖 口诀图谱
          </button>
        </div>
      </div>

      {/* 2. 7-Stage Interactive Roadmap (click any stage to practice directly!) */}
      <div className="rounded-2xl bg-slate-950/60 border border-slate-800/90 p-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-0.5">
          <span className="font-semibold text-slate-300">
            层先法 7 步路线图（点击任意阶段可专项练习）
          </span>
          <span className="font-mono text-sky-300 font-bold">
            {progress.completedCount}/7
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {LBL_STAGES.map((stage, idx) => {
            const isDone = progress.completedStages[idx];
            const isCurrent = !progress.isSolved && currentStageId === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => handlePracticeStage(stage.id)}
                title={`${stage.name}（点击生成此阶段专项练习）`}
                className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                  isDone
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : isCurrent
                    ? 'bg-sky-500/25 border-sky-400 text-white ring-1 ring-sky-400/60 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className="text-[10px] font-mono font-bold">
                  {isDone ? '✓' : `${stage.id}`}
                </span>
                <span className="text-[10px] leading-tight truncate max-w-full px-0.5">
                  {stage.shortName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Milestone Toast */}
      {milestoneBanner && !progress.isSolved && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{milestoneBanner}</span>
          <button
            type="button"
            onClick={() => setMilestoneBanner(null)}
            className="text-emerald-400 hover:text-white text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Solved Celebration Card OR Active Coaching Card */}
      {progress.isSolved ? (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-sky-950/60 border border-emerald-400/40 p-5 text-center flex flex-col items-center gap-3 shadow-xl animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-emerald-400 text-3xl flex items-center justify-center shadow-lg animate-bounce">
            🎓
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white mb-1">
              恭喜通关！魔方已用层先法彻底还原！
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              本次共动手拧了 <strong className="text-sky-300 font-mono">{userStepCount}</strong> 步。
              {guidanceLevel === 'guided'
                ? '已经熟悉口诀了？推荐切换到「🟡 看公式」模式脱离箭头指引练一遍！'
                : guidanceLevel === 'formula'
                ? '太强了！试试「🔥 盲打实战」自己观察颜色从头拼一次吧！'
                : '你已经完全掌握层先法独立还原六面魔方！'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full mt-1">
            <button
              type="button"
              onClick={handleStartFreshScramble}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 text-slate-950 font-bold text-xs shadow-lg hover:brightness-110 cursor-pointer"
            >
              🎲 再来一局新打乱
            </button>

            {guidanceLevel !== 'challenge' ? (
              <button
                type="button"
                onClick={() => {
                  setGuidanceLevel(guidanceLevel === 'guided' ? 'formula' : 'challenge');
                  handleStartFreshScramble();
                }}
                className="py-2.5 px-3 rounded-xl glass-button text-amber-300 hover:text-white font-bold text-xs border-amber-400/30 cursor-pointer"
              >
                {guidanceLevel === 'guided' ? '🟡 进阶：看公式练' : '🔥 终极：盲打挑战'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCheatSheet(true)}
                className="py-2.5 px-3 rounded-xl glass-button text-sky-300 hover:text-white font-bold text-xs cursor-pointer"
              >
                📖 查看 7 步秘籍
              </button>
            )}
          </div>
        </div>
      ) : guidanceLevel === 'challenge' ? (
        /* Challenge Mode (Blind Play) */
        <div className="rounded-2xl bg-slate-900/85 border border-amber-500/30 p-3.5 flex flex-col gap-2.5 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold">
              🔥 盲打实战模式
            </span>
            <span className="font-mono text-xs text-slate-300">
              已走 <strong className="text-sky-300">{userStepCount}</strong> 步
            </span>
          </div>

          {currentStageMeta && (
            <div className="text-xs text-slate-200">
              <div className="font-bold text-white mb-0.5">{currentStageMeta.name}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{currentStageMeta.goal}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChallengeHint(!showChallengeHint)}
              className="px-3 py-1.5 rounded-xl glass-button text-amber-300 text-xs font-semibold cursor-pointer"
            >
              {showChallengeHint ? '🙈 隐藏提示' : '🆘 卡住了？看当前阶段口诀'}
            </button>

            <button
              type="button"
              onClick={() => {
                setGuidanceLevel('guided');
                handleReplanFromCurrent();
              }}
              className="px-3 py-1.5 rounded-xl glass-button text-sky-300 text-xs font-semibold cursor-pointer"
            >
              🟢 切回手把手带练
            </button>
          </div>

          {showChallengeHint && currentStageMeta && (
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-400/30 text-xs flex flex-col gap-1 animate-fade-in">
              <div className="font-mono text-sky-300 font-bold">
                公式：{currentStageMeta.formulaDisplay}
              </div>
              <div className="text-emerald-300 text-[11px]">口诀：{currentStageMeta.mnemonic}</div>
              <div className="text-slate-400 text-[11px]">观察：{currentStageMeta.tip}</div>
            </div>
          )}
        </div>
      ) : currentChunk && currentStageMeta ? (
        /* Guided / Formula Mode Active Coaching Card */
        <div className="flex flex-col gap-2.5">
          {/* Stage & Formula Header Card */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-sky-950/40 p-3.5 border border-sky-400/30 shadow-inner flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[11px] font-bold shrink-0">
                  第 {currentChunk.stageId}/7 阶段
                </span>
                <span className="text-xs font-bold text-white truncate">
                  {currentChunk.title}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold shrink-0">
                {currentChunk.formulaName}
              </span>
            </div>

            {/* Recognition + Mnemonic */}
            <div className="text-[11px] leading-relaxed bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 flex flex-col gap-1">
              <div className="text-amber-300">
                <span className="font-bold">👀 为什么这步：</span>
                {currentChunk.recognitionTip}
              </div>
              <div className="text-emerald-300">
                <span className="font-bold">🎵 顺口溜：</span>
                {currentChunk.mnemonic}
              </div>
            </div>

            {/* Formula Beat Strip */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>本段公式节奏（跟着亮块在 3D 魔方上滑动）：</span>
                <span className="font-mono text-slate-300">
                  {moveInChunk + 1}/{currentChunk.moves.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                {currentChunk.moves.map((mv, idx) => {
                  const isDone = idx < moveInChunk;
                  const isCurrent = idx === moveInChunk;
                  return (
                    <div
                      key={idx}
                      className={`px-2.5 py-1.5 rounded-xl border shrink-0 flex flex-col items-center min-w-[44px] transition-all ${
                        isCurrent
                          ? 'bg-gradient-to-b from-sky-400 to-cyan-400 text-slate-950 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.6)] scale-105'
                          : isDone
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900/90 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="font-mono font-black text-xs leading-none">
                        {isDone ? `✓${mv}` : mv}
                      </span>
                      <span
                        className={`text-[10px] mt-0.5 leading-none ${
                          isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {currentChunk.rhythms[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Half-move prompt for 180° (X2) turns */}
            {pendingHalfMove && currentExpectedMove && (
              <div className="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-400/50 text-sky-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <span>↻</span>
                <span>
                  已完成 90°！请沿同方向再转一次 <strong className="font-mono">{pendingHalfMove}</strong>{' '}
                  以完成 <strong className="font-mono">{currentExpectedMove}</strong>（180°）
                </span>
              </div>
            )}

            {/* Current Expected Gesture Guide (Guided mode or peeked in Formula mode) */}
            {(guidanceLevel === 'guided' || peekArrow) && expectedInstruction && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-slate-950 font-black text-xl flex items-center justify-center shrink-0 font-mono shadow-md">
                  {activeTargetMove}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {expectedInstruction.title}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {expectedInstruction.gesture} · 在 3D 魔方上直接拖转即可
                  </div>
                </div>
              </div>
            )}

            {/* Peek Arrow Toggle when in Formula mode */}
            {guidanceLevel === 'formula' && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-[11px] text-amber-300/90">
                  看上方公式自己判断转动方向（金色高亮块为目标块）
                </span>
                <button
                  type="button"
                  onClick={() => setPeekArrow(!peekArrow)}
                  className="px-2.5 py-1 rounded-lg glass-button text-sky-300 text-[11px] font-semibold shrink-0 cursor-pointer"
                >
                  {peekArrow ? '🙈 收起箭头' : '👀 偷看一步箭头'}
                </button>
              </div>
            )}
          </div>

          {/* Wrong Move Coaching Banner */}
          {wrongMoveFeedback && (
            <div className="px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs flex flex-col gap-2 animate-fade-in">
              <div className="text-amber-200 font-semibold">
                ⚠️ 刚才拧了 <code className="font-mono font-bold">{wrongMoveFeedback.actualMove}</code>
                ，当前公式需要{' '}
                <code className="font-mono font-bold text-sky-300">
                  {wrongMoveFeedback.expectedMove}
                </code>{' '}
                <span className="text-slate-300 font-normal">
                  （{wrongMoveFeedback.expectedText}）
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                >
                  ↩ 撤销刚才这步
                </button>
                <button
                  type="button"
                  onClick={handleReplanFromCurrent}
                  className="px-2.5 py-1 rounded-lg glass-button text-sky-300 text-[11px] font-semibold cursor-pointer"
                >
                  🔄 没关系，按当前魔方重新规划层先法
                </button>
              </div>
            </div>
          )}

          {/* Action Row: Demo Chunk / Retry Chunk / Undo / New Scramble */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDemoCurrentChunk}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md ${
                isDemoRunning
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                  : 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 hover:brightness-110'
              }`}
            >
              <span>{isDemoRunning ? '⏸ 暂停示范' : '▶ 示范这一组公式'}</span>
            </button>

            <button
              type="button"
              onClick={handleRetryCurrentChunk}
              disabled={isDemoRunning}
              className="py-2.5 px-3 rounded-xl glass-button text-emerald-300 hover:text-white font-bold text-xs cursor-pointer disabled:opacity-40"
            >
              ⏪ 退回本组开头重练
            </button>
          </div>
        </div>
      ) : null}

      {/* 4. Bottom Utility Bar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={moveHistory.length === 0 || isDemoRunning}
            className="px-2.5 py-1.5 rounded-xl glass-button text-slate-200 hover:text-white text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
            title="撤销上一步 (快捷键 Z)"
          >
            ↩ 撤销 ({moveHistory.length})
          </button>

          <button
            type="button"
            onClick={handleStartFreshScramble}
            disabled={isDemoRunning}
            className="px-2.5 py-1.5 rounded-xl glass-button text-sky-300 hover:text-white text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
          >
            🎲 新打乱练习
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!engine) return;
            const current = engine.getFacelets();
            const sol = solveLBL(current);
            store.setupTutor(current, sol.moves, sol, 'lbl');
          }}
          disabled={progress.isSolved || isDemoRunning}
          className="px-2.5 py-1.5 rounded-xl glass-button text-slate-300 hover:text-white text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
        >
          📺 切换完整慢放
        </button>
      </div>

      {/* 7-Stage Cheat Sheet Modal */}
      {showCheatSheet && (
        <LblCheatSheetModal
          currentStage={currentStageId}
          onPracticeStage={(stageId) => handlePracticeStage(stageId)}
          onClose={() => setShowCheatSheet(false)}
        />
      )}
    </div>
  );
};
