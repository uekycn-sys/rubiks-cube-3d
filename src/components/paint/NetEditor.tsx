import React from 'react';
import { Face } from '../../core/types';
import { CENTER_FACELETS } from '../../core/cubeState';
import { COLOR_TO_HEX_STRING } from '../../engine/themes';

interface NetEditorProps {
  facelets: string;
  problemIndices?: number[];
  onFaceletClick: (index: number) => void;
}

interface FaceSpec {
  face: Face;
  nameZh: string;
  subZh: string;
  offset: number;
}

const FACES: FaceSpec[] = [
  { face: 'U', nameZh: '顶面 (U)', subZh: '白色', offset: 0 },
  { face: 'L', nameZh: '左面 (L)', subZh: '橙色', offset: 36 },
  { face: 'F', nameZh: '正面 (F)', subZh: '绿色', offset: 18 },
  { face: 'R', nameZh: '右面 (R)', subZh: '红色', offset: 9 },
  { face: 'B', nameZh: '背面 (B)', subZh: '蓝色', offset: 45 },
  { face: 'D', nameZh: '底面 (D)', subZh: '黄色', offset: 27 },
];

export const NetEditor: React.FC<NetEditorProps> = ({
  facelets,
  problemIndices = [],
  onFaceletClick,
}) => {
  const renderFaceGrid = (spec: FaceSpec) => {
    return (
      <div className="flex flex-col items-center">
        <div className="text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
          <span>{spec.nameZh}</span>
          <span className="text-slate-500 font-mono text-[9px]">({spec.subZh})</span>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900/80 rounded-lg border border-slate-700/50 shadow-inner">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((subIdx) => {
            const index = spec.offset + subIdx;
            const colorCode = facelets[index] || 'X';
            const isCenter = CENTER_FACELETS.includes(index);
            const isProblem = problemIndices.includes(index);

            const hexColor = colorCode !== 'X' ? COLOR_TO_HEX_STRING[colorCode as Face] : undefined;

            return (
              <button
                key={index}
                type="button"
                onClick={() => onFaceletClick(index)}
                disabled={isCenter}
                title={
                  isCenter
                    ? `${spec.nameZh} 中心块（固定颜色不可修改）`
                    : `第 ${index} 格 - 点击填色`
                }
                style={{
                  backgroundColor: hexColor || 'rgba(30, 41, 59, 0.6)',
                }}
                className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-[5px] transition-all duration-150 flex items-center justify-center ${
                  isCenter
                    ? 'cursor-not-allowed opacity-90 border border-white/20'
                    : 'cursor-pointer hover:scale-105 hover:z-10 hover:shadow-md'
                } ${
                  isProblem
                    ? 'ring-2 ring-rose-500 ring-offset-1 ring-offset-slate-900 animate-pulse'
                    : 'border border-black/30'
                } ${
                  colorCode === 'X'
                    ? 'border-dashed border-slate-600 bg-slate-800/40'
                    : 'shadow-sm'
                }`}
              >
                {/* Center marker */}
                {isCenter && (
                  <div className="w-1.5 h-1.5 rounded-full bg-black/40" />
                )}

                {/* Empty 'X' marker */}
                {colorCode === 'X' && !isCenter && (
                  <span className="text-slate-500 text-[10px] font-mono select-none">+</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const getFaceSpec = (face: Face) => FACES.find((f) => f.face === face)!;

  return (
    <div className="w-full flex flex-col items-center select-none py-2">
      {/* Top Face U */}
      <div className="mb-2">
        {renderFaceGrid(getFaceSpec('U'))}
      </div>

      {/* Middle Row: L - F - R - B */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2 overflow-x-auto max-w-full pb-1">
        {renderFaceGrid(getFaceSpec('L'))}
        {renderFaceGrid(getFaceSpec('F'))}
        {renderFaceGrid(getFaceSpec('R'))}
        {renderFaceGrid(getFaceSpec('B'))}
      </div>

      {/* Bottom Face D */}
      <div>
        {renderFaceGrid(getFaceSpec('D'))}
      </div>
    </div>
  );
};
