import React from 'react';
import { useCubeStore } from '../../store/useCubeStore';
import { store } from '../../store/cubeStore';
import { NetEditor } from './NetEditor';
import { PaintPalette } from './PaintPalette';
import { solveCube } from '../../core/solverService';
import { Face } from '../../core/types';

interface RealCubePaintPanelProps {
  onAlignCamera: (view: any) => void;
  onEnterTutor: () => void;
}

export const RealCubePaintPanel: React.FC<RealCubePaintPanelProps> = ({
  onAlignCamera,
  onEnterTutor,
}) => {
  const { paintFacelets, selectedPaintColor, validationResult, isSolving, solveError } =
    useCubeStore();

  const handleFaceletClick = (index: number) => {
    store.setPaintFacelet(index, selectedPaintColor);
  };

  const handleSelectColor = (color: Face | 'X') => {
    store.setState({ selectedPaintColor: color });
  };

  const handleStartSolveAndTutor = async () => {
    if (!validationResult.valid || isSolving) return;

    store.setState({ isSolving: true, solveError: null });

    try {
      const solution = await solveCube(paintFacelets);
      store.setupTutor(paintFacelets, solution);
      store.setState({ isSolving: false });
      onEnterTutor();
    } catch (err: any) {
      console.error('Solve failed:', err);
      store.setState({
        isSolving: false,
        solveError: err?.message || '计算最优解失败，请检查魔方状态',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* 1. Benchmark Holding Orientation Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-900/40 via-blue-900/30 to-indigo-900/40 border border-sky-400/30 p-3.5 mb-3 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0 text-lg shadow-inner">
            🧭
          </div>
          <div className="flex-1 text-xs leading-relaxed text-slate-200">
            <span className="font-semibold text-sky-300 block mb-0.5 text-sm">
              手持魔方基准方向（极为关键）：
            </span>
            <div className="text-slate-300">
              请拿好手中的魔方：<strong className="text-white">白色中心朝上 ⬆️</strong>，
              <strong className="text-emerald-400">绿色中心正对自己 👀</strong>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>右侧为 <strong className="text-rose-400">红色(R)</strong></span>
                <span>左侧为 <strong className="text-amber-500">橙色(L)</strong></span>
                <span>底面为 <strong className="text-yellow-400">黄色(D)</strong></span>
                <span>背面为 <strong className="text-blue-400">蓝色(B)</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Camera Align Quick Buttons on 3D Area */}
      <div className="flex items-center justify-between px-2 py-1 mb-2 text-xs text-slate-400">
        <span className="font-medium text-slate-300 flex items-center gap-1.5">
          <span>📷 照着实物逐面对齐：</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAlignCamera('HOME')}
            className="px-2 py-1 rounded glass-button text-sky-300 text-[11px] font-medium"
            title="一键回正标准视角"
          >
            回正 🏠
          </button>
          {(['TOP', 'FRONT', 'RIGHT', 'BOTTOM', 'LEFT', 'BACK'] as const).map((view) => (
            <button
              key={view}
              onClick={() => onAlignCamera(view)}
              className="px-1.5 py-1 rounded glass-button text-slate-300 hover:text-white text-[10px]"
            >
              {view === 'TOP' ? '顶' : view === 'FRONT' ? '前' : view === 'RIGHT' ? '右' : view === 'BOTTOM' ? '底' : view === 'LEFT' ? '左' : '后'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 2D Net Unfolded Editor */}
      <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 p-2 mb-3 shadow-inner">
        <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-800 text-xs">
          <span className="text-slate-300 font-medium flex items-center gap-1.5">
            <span>2D 展开十字图（与 3D 双向同步）：</span>
          </span>
          <span className="text-[11px] text-slate-400">
            点击小格上色 • 中心块锁定保护
          </span>
        </div>
        <NetEditor
          facelets={paintFacelets}
          problemIndices={validationResult.problemIndices}
          onFaceletClick={handleFaceletClick}
        />
      </div>

      {/* 4. Palette & Quick Tools */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 mb-3">
        <PaintPalette
          selectedColor={selectedPaintColor}
          facelets={paintFacelets}
          onSelectColor={handleSelectColor}
          onResetBlank={() => store.resetPaintToBlank()}
          onResetSolved={() => store.resetPaintToSolved()}
          onFillRandom={() => store.fillPaintWithScramble()}
        />
      </div>

      {/* 5. Validation Bar & AI Tutor Entry CTA */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
        {/* Status Message */}
        {!validationResult.valid ? (
          <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 leading-relaxed">
            <span className="text-base shrink-0">⚠️</span>
            <div className="flex-1">
              <span className="font-semibold block text-amber-200">
                {validationResult.errorCode === 'INCOMPLETE'
                  ? '尚未完成录入'
                  : '魔方物理状态异常（无法还原）'}
              </span>
              <span>{validationResult.message}</span>
            </div>
          </div>
        ) : (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <span className="text-base">✓</span>
            <span className="font-medium">
              魔方 5 重物理合法性校验全部通过！状态合法，可开始求解。
            </span>
          </div>
        )}

        {solveError && (
          <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {solveError}
          </div>
        )}

        {/* Primary CTA Button */}
        <button
          type="button"
          onClick={handleStartSolveAndTutor}
          disabled={!validationResult.valid || isSolving}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-xl ${
            validationResult.valid && !isSolving
              ? 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          {isSolving ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>AI 两阶段 Kociemba 最优解计算中...</span>
            </>
          ) : (
            <>
              <span>✨ AI 算出最优解，开始一步步教我！</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
