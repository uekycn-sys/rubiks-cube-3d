import React, { useState } from 'react';
import { Move } from '../../core/types';
import { CubeEngine } from '../../engine/CubeEngine';

interface QuickTurnBarProps {
  engine: CubeEngine | null;
}

const MOVE_GROUPS: { name: string; moves: Move[] }[] = [
  { name: '顶底', moves: ['U', "U'", 'D', "D'"] },
  { name: '左右', moves: ['L', "L'", 'R', "R'"] },
  { name: '前后', moves: ['F', "F'", 'B', "B'"] },
];

export const QuickTurnBar: React.FC<QuickTurnBarProps> = ({ engine }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTurn = (move: Move) => {
    engine?.applyMove(move);
  };

  return (
    <div className="flex flex-col items-center select-none pointer-events-auto">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1 rounded-full glass-panel border border-slate-700/60 text-slate-400 hover:text-sky-300 text-[11px] font-medium shadow-md transition-all flex items-center gap-1.5"
      >
        <span>🔄</span>
        <span>{isExpanded ? '收起快捷转动盘' : '快捷转动盘 (U/D/L/R/F/B)'}</span>
      </button>

      {/* Expanded Button Rows */}
      {isExpanded && (
        <div className="mt-2 p-2 rounded-2xl glass-panel border border-sky-500/20 shadow-2xl flex items-center gap-3 animate-fade-in">
          {MOVE_GROUPS.map((group) => (
            <div key={group.name} className="flex items-center gap-1">
              {group.moves.map((move) => (
                <button
                  key={move}
                  type="button"
                  onClick={() => handleTurn(move)}
                  className="w-8 h-8 rounded-lg glass-button font-mono font-bold text-xs text-slate-200 hover:text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/40 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  {move}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
