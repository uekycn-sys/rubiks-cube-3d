import React, { useState } from 'react';
import { LEVELS, LevelConfig } from '../../data/levels';

interface LevelSelectModalProps {
  unlockedLevels: number;
  onSelectLevel: (level: LevelConfig) => void;
  onClose: () => void;
  onUnlockAll: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  unlockedLevels,
  onSelectLevel,
  onClose,
  onUnlockAll,
}) => {
  const [selectedChapter, setSelectedChapter] = useState<1 | 2 | 3 | 4>(1);

  // Read stars from localStorage
  const getStars = (levelId: number): number => {
    if (typeof localStorage === 'undefined') return 0;
    const val = localStorage.getItem(`level_stars_${levelId}`);
    return val ? parseInt(val, 10) : 0;
  };

  const chapterLevels = LEVELS.filter((l) => l.chapter === selectedChapter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl glass-panel border border-sky-500/30 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 shadow-[0_0_15px_rgba(251,191,36,0.5)] flex items-center justify-center text-lg">
              🏆
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                20 关魔方闯关大师
              </h2>
              <p className="text-xs text-slate-400">
                4 大章节由浅入深 • 解锁三星勋章
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUnlockAll}
              className="px-2.5 py-1 rounded-lg glass-button text-[11px] text-sky-300 font-medium hover:text-white"
              title="测试员一键解锁全部关卡"
            >
              🔓 解锁全关
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl glass-button flex items-center justify-center text-slate-400 hover:text-white text-base"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chapter Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-3 bg-slate-900/60 border-b border-slate-800 text-xs overflow-x-auto">
          {[
            { id: 1, name: '第一章 · 新手启蒙' },
            { id: 2, name: '第二章 · 进阶公式' },
            { id: 3, name: '第三章 · 花式图案' },
            { id: 4, name: '第四章 · 大师试炼' },
          ].map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setSelectedChapter(ch.id as any)}
              className={`px-3 py-2 rounded-xl font-semibold shrink-0 transition-all cursor-pointer ${
                selectedChapter === ch.id
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              {ch.name}
            </button>
          ))}
        </div>

        {/* Level Cards Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
          {chapterLevels.map((lvl) => {
            const isUnlocked = lvl.id <= unlockedLevels;
            const stars = getStars(lvl.id);

            return (
              <div
                key={lvl.id}
                onClick={() => {
                  if (isUnlocked) onSelectLevel(lvl);
                }}
                className={`relative rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between border ${
                  isUnlocked
                    ? 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-700/60 hover:border-sky-400/50 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] cursor-pointer hover:scale-[1.01]'
                    : 'bg-slate-950/60 border-slate-800/40 opacity-60 cursor-not-allowed'
                }`}
              >
                <div>
                  {/* Top Bar: Level Number & Challenge Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-xs font-bold border border-sky-400/30">
                      Lv.{lvl.id}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        lvl.type === 'step_limit'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : lvl.type === 'time_limit'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : lvl.type === 'pattern'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {lvl.type === 'step_limit'
                        ? '严格限步'
                        : lvl.type === 'time_limit'
                        ? '极速限时'
                        : lvl.type === 'pattern'
                        ? '艺术花式'
                        : '标准闯关'}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-sm font-bold text-white mb-0.5">
                    {lvl.title}
                  </h3>
                  <p className="text-xs text-slate-400 mb-2">
                    {lvl.subtitle}
                  </p>
                </div>

                {/* Bottom Bar: Stars or Lock */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {isUnlocked ? (
                    <>
                      <div className="flex items-center gap-1 text-amber-400 text-sm">
                        {'★'.repeat(stars)}
                        {'☆'.repeat(3 - stars)}
                      </div>
                      <span className="text-[11px] text-sky-400 font-medium">
                        开始挑战 ➡️
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <span>🔒</span>
                      <span>通过前一关后解锁</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
