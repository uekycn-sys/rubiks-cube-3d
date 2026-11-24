import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface TutorCompletionModalProps {
  totalSteps: number;
  onRestartPaint: () => void;
  onGoToFreeMode: () => void;
  onGoToLevels: () => void;
}

export const TutorCompletionModal: React.FC<TutorCompletionModalProps> = ({
  totalSteps,
  onRestartPaint,
  onGoToFreeMode,
  onGoToLevels,
}) => {
  useEffect(() => {
    // Fire celebration confetti
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#38BDF8', '#34D399', '#FBBF24', '#F43F5E', '#A78BFA'],
      });
    } catch {
      // Ignore if canvas not available
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md p-6 rounded-3xl glass-panel border border-sky-400/40 shadow-2xl flex flex-col items-center text-center">
        {/* Glow Crown Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 shadow-[0_0_25px_rgba(251,191,36,0.6)] flex items-center justify-center text-3xl mb-4 animate-bounce">
          🎉
        </div>

        <h2 className="text-xl font-extrabold text-white mb-1">
          恭喜！手中魔方已成功还原！
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-xs mb-5">
          在 AI 手把手教学指引下，您仅用了{' '}
          <strong className="text-sky-300 font-mono text-sm">{totalSteps}</strong> 步
          便完成了整个真实魔方的复原！
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={onRestartPaint}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-bold text-xs tracking-wider shadow-lg hover:brightness-110 hover:scale-[1.02] transition-all cursor-pointer"
          >
            📸 再录入一个真实魔方
          </button>

          <button
            type="button"
            onClick={onGoToLevels}
            className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-sky-300 font-semibold text-xs border border-sky-500/30 transition-all cursor-pointer"
          >
            🏆 开启 20 关闯关挑战
          </button>

          <button
            type="button"
            onClick={onGoToFreeMode}
            className="w-full py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs transition-all cursor-pointer"
          >
            返回自由竞速模式
          </button>
        </div>
      </div>
    </div>
  );
};
