/**
 * Move Translator
 * Translates Singmaster moves into intuitive, plain-Chinese gesture guides
 * strictly adhering to standard holding orientation:
 * White top, Green front, Red right, Orange left, Yellow bottom, Blue back.
 */

import { Move, Face, StepInstruction, LblSolution } from './types';
import { LBL_STAGES } from './lblSolver';

interface MoveMetadata {
  title: string;
  face: Face;
  faceNameZh: string;
  direction: 'CW' | 'CCW' | 'DOUBLE';
  gesture: string;
  explanation: string;
  degrees: number;
}

export const MOVE_METADATA_TABLE: Record<Move, MoveMetadata> = {
  'R': {
    title: '右侧面 · 向上推 90°',
    face: 'R',
    faceNameZh: '右面(红)',
    direction: 'CW',
    gesture: '远离自己方向，顺时针推上去',
    explanation: '右手握住右侧层，大拇指从下方用力向上推转 90°',
    degrees: 90,
  },
  "R'": {
    title: '右侧面 · 向下拉 90°',
    face: 'R',
    faceNameZh: '右面(红)',
    direction: 'CCW',
    gesture: '朝向自己方向，逆时针拉下来',
    explanation: '右手握住右侧层，食指或手掌从上方朝自己方向拉下 90°',
    degrees: -90,
  },
  'R2': {
    title: '右侧面 · 旋转 180°（拧半圈）',
    face: 'R',
    faceNameZh: '右面(红)',
    direction: 'DOUBLE',
    gesture: '拧半圈（向上或向下推转两格皆可）',
    explanation: '右侧层旋转半圈 180°，让上下完全对调',
    degrees: 180,
  },

  'L': {
    title: '左侧面 · 向下拉 90°',
    face: 'L',
    faceNameZh: '左面(橙)',
    direction: 'CW',
    gesture: '朝向自己方向，顺时针拉下来',
    explanation: '左手握住左侧层，从上方朝自己方向拉下 90°（从左视点看为顺时针）',
    degrees: 90,
  },
  "L'": {
    title: '左侧面 · 向上推 90°',
    face: 'L',
    faceNameZh: '左面(橙)',
    direction: 'CCW',
    gesture: '远离自己方向，逆时针推上去',
    explanation: '左手握住左侧层，大拇指从下方用力向上推转 90°',
    degrees: -90,
  },
  'L2': {
    title: '左侧面 · 旋转 180°（拧半圈）',
    face: 'L',
    faceNameZh: '左面(橙)',
    direction: 'DOUBLE',
    gesture: '拧半圈（向上或向下推转两格皆可）',
    explanation: '左侧层旋转半圈 180°，让上下完全对调',
    degrees: 180,
  },

  'U': {
    title: '顶层 · 向左拧 90°',
    face: 'U',
    faceNameZh: '顶层(白)',
    direction: 'CW',
    gesture: '从右往左推，顶面顺时针',
    explanation: '右手食指搭在顶层右后方，向左拨动 90°（俯视顺时针）',
    degrees: 90,
  },
  "U'": {
    title: '顶层 · 向右拧 90°',
    face: 'U',
    faceNameZh: '顶层(白)',
    direction: 'CCW',
    gesture: '从左往右推，顶面逆时针',
    explanation: '左手食指搭在顶层左后方，向右拨动 90°（俯视逆时针）',
    degrees: -90,
  },
  'U2': {
    title: '顶层 · 旋转 180°（拧半圈）',
    face: 'U',
    faceNameZh: '顶层(白)',
    direction: 'DOUBLE',
    gesture: '顶层拧半圈（向左或向右推转两格皆可）',
    explanation: '顶层旋转 180°，前后两排完全对调',
    degrees: 180,
  },

  'D': {
    title: '底层 · 向右拧 90°',
    face: 'D',
    faceNameZh: '底层(黄)',
    direction: 'CW',
    gesture: '从左往右推，底面顺时针',
    explanation: '右手中指或无名指勾住底层左侧，向右拨动 90°（从底面看为顺时针）',
    degrees: 90,
  },
  "D'": {
    title: '底层 · 向左拧 90°',
    face: 'D',
    faceNameZh: '底层(黄)',
    direction: 'CCW',
    gesture: '从右往左推，底面逆时针',
    explanation: '左手中指或无名指勾住底层右侧，向左拨动 90°（从底面看为逆时针）',
    degrees: -90,
  },
  'D2': {
    title: '底层 · 旋转 180°（拧半圈）',
    face: 'D',
    faceNameZh: '底层(黄)',
    direction: 'DOUBLE',
    gesture: '底层拧半圈（向左或向右拨动两格皆可）',
    explanation: '底层旋转 180°，前后位置对调',
    degrees: 180,
  },

  'F': {
    title: '正面 · 顺时针拧 90°',
    face: 'F',
    faceNameZh: '正面(绿)',
    direction: 'CW',
    gesture: '顶部向右倒，顺时针旋转',
    explanation: '正对着绿色面，右手顺时针将整个正面转动 90°（顶部朝右侧倒）',
    degrees: 90,
  },
  "F'": {
    title: '正面 · 逆时针拧 90°',
    face: 'F',
    faceNameZh: '正面(绿)',
    direction: 'CCW',
    gesture: '顶部向左倒，逆时针旋转',
    explanation: '正对着绿色面，左手逆时针将整个正面转动 90°（顶部朝左侧倒）',
    degrees: -90,
  },
  'F2': {
    title: '正面 · 旋转 180°（拧半圈）',
    face: 'F',
    faceNameZh: '正面(绿)',
    direction: 'DOUBLE',
    gesture: '正面旋转半圈 180°',
    explanation: '正面转半圈，正面各色块上下颠倒',
    degrees: 180,
  },

  'B': {
    title: '背面 · 顶部向左拧 90°',
    face: 'B',
    faceNameZh: '背面(蓝)',
    direction: 'CW',
    gesture: '从背面看为顺时针（顶部朝左推）',
    explanation: '右手中指搭在背面顶端向左推动 90°（从背后视角看为顺时针）',
    degrees: 90,
  },
  "B'": {
    title: '背面 · 顶部向右拧 90°',
    face: 'B',
    faceNameZh: '背面(蓝)',
    direction: 'CCW',
    gesture: '从背面看为逆时针（顶部朝右推）',
    explanation: '左手中指搭在背面顶端向右推动 90°（从背后视角看为逆时针）',
    degrees: -90,
  },
  'B2': {
    title: '背面 · 旋转 180°（拧半圈）',
    face: 'B',
    faceNameZh: '背面(蓝)',
    direction: 'DOUBLE',
    gesture: '背面旋转半圈 180°',
    explanation: '背面旋转半圈，各色块上下颠倒',
    degrees: 180,
  },
};

/**
 * Translates a single Singmaster move into a rich step instruction
 */
export function translateMove(move: Move, stepIndex = 0, totalSteps = 1): StepInstruction {
  const meta = MOVE_METADATA_TABLE[move];
  if (!meta) {
    return {
      move,
      stepNumber: stepIndex + 1,
      totalSteps,
      title: `${move} 动作`,
      face: 'U',
      direction: 'CW',
      gesture: '按照标准手法转动',
      explanation: `执行 ${move} 旋转`,
      targetLayer: 'U',
    };
  }

  return {
    move,
    stepNumber: stepIndex + 1,
    totalSteps,
    title: `${move} : ${meta.title}`,
    face: meta.face,
    direction: meta.direction,
    gesture: meta.gesture,
    explanation: meta.explanation,
    targetLayer: meta.face,
  };
}

/**
 * Translates an entire solution array into step instructions
 */
export function translateSolution(solution: Move[]): StepInstruction[] {
  return solution.map((m, idx) => translateMove(m, idx, solution.length));
}

/**
 * Translates an LBL solution into rich step instructions carrying stage, formula, and mnemonic context
 */
export function translateLblSolution(lbl: LblSolution): StepInstruction[] {
  const totalSteps = lbl.moves.length;
  const instructions: StepInstruction[] = [];

  lbl.chunks.forEach((chunk, chunkIdx) => {
    const stageMeta = LBL_STAGES[chunk.stageId - 1];
    chunk.moves.forEach((move, stepInChunk) => {
      const globalIdx = chunk.startMoveIndex + stepInChunk;
      const base = translateMove(move, globalIdx, totalSteps);
      instructions.push({
        ...base,
        stageId: chunk.stageId,
        stageTitle: stageMeta.name,
        formulaName: chunk.formulaName,
        mnemonic: chunk.mnemonic,
        recognitionTip: chunk.recognitionTip,
        chunkIndex: chunkIdx,
        stepInChunk,
        chunkLength: chunk.moves.length,
      });
    });
  });

  return instructions;
}
