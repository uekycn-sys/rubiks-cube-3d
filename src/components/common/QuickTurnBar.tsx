import React, { useState } from 'react';
import { Move } from '../../core/types';
import { CubeEngine } from '../../engine/CubeEngine';

interface QuickTurnBarProps {
  engine: CubeEngine | null;
  highlightMove?: Move | null;
}

const MOVE_GROUPS: { name: string; moves: Move[] }[] = [
  { name: '顶底', moves: ['U', "U'", 'D', "D'"] },
  { name: '左右', moves: ['L', "L'", 'R', "R'"] },
  { name: '前后', moves: ['F', "F'", 'B', "B'"] },
];

export const QuickTurnBar: React.FC<QuickTurnBarProps> = ({ engine, highlightMove = null }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTurn = (move: Move) => {
    engine?.applyMove(move);
  };

  const isMoveHighlighted = (move: Move) => {
    if (!highlightMove) return false;
    if (highlightMove === move) return true;
    // Highlight the clockwise base button with a x2 badge when a 180° move is expected
    if (highlightMove.includes('2') && move === highlightMove[0]) return true;
    return false;
  };

  return (
    <div className="flex flex-col items-center select-none pointer-events-auto">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1 rounded-full glass-panel border border-slate-700/60 text-slate-400 hover:text-sky-300 text-[11px] font-medium shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <span>🔄</span>
        <span>{isExpanded ? '收起快捷转动盘' : '快捷转动盘 (U/D/L/R/F/B)'}</span>
        {highlightMove && !isExpanded && (
          <span className="px-1.5 py-0.2 rounded bg-sky-500/25 text-sky-300 font-mono font-bold text-[10px] border border-sky-400/40">
            建议 {highlightMove}
          </span>
        )}
      </button>

      {/* Expanded Button Rows */}
      {isExpanded && (
        <div className="mt-2 p-2 rounded-2xl glass-panel border border-sky-500/20 shadow-2xl flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-[calc(100vw-2rem)] animate-fade-in">
          {MOVE_GROUPS.map((group) => (
            <div key={group.name} className="flex items-center gap-1">
              {group.moves.map((move) => {
                const highlighted = isMoveHighlighted(move);
                const isDoubleHint = highlighted && highlightMove?.includes('2');
                return (
                  <button
                    key={move}
                    type="button"
                    onClick={() => handleTurn(move)}
                    className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                      highlighted
                        ? 'bg-sky-400 text-slate-950 ring-2 ring-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.8)]'
                        : 'glass-button text-slate-200 hover:text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/40'
                    }`}
                  >
                    {move}
                    {isDoubleHint && (
                      <span className="absolute -top-1.5 -right-1.5 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black leading-tight">
                        ×2
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
