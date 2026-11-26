import React from 'react';
import { LBL_STAGES } from '../../core/lblSolver';
import { LblStageId } from '../../core/types';

interface LblCheatSheetModalProps {
  currentStage: LblStageId | null;
  onPracticeStage: (stageId: LblStageId) => void;
  onClose: () => void;
}

export const LblCheatSheetModal: React.FC<LblCheatSheetModalProps> = ({
  currentStage,
  onPracticeStage,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl glass-panel border border-sky-500/30 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 text-slate-950 font-black flex items-center justify-center text-lg shadow-lg">
              📖
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                层先法 7 步通关秘籍图谱
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                固定视角「白顶 · 绿前 · 红右 · 黄底」— 全程不用翻魔方，只需记 5 条核心口诀
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl glass-button flex items-center justify-center text-slate-400 hover:text-white text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Stages List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-3 flex-1">
          {LBL_STAGES.map((stage) => {
            const isActive = currentStage === stage.id;
            return (
              <div
                key={stage.id}
                className={`rounded-2xl p-3.5 sm:p-4 border transition-all ${
                  isActive
                    ? 'bg-sky-950/50 border-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/30 font-mono font-bold text-xs flex items-center justify-center">
                      {stage.id}
                    </span>
                    <h3 className="text-sm font-bold text-white">{stage.name}</h3>
                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        当前进度
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onPracticeStage(stage.id);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 hover:text-white border border-sky-400/30 text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    🎯 专项练此阶段
                  </button>
                </div>

                <p className="text-xs text-slate-300 mb-2 leading-relaxed">{stage.goal}</p>

                <div className="flex flex-col gap-1.5 bg-slate-950/70 rounded-xl p-2.5 border border-slate-800/80 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 shrink-0">核心公式:</span>
                    <code className="font-mono text-sky-300 font-bold text-[11px] bg-sky-500/10 px-2 py-0.5 rounded">
                      {stage.formulaDisplay}
                    </code>
                  </div>
                  <div className="text-[11px] text-emerald-300 leading-relaxed">
                    <span className="text-slate-400">记忆口诀: </span>
                    {stage.mnemonic}
                  </div>
                  <div className="text-[11px] text-amber-300/90 leading-relaxed">
                    <span className="text-slate-400">观察技巧: </span>
                    {stage.tip}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Notation Legend */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-950/70 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-slate-200">字母含义：</strong>
            U顶(白) · D底(黄) · F前(绿) · R右(红) · L左(橙) · B背(蓝)
          </div>
          <div>
            <strong className="text-slate-200">方向符号：</strong>
            无符号=顺时针90° · 撇(&apos;)=逆时针90° · 2=转180°
          </div>
        </div>
      </div>
    </div>
  );
};
