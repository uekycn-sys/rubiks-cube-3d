import React, { useEffect } from 'react';
import { Face } from '../../core/types';
import { COLOR_TO_HEX_STRING } from '../../engine/themes';

interface PaintPaletteProps {
  selectedColor: Face | 'X';
  facelets: string;
  onSelectColor: (color: Face | 'X') => void;
  onResetBlank: () => void;
  onResetSolved: () => void;
  onFillRandom: () => void;
}

interface ColorOption {
  code: Face;
  nameZh: string;
  key: string;
  bgHex: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  { code: 'U', nameZh: '白', key: '1', bgHex: COLOR_TO_HEX_STRING.U },
  { code: 'R', nameZh: '红', key: '2', bgHex: COLOR_TO_HEX_STRING.R },
  { code: 'F', nameZh: '绿', key: '3', bgHex: COLOR_TO_HEX_STRING.F },
  { code: 'D', nameZh: '黄', key: '4', bgHex: COLOR_TO_HEX_STRING.D },
  { code: 'L', nameZh: '橙', key: '5', bgHex: COLOR_TO_HEX_STRING.L },
  { code: 'B', nameZh: '蓝', key: '6', bgHex: COLOR_TO_HEX_STRING.B },
];

export const PaintPalette: React.FC<PaintPaletteProps> = ({
  selectedColor,
  facelets,
  onSelectColor,
  onResetBlank,
  onResetSolved,
  onFillRandom,
}) => {
  // Compute counts for each color in current facelets
  const counts: Record<string, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0, X: 0 };
  for (let i = 0; i < facelets.length; i++) {
    const c = facelets[i];
    if (counts[c] !== undefined) {
      counts[c]++;
    }
  }

  // Keyboard shortcut listener (1-6 for colors, 0 or E for eraser)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key) {
        case '1': onSelectColor('U'); break;
        case '2': onSelectColor('R'); break;
        case '3': onSelectColor('F'); break;
        case '4': onSelectColor('D'); break;
        case '5': onSelectColor('L'); break;
        case '6': onSelectColor('B'); break;
        case '0':
        case 'e':
        case 'E':
          onSelectColor('X');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectColor]);

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* 6 Color Buttons + Eraser */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        {COLOR_OPTIONS.map((opt) => {
          const count = counts[opt.code];
          const isSelected = selectedColor === opt.code;
          const isFull = count === 9;
          const isOver = count > 9;

          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => onSelectColor(opt.code)}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all duration-200 ${
                isSelected
                  ? 'bg-sky-500/20 ring-2 ring-sky-400 scale-105 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                  : 'hover:bg-slate-800/60'
              }`}
            >
              {/* Color swatch circle */}
              <div
                style={{ backgroundColor: opt.bgHex }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shadow-md border border-white/20 flex items-center justify-center text-xs font-bold font-mono text-black/80"
              >
                {opt.key}
              </div>

              {/* Name & Count Pill */}
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-300 font-medium">{opt.nameZh}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-semibold ${
                    isFull
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isOver
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/60 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}/9{isFull && '✓'}
                </span>
              </div>
            </button>
          );
        })}

        {/* Eraser Button */}
        <button
          type="button"
          onClick={() => onSelectColor('X')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all duration-200 ${
            selectedColor === 'X'
              ? 'bg-sky-500/20 ring-2 ring-sky-400 scale-105 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
              : 'hover:bg-slate-800/60'
          }`}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-800 border border-dashed border-slate-500 shadow-md flex items-center justify-center text-xs text-slate-300 font-medium">
            擦除
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            未填: {counts.X}
          </div>
        </button>
      </div>

      {/* Quick Action Helpers */}
      <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 pt-1.5 border-t border-slate-700/40 text-[11px]">
        <button
          type="button"
          onClick={onResetBlank}
          className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-all font-medium whitespace-nowrap cursor-pointer"
        >
          清空填色
        </button>
        <span className="text-slate-700">•</span>
        <button
          type="button"
          onClick={onResetSolved}
          className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-all font-medium whitespace-nowrap cursor-pointer"
        >
          还原初始状态
        </button>
        <span className="text-slate-700">•</span>
        <button
          type="button"
          onClick={onFillRandom}
          className="px-2 py-1 rounded-lg text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-all font-medium whitespace-nowrap cursor-pointer"
        >
          🎲 随机填入测试状态
        </button>
      </div>
    </div>
  );
};
