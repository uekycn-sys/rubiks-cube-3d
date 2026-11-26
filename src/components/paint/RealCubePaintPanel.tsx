import React, { useState } from 'react';
import { useCubeStore } from '../../store/useCubeStore';
import { store } from '../../store/cubeStore';
import { NetEditor } from './NetEditor';
import { PaintPalette } from './PaintPalette';
import { CameraScannerModal } from './CameraScannerModal';
import { solveCube } from '../../core/solverService';
import { solveLBL } from '../../core/lblSolver';
import { Face, SolverMethod } from '../../core/types';
import { soundManager } from '../../audio/SoundManager';

interface RealCubePaintPanelProps {
  onAlignCamera: (view: any) => void;
  onEnterTutor: () => void;
}

export const RealCubePaintPanel: React.FC<RealCubePaintPanelProps> = ({
  onAlignCamera,
  onEnterTutor,
}) => {
  const {
    paintFacelets,
    selectedPaintColor,
    validationResult,
    isSolving,
    solveError,
    solverMethod,
  } = useCubeStore();
  const [showScanner, setShowScanner] = useState(false);

  const handleFaceletClick = (index: number) => {
    store.setPaintFacelet(index, selectedPaintColor);
    soundManager.playPaint();
  };

  const handleSelectColor = (color: Face | 'X') => {
    store.setState({ selectedPaintColor: color });
  };

  const handleSelectMethod = (method: SolverMethod) => {
    store.setState({ solverMethod: method });
  };

  const handleStartSolveAndTutor = async () => {
    if (!validationResult.valid || isSolving) return;

    store.setState({ isSolving: true, solveError: null });

    try {
      if (solverMethod === 'lbl') {
        const lbl = solveLBL(paintFacelets);
        store.setupTutor(paintFacelets, lbl.moves, lbl, 'lbl');
      } else {
        const solution = await solveCube(paintFacelets);
        store.setupTutor(paintFacelets, solution, null, 'kociemba');
      }
      store.setState({ isSolving: false });
      onEnterTutor();
    } catch (err: any) {
      console.error('Solve failed:', err);
      store.setState({
        isSolving: false,
        solveError: err?.message || '计算解法失败，请检查魔方状态',
      });
    }
  };

  return (
    <div className="flex flex-col gap-2.5 w-full select-none pb-2">
      {/* 1. Benchmark Holding Orientation Card + Camera Scan CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-900/40 via-blue-900/30 to-indigo-900/40 border border-sky-400/30 p-3 shadow-lg flex flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0 text-base shadow-inner">
            🧭
          </div>
          <div className="flex-1 text-xs leading-relaxed text-slate-200">
            <span className="font-semibold text-sky-300 block mb-0.5 text-xs">
              手持魔方基准方向：
              <strong className="text-white ml-1">白顶(U)</strong> ·{' '}
              <strong className="text-emerald-400">绿前(F)</strong> ·{' '}
              <strong className="text-rose-400">红右(R)</strong>
            </span>
            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2.5 gap-y-0.5">
              <span>左：<strong className="text-amber-500">橙(L)</strong></span>
              <span>底：<strong className="text-yellow-400">黄(D)</strong></span>
              <span>背：<strong className="text-blue-400">蓝(B)</strong></span>
              <span className="text-slate-500">• 支持 3D 点选或摄像头扫描</span>
            </div>
          </div>
        </div>

        {/* Camera Scan Entry Button */}
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/25 to-sky-500/25 hover:from-cyan-500/40 hover:to-sky-500/40 border border-cyan-400/50 text-cyan-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
        >
          <span>📷</span>
          <span>摄像头实时扫描自动填色（推荐）</span>
        </button>
      </div>

      {/* 2. Camera Align Quick Buttons on 3D Area */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <span className="font-medium text-slate-300 text-[11px] whitespace-nowrap">
          📷 逐面视角对齐：
        </span>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <button
            onClick={() => onAlignCamera('HOME')}
            className="px-2 py-1 rounded glass-button text-sky-300 text-[11px] font-medium cursor-pointer"
            title="一键回正标准视角"
          >
            回正 🏠
          </button>
          {(['TOP', 'FRONT', 'RIGHT', 'BOTTOM', 'LEFT', 'BACK'] as const).map((view) => (
            <button
              key={view}
              onClick={() => onAlignCamera(view)}
              className="px-1.5 py-1 rounded glass-button text-slate-300 hover:text-white text-[10px] cursor-pointer"
            >
              {view === 'TOP' ? '顶' : view === 'FRONT' ? '前' : view === 'RIGHT' ? '右' : view === 'BOTTOM' ? '底' : view === 'LEFT' ? '左' : '后'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 2D Net Unfolded Editor */}
      <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 p-2 shadow-inner">
        <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1.5 border-b border-slate-800 text-[11px]">
          <span className="text-slate-300 font-medium">
            2D 展开十字图（3D 双向同步）
          </span>
          <span className="text-[10px] text-slate-400">
            点击小格上色 • 中心锁定
          </span>
        </div>
        <NetEditor
          facelets={paintFacelets}
          problemIndices={validationResult.problemIndices}
          onFaceletClick={handleFaceletClick}
        />
      </div>

      {/* 4. Palette & Quick Tools */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-2.5">
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

        {/* Strategy Selector: LBL Learning vs Kociemba Fast */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => handleSelectMethod('lbl')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              solverMethod === 'lbl'
                ? 'bg-gradient-to-r from-sky-500 to-emerald-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🎓 层先法教学（推荐学会）
          </button>
          <button
            type="button"
            onClick={() => handleSelectMethod('kociemba')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              solverMethod === 'kociemba'
                ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ AI 极速最优解 (~20步)
          </button>
        </div>

        {/* Primary CTA Button */}
        <button
          type="button"
          onClick={handleStartSolveAndTutor}
          disabled={!validationResult.valid || isSolving}
          className={`w-full py-3 px-6 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-xl ${
            validationResult.valid && !isSolving
              ? 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          {isSolving ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>AI 正在计算解法...</span>
            </>
          ) : (
            <>
              <span>
                {solverMethod === 'lbl'
                  ? '🎓 生成层先法 7 步教程，带我复原！'
                  : '✨ AI 算出最优解，开始一步步教我！'}
              </span>
            </>
          )}
        </button>

        {/* Direct Interactive LBL Practice CTA */}
        {validationResult.valid && (
          <button
            type="button"
            onClick={() => store.startLearnWithFacelets(paintFacelets)}
            className="w-full py-2 px-4 rounded-xl glass-button text-emerald-300 hover:text-white text-xs font-semibold cursor-pointer"
          >
            🖐️ 直接进入「层先法学院」亲手跟练此魔方
          </button>
        )}
      </div>

      {/* Camera Real-Time Scanner Modal */}
      {showScanner && (
        <CameraScannerModal
          onComplete={(scannedFacelets) => {
            store.setPaintFacelets(scannedFacelets);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};
