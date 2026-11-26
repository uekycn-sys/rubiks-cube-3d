/**
 * Pure TypeScript 7-Stage Layer-by-Layer (LBL / 层先法) Solver & Curriculum Engine
 *
 * Canonical Handheld Orientation (Zero Cube-Flipping):
 *   Top (U) = White, Bottom (D) = Yellow,
 *   Front (F) = Green, Right (R) = Red, Left (L) = Orange, Back (B) = Blue.
 *
 * Builds bottom Yellow -> Middle Layer -> top White so U/D/L/R/F/B gestures,
 * QuickTurnBar, and 3D arrows stay 100% consistent across all 7 stages.
 */

import {
  Face,
  INVERSE_MOVES,
  LblCameraView,
  LblChunk,
  LblProgressReport,
  LblSolution,
  LblStageId,
  LblStageMeta,
  Move,
  SOLVED_FACELETS,
} from './types';
import { CORNER_FACELETS, CubeState, EDGE_FACELETS } from './cubeState';

export const LBL_STAGES: LblStageMeta[] = [
  {
    id: 1,
    name: '第一阶段 · 底层黄色十字',
    shortName: '底十字',
    goal: '把 4 个带黄色的棱块拼到底层(D)，且侧面颜色与绿/红/蓝/橙中心对齐',
    formulaDisplay: 'S2 或 U\' R\' F R（先升到顶层再归位）',
    mnemonic: '先升顶层对齐色，黄朝顶转两圈，黄朝外侧绕一下',
    tip: '观察底层中心(黄)周围的 4 个棱块，先找在顶层(U)的黄色棱块最简单。',
  },
  {
    id: 2,
    name: '第二阶段 · 底层四角归位',
    shortName: '底角块',
    goal: '把 4 个带黄色的角块装入底层四角，完成一整层黄色底面',
    formulaDisplay: '右手上勾下回：R U R\' U\'（或前位 U R U\' R\'）',
    mnemonic: '黄角移到目标正上方：朝右做上勾下回，朝前先推再做，朝顶连做三遍',
    tip: '只要把目标黄角对准对应槽位正上方，核心动作永远只是「上勾下回」。',
  },
  {
    id: 3,
    name: '第三阶段 · 中层四棱归位',
    shortName: '中层棱',
    goal: '把不含白色的 4 个中层棱块装入中间层，完成底两层（F2L）',
    formulaDisplay: '右入：U R U\' R\' U\' F\' U F ｜ 左入：U\' L\' U L U F U\' F\'',
    mnemonic: '顶棱对齐中心成 T 字，先往反方向躲开，做一遍上勾下回，再换面推回',
    tip: '只在顶层找「不含白色」的棱块，让正面色和中心对齐后再决定往左还是往右。',
  },
  {
    id: 4,
    name: '第四阶段 · 顶层白色十字',
    shortName: '顶十字',
    goal: '在白色顶面(U)拼出白色十字（暂不要求侧面颜色对齐）',
    formulaDisplay: 'F (R U R\' U\') F\'',
    mnemonic: '前面顺转放倒，做一遍右手上勾下回，前面逆转立起',
    tip: '记住口诀摆位：点状直接做；直角摆在左上角(9点钟)；一字摆成水平横线。',
  },
  {
    id: 5,
    name: '第五阶段 · 顶面全白（小鱼公式）',
    shortName: '顶全白',
    goal: '让顶面 4 个角块的白色全部朝上，实现顶面全白',
    formulaDisplay: '小鱼一式：R U R\' U R U2 R\' ｜ 二式：R U2 R\' U\' R U\' R\'',
    mnemonic: '上勾下勾上转两圈下（小鱼鱼头朝左前或右后，最多两遍必全白）',
    tip: '当顶面只有 1 个白角时就像一条小鱼；若出现 0 或 2 个白角，先做一遍小鱼即可变出鱼形。',
  },
  {
    id: 6,
    name: '第六阶段 · 顶层角块归位',
    shortName: '顶四角',
    goal: '让顶层 4 个角块各自的侧面颜色与四周颜色一致',
    formulaDisplay: '双眼换角 (T-Perm)：R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'',
    mnemonic: '找到同色双眼摆左边，执行双眼换角公式，再拧顶层对齐',
    tip: '观察顶层四条侧边有没有两只同色角块（「双眼/车灯」），摆到左手边做一次公式即可！',
  },
  {
    id: 7,
    name: '第七阶段 · 顶层棱块归位（大功告成）',
    shortName: '顶四棱',
    goal: '调整顶层最后 3 个或 4 个棱块位置，彻底还原六面魔方！',
    formulaDisplay: '顺三棱：R U\' R U R U R U\' R\' U\' R2 ｜ 逆三棱：R2 U R U R\' U\' R\' U\' R\' U R\'',
    mnemonic: '完整一面摆背后，剩下三棱顺/逆三循环一次即全盘复原！',
    tip: '若四面都还没有完整条，先任做一遍三棱公式就会出现一面完整，把它转到背面再来一遍！',
  },
];

// Y-axis rotation: 0=F front, 1=R front, 2=B front, 3=L front
const FACE_CW_ORDER: Face[] = ['F', 'R', 'B', 'L'];

const VIEW_BY_ROT: LblCameraView[] = ['HOME', 'ISO_BR', 'ISO_BL', 'ISO_FL'];

export function conjugateFace(face: Face, rot: 0 | 1 | 2 | 3): Face {
  if (face === 'U' || face === 'D') return face;
  const idx = FACE_CW_ORDER.indexOf(face);
  return FACE_CW_ORDER[(idx + rot) % 4];
}

export function conjugateMove(move: Move, rot: 0 | 1 | 2 | 3): Move {
  if (rot === 0) return move;
  const face = move[0] as Face;
  const suffix = move.slice(1);
  return `${conjugateFace(face, rot)}${suffix}` as Move;
}

export function conjugateMoves(moves: Move[], rot: 0 | 1 | 2 | 3): Move[] {
  if (rot === 0) return [...moves];
  return moves.map((m) => conjugateMove(m, rot));
}

function moveToRhythm(move: Move, customHint?: string): string {
  if (customHint) return customHint;
  const face = move[0] as Face;
  const isCCW = move.includes("'");
  const is2 = move.includes('2');
  if (is2) {
    if (face === 'U') return '顶180°';
    if (face === 'R') return '右180°';
    if (face === 'F') return '前180°';
    if (face === 'L') return '左180°';
    if (face === 'B') return '后180°';
    return '底180°';
  }
  switch (face) {
    case 'R':
      return isCCW ? '右下' : '右上';
    case 'L':
      return isCCW ? '左上' : '左下';
    case 'U':
      return isCCW ? '顶右' : '顶左';
    case 'D':
      return isCCW ? '底左' : '底右';
    case 'F':
      return isCCW ? '前逆' : '前顺';
    case 'B':
      return isCCW ? '后逆' : '后顺';
  }
}

function makeSexyRhythms(rot: 0 | 1 | 2 | 3): string[] {
  if (rot === 0) return ['右上', '顶左', '右下', '顶右'];
  return [
    `${conjugateFace('R', rot)}顺`,
    '顶左',
    `${conjugateFace('R', rot)}逆`,
    '顶右',
  ];
}

function uAlignmentMoves(stepsCW: number): Move[] {
  const n = ((stepsCW % 4) + 4) % 4;
  if (n === 1) return ['U'];
  if (n === 2) return ['U2'];
  if (n === 3) return ["U'"];
  return [];
}

/**
 * Evaluates which of the 7 LBL stages are currently solved.
 */
export function evaluateLblProgress(facelets: string): LblProgressReport {
  const s1 =
    facelets[31] === 'D' &&
    facelets[28] === 'D' && facelets[25] === 'F' &&
    facelets[32] === 'D' && facelets[16] === 'R' &&
    facelets[34] === 'D' && facelets[52] === 'B' &&
    facelets[30] === 'D' && facelets[43] === 'L';

  const s2 =
    s1 &&
    facelets[29] === 'D' && facelets[26] === 'F' && facelets[15] === 'R' &&
    facelets[35] === 'D' && facelets[17] === 'R' && facelets[51] === 'B' &&
    facelets[33] === 'D' && facelets[53] === 'B' && facelets[42] === 'L' &&
    facelets[27] === 'D' && facelets[44] === 'L' && facelets[24] === 'F';

  const s3 =
    s2 &&
    facelets[23] === 'F' && facelets[12] === 'R' &&
    facelets[48] === 'B' && facelets[14] === 'R' &&
    facelets[50] === 'B' && facelets[39] === 'L' &&
    facelets[21] === 'F' && facelets[41] === 'L';

  const s4 =
    s3 &&
    facelets[4] === 'U' &&
    facelets[1] === 'U' &&
    facelets[3] === 'U' &&
    facelets[5] === 'U' &&
    facelets[7] === 'U';

  const s5 =
    s4 &&
    facelets[0] === 'U' &&
    facelets[2] === 'U' &&
    facelets[6] === 'U' &&
    facelets[8] === 'U';

  const s6 =
    s5 &&
    facelets[18] === 'F' && facelets[20] === 'F' &&
    facelets[9] === 'R' && facelets[11] === 'R' &&
    facelets[45] === 'B' && facelets[47] === 'B' &&
    facelets[36] === 'L' && facelets[38] === 'L';

  const s7 = facelets === SOLVED_FACELETS;

  const completedStages = [s1, s2, s3, s4, s5, s6, s7];
  const firstIncompleteIdx = completedStages.findIndex((done) => !done);
  const currentStage: LblStageId | null =
    firstIncompleteIdx === -1 ? null : ((firstIncompleteIdx + 1) as LblStageId);
  const completedCount = completedStages.filter(Boolean).length;

  return {
    completedStages,
    currentStage,
    isSolved: s7,
    completedCount,
    currentStageMeta: currentStage ? LBL_STAGES[currentStage - 1] : null,
  };
}

/**
 * Finds the current slot index (0..11) containing an edge with colors (cA, cB).
 */
function findEdgeSlot(facelets: string, cA: Face, cB: Face): number {
  for (let i = 0; i < EDGE_FACELETS.length; i++) {
    const [a, b] = EDGE_FACELETS[i];
    const fa = facelets[a];
    const fb = facelets[b];
    if ((fa === cA && fb === cB) || (fa === cB && fb === cA)) {
      return i;
    }
  }
  return -1;
}

/**
 * Finds the current slot index (0..7) containing a corner with colors (cA, cB, cC).
 */
function findCornerSlot(facelets: string, cA: Face, cB: Face, cC: Face): number {
  const target = [cA, cB, cC].sort().join('');
  for (let i = 0; i < CORNER_FACELETS.length; i++) {
    const [a, b, c] = CORNER_FACELETS[i];
    const colors = [facelets[a], facelets[b], facelets[c]].sort().join('');
    if (colors === target) {
      return i;
    }
  }
  return -1;
}

// U-layer edge target rot mapping: UF(1)->0, UR(0)->1, UB(3)->2, UL(2)->3
const U_EDGE_TARGET_ROT: Record<number, number> = {
  1: 0, // UF -> F (rot 0)
  0: 1, // UR -> R (rot 1)
  3: 2, // UB -> B (rot 2)
  2: 3, // UL -> L (rot 3)
};

// U-layer corner slots in CW order (looking from top U):
// URF(0) -> UFL(1) -> ULB(2) -> UBR(3)
const U_CORNER_CW_SLOTS = [0, 1, 2, 3];

// Standard algorithms
const SUNE: Move[] = ['R', 'U', "R'", 'U', 'R', 'U2', "R'"];
const ANTI_SUNE: Move[] = ['R', 'U2', "R'", "U'", 'R', "U'", "R'"];
const OLL_CROSS: Move[] = ['F', 'R', 'U', "R'", "U'", "F'"];
const T_PERM: Move[] = ['R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'", "U'", 'R', 'U', "R'", "F'"];
const UA_PERM: Move[] = ['R', "U'", 'R', 'U', 'R', 'U', 'R', "U'", "R'", "U'", 'R2'];
const UB_PERM: Move[] = ['R2', 'U', 'R', 'U', "R'", "U'", "R'", "U'", "R'", 'U', "R'"];

const FACE_ZH: Record<Face, string> = {
  U: '白',
  D: '黄',
  F: '绿',
  R: '红',
  B: '蓝',
  L: '橙',
};

/**
 * Generates a full 7-Stage Layer-by-Layer (层先法) solution with pedagogical chunks.
 */
export function solveLBL(initialFacelets: string): LblSolution {
  const initialReport = evaluateLblProgress(initialFacelets);
  if (initialReport.isSolved) {
    return {
      moves: [],
      chunks: [],
      stageStartIndices: {},
      initialCompletedStages: initialReport.completedStages,
    };
  }

  const sim = new CubeState(initialFacelets);
  const allMoves: Move[] = [];
  const chunks: LblChunk[] = [];
  const stageStartIndices: Partial<Record<LblStageId, number>> = {};

  const emitChunk = (params: Omit<LblChunk, 'id' | 'startMoveIndex' | 'rhythms'> & { rhythms?: string[] }) => {
    if (params.moves.length === 0) return;
    if (stageStartIndices[params.stageId] === undefined) {
      stageStartIndices[params.stageId] = allMoves.length;
    }
    const startMoveIndex = allMoves.length;
    const rhythms = params.rhythms && params.rhythms.length === params.moves.length
      ? params.rhythms
      : params.moves.map((m) => moveToRhythm(m));

    chunks.push({
      id: `chunk_${chunks.length}_${params.stageId}`,
      ...params,
      rhythms,
      startMoveIndex,
    });

    sim.applyMoves(params.moves);
    allMoves.push(...params.moves);
  };

  // =========================================================================
  // STAGE 1: Bottom Yellow Cross (DF, DR, DB, DL)
  // =========================================================================
  const dEdgeTargets: Array<{ side: Face; rot: 0 | 1 | 2 | 3; dIdx: number; sIdx: number }> = [
    { side: 'F', rot: 0, dIdx: 28, sIdx: 25 },
    { side: 'R', rot: 1, dIdx: 32, sIdx: 16 },
    { side: 'B', rot: 2, dIdx: 34, sIdx: 52 },
    { side: 'L', rot: 3, dIdx: 30, sIdx: 43 },
  ];

  for (const target of dEdgeTargets) {
    let f = sim.getFacelets();
    if (f[target.dIdx] === 'D' && f[target.sIdx] === target.side) {
      continue; // Already solved in place
    }

    let slot = findEdgeSlot(f, 'D', target.side);
    const sideZh = FACE_ZH[target.side];

    // Step 1a: If currently in D layer (4..7), lift straight up to U via S2
    if (slot >= 4 && slot <= 7) {
      const slotFaceMap: Record<number, { face: Face; rot: 0 | 1 | 2 | 3 }> = {
        5: { face: 'F', rot: 0 },
        4: { face: 'R', rot: 1 },
        7: { face: 'B', rot: 2 },
        6: { face: 'L', rot: 3 },
      };
      const info = slotFaceMap[slot];
      emitChunk({
        stageId: 1,
        title: `升起黄-${sideZh}棱块到顶层`,
        formulaName: '升顶准备',
        formulaNotation: `${info.face}2`,
        mnemonic: '把错位或翻面的底层棱块转 180° 升到顶层，不破坏其他底棱',
        recognitionTip: `黄-${sideZh}棱块目前卡在底层，先转半圈升到顶层再对齐。`,
        moves: [`${info.face}2` as Move],
        recommendedView: VIEW_BY_ROT[info.rot],
        highlightFacelets: [...EDGE_FACELETS[slot]],
      });
      f = sim.getFacelets();
      slot = findEdgeSlot(f, 'D', target.side);
    }

    // Step 1b: If currently in middle layer (8..11), extract safely to U without disturbing solved D edges
    if (slot >= 8 && slot <= 11) {
      // Mid-layer extractors that restore the D slice:
      // 8 FR: R U R'   (rot 0)
      // 9 FL: L' U L   (rot 0)
      // 10 BL: L U L'
      // 11 BR: R' U R
      const midExtractMap: Record<number, { moves: Move[]; rot: 0 | 1 | 2 | 3 }> = {
        8: { moves: ['R', 'U', "R'"], rot: 0 },
        11: { moves: ["R'", 'U', 'R'], rot: 1 },
        10: { moves: ['L', 'U', "L'"], rot: 2 },
        9: { moves: ["L'", 'U', 'L'], rot: 3 },
      };
      const ext = midExtractMap[slot];
      emitChunk({
        stageId: 1,
        title: `提出中层黄-${sideZh}棱块`,
        formulaName: '中层提棱',
        formulaNotation: ext.moves.join(' '),
        mnemonic: '转到顶层 -> 拨开 -> 马上把下面转回去保护已拼好的底棱',
        recognitionTip: `黄-${sideZh}棱块在中层，先用三步安全提到顶层。`,
        moves: ext.moves,
        recommendedView: VIEW_BY_ROT[ext.rot],
        highlightFacelets: [...EDGE_FACELETS[slot]],
      });
      f = sim.getFacelets();
      slot = findEdgeSlot(f, 'D', target.side);
    }

    // Step 1c: Now in U layer (0..3). Align above target side using U/U'/U2.
    const currentPosRot = U_EDGE_TARGET_ROT[slot];
    // Looking from top: U moves UF(0) -> UL(3) -> UB(2) -> UR(1) -> UF(0) (rot decreases by 1 mod 4)
    // Wait: let's compute exact U turns needed: if currentPosRot === 1 (UR) and target.rot === 0 (UF),
    // U moves UR -> UF! Wait: U moves F->L->B->R, so R->F is U' or U?
    // Let's check with MOVE_PERMUTATIONS or trace:
    // U (CW from top): R -> F -> L -> B -> R!
    // Yes! Looking down at a clock on top: 3 o'clock (R) moves to 6 o'clock (F), 6 (F) -> 9 (L), 9 (L) -> 12 (B), 12 (B) -> 3 (R)!
    // So 1 CW U move increases rot? F(0)->L(3) decreases by 1 mod 4! R(1)->F(0) decreases by 1 mod 4!
    // Therefore deltaCW = (currentPosRot - target.rot + 4) % 4!
    const deltaCW = (currentPosRot - target.rot + 4) % 4;
    if (deltaCW !== 0) {
      const alignMoves = uAlignmentMoves(deltaCW);
      emitChunk({
        stageId: 1,
        title: `顶层对齐黄-${sideZh}棱块`,
        formulaName: '顶层对位',
        formulaNotation: alignMoves.join(' '),
        mnemonic: `转动顶层，把黄-${sideZh}棱块送到${sideZh}色中心正上方`,
        recognitionTip: `在顶层找到黄-${sideZh}棱块，对齐到对应侧面正上方。`,
        moves: alignMoves,
        recommendedView: VIEW_BY_ROT[target.rot],
        highlightFacelets: [...EDGE_FACELETS[slot]],
      });
      f = sim.getFacelets();
      slot = findEdgeSlot(f, 'D', target.side);
    }

    // Step 1d: Insert from U above target side into D
    const [uIdx] = EDGE_FACELETS[slot];
    if (f[uIdx] === 'D') {
      // Yellow faces UP: simple 180° drop
      const dropMove = `${target.side}2` as Move;
      emitChunk({
        stageId: 1,
        title: `落入底层 · 黄-${sideZh}棱归位`,
        formulaName: '直落底层',
        formulaNotation: dropMove,
        mnemonic: '黄色朝顶且侧面已对齐，直接向下转半圈(180°)落入底层',
        recognitionTip: `黄-${sideZh}棱黄色朝上、${sideZh}色朝外，转 180° 一步归位！`,
        moves: [dropMove],
        recommendedView: VIEW_BY_ROT[target.rot],
        highlightFacelets: [...EDGE_FACELETS[slot]],
      });
    } else {
      // Yellow faces outward on side: flip-insert conjugated U' R' F R
      const flipInsert = conjugateMoves(["U'", "R'", 'F', 'R'], target.rot);
      emitChunk({
        stageId: 1,
        title: `翻转落位 · 黄-${sideZh}棱归位`,
        formulaName: '侧翻入底',
        formulaNotation: flipInsert.join(' '),
        mnemonic: '先向右让一格 -> 右侧拉下 -> 正面顺转入底 -> 右侧推回护底',
        recognitionTip: `黄-${sideZh}棱的黄色朝外侧面，用侧翻四步即可在不破坏已拼底棱下翻转入底。`,
        moves: flipInsert,
        recommendedView: VIEW_BY_ROT[target.rot],
        highlightFacelets: [...EDGE_FACELETS[slot]],
      });
    }
  }

  // =========================================================================
  // STAGE 2: Bottom Layer Yellow Corners (DFR, DRB, DBL, DLF)
  // =========================================================================
  const dCornerTargets: Array<{
    c1: Face;
    c2: Face;
    rot: 0 | 1 | 2 | 3;
    dIdx: number;
    fIdx: number;
    rIdx: number;
    uSlot: number;
    dSlot: number;
  }> = [
    { c1: 'F', c2: 'R', rot: 0, dIdx: 29, fIdx: 26, rIdx: 15, uSlot: 0, dSlot: 4 }, // DFR, above is URF(0)
    { c1: 'R', c2: 'B', rot: 1, dIdx: 35, fIdx: 17, rIdx: 51, uSlot: 3, dSlot: 7 }, // DRB, above is UBR(3)
    { c1: 'B', c2: 'L', rot: 2, dIdx: 33, fIdx: 53, rIdx: 42, uSlot: 2, dSlot: 6 }, // DBL, above is ULB(2)
    { c1: 'L', c2: 'F', rot: 3, dIdx: 27, fIdx: 44, rIdx: 24, uSlot: 1, dSlot: 5 }, // DLF, above is UFL(1)
  ];

  // D slot (4..7) -> which rot's DFR it corresponds to
  const D_CORNER_SLOT_ROT: Record<number, 0 | 1 | 2 | 3> = {
    4: 0, // DFR
    7: 1, // DRB
    6: 2, // DBL
    5: 3, // DLF
  };

  for (const target of dCornerTargets) {
    let f = sim.getFacelets();
    if (f[target.dIdx] === 'D' && f[target.fIdx] === target.c1 && f[target.rIdx] === target.c2) {
      continue;
    }

    let slot = findCornerSlot(f, 'D', target.c1, target.c2);
    const labelZh = `黄-${FACE_ZH[target.c1]}-${FACE_ZH[target.c2]}`;

    // Step 2a: If stuck in D layer (4..7), pop it out to U using conjugated R U R' U'
    if (slot >= 4 && slot <= 7) {
      const slotRot = D_CORNER_SLOT_ROT[slot];
      const popMoves = conjugateMoves(['R', 'U', "R'", "U'"], slotRot);
      emitChunk({
        stageId: 2,
        title: `弹出错位底角 (${labelZh})`,
        formulaName: '上勾下回（弹出）',
        formulaNotation: popMoves.join(' '),
        mnemonic: '先把卡在底层的角块用一遍「上勾下回」顶到顶层',
        recognitionTip: `${labelZh}角块卡在底层且方向或位置不对，做一遍上勾下回弹出到顶层。`,
        moves: popMoves,
        rhythms: makeSexyRhythms(slotRot),
        recommendedView: VIEW_BY_ROT[slotRot],
        highlightFacelets: [...CORNER_FACELETS[slot]],
      });
      f = sim.getFacelets();
      slot = findCornerSlot(f, 'D', target.c1, target.c2);
    }

    // Step 2b: Align above target D slot (so it reaches target.uSlot)
    // U CW order: 0(URF) -> 1(UFL) -> 2(ULB) -> 3(UBR) -> 0
    const curIdx = U_CORNER_CW_SLOTS.indexOf(slot);
    const tgtIdx = U_CORNER_CW_SLOTS.indexOf(target.uSlot);
    const deltaCW = (tgtIdx - curIdx + 4) % 4;
    if (deltaCW !== 0) {
      const alignMoves = uAlignmentMoves(deltaCW);
      emitChunk({
        stageId: 2,
        title: `对准目标角位正上方 (${labelZh})`,
        formulaName: '顶层对位',
        formulaNotation: alignMoves.join(' '),
        mnemonic: `把 ${labelZh} 角块转到${FACE_ZH[target.c1]}与${FACE_ZH[target.c2]}夹角正上方`,
        recognitionTip: `在顶层找到${labelZh}角块，拧动顶层让它来到目标槽位正上方。`,
        moves: alignMoves,
        recommendedView: VIEW_BY_ROT[target.rot],
        highlightFacelets: [...CORNER_FACELETS[slot]],
      });
      f = sim.getFacelets();
      slot = findCornerSlot(f, 'D', target.c1, target.c2);
    }

    // Step 2c: Check yellow sticker orientation on CORNER_FACELETS[slot] = [U_facelet, R_facelet_in_rot, F_facelet_in_rot]
    // Verify order in CORNER_FACELETS:
    // 0 URF: [8(U), 9(R), 20(F)]   -> index 0=U, 1=localR, 2=localF
    // 1 UFL: [6(U), 18(F), 38(L)]  -> index 0=U, 1=localR(F), 2=localF(L)
    // 2 ULB: [0(U), 36(L), 47(B)]  -> index 0=U, 1=localR(L), 2=localF(B)
    // 3 UBR: [2(U), 45(B), 11(R)]  -> index 0=U, 1=localR(B), 2=localF(R)
    const [uF, localRF, localFF] = CORNER_FACELETS[slot];
    if (f[localRF] === 'D') {
      // Yellow faces local R -> 1x R U R' U'
      const insertMoves = conjugateMoves(['R', 'U', "R'", "U'"], target.rot);
      emitChunk({
        stageId: 2,
        title: `装入底角 (${labelZh})`,
        formulaName: '右手上勾下回',
        formulaNotation: insertMoves.join(' '),
        mnemonic: '黄色朝右：直接做 1 遍「上勾下回」完美装入！',
        recognitionTip: `角块在目标正上方且黄色朝右侧，做一遍上勾下回即可归位。`,
        moves: insertMoves,
        rhythms: makeSexyRhythms(target.rot),
        recommendedView: VIEW_BY_ROT[target.rot],
        highlightFacelets: [...CORNER_FACELETS[slot]],
      });
    } else if (f[localFF] === 'D') {
      // Yellow faces local F -> U R U' R' (front-facing sexy inverse)
      const insertMoves = conjugateMoves(['U', 'R', "U'", "R'"], target.rot);
      emitChunk({
        stageId: 2,
        title: `前位装入底角 (${labelZh})`,
        formulaName: '前位勾上推下',
        formulaNotation: insertMoves.join(' '),
        mnemonic: '黄色朝前：先顶层左拨避让 -> 右上 -> 顶回 -> 右下，一步到位！',
        recognitionTip: `角块黄色朝向正前方，使用「勾上推下」四步直接切入底层。`,
        moves: insertMoves,
        rhythms: ['顶左', `${conjugateFace('R', target.rot)}顺`, '顶右', `${conjugateFace('R', target.rot)}逆`],
        recommendedView: VIEW_BY_ROT[target.rot],
        highlightFacelets: [...CORNER_FACELETS[slot]],
      });
    } else if (f[uF] === 'D') {
      // Yellow faces UP -> 3 rounds of R U R' U'
      for (let round = 1; round <= 3; round++) {
        const roundMoves = conjugateMoves(['R', 'U', "R'", "U'"], target.rot);
        const curFacelets = sim.getFacelets();
        const curSlot = findCornerSlot(curFacelets, 'D', target.c1, target.c2);
        emitChunk({
          stageId: 2,
          title: `黄朝顶装入 (${labelZh}) · 第 ${round}/3 遍`,
          formulaName: `上勾下回 (${round}/3)`,
          formulaNotation: roundMoves.join(' '),
          mnemonic: round < 3 ? '黄色朝顶：连做 3 遍「上勾下回」即可翻正入底！' : '最后一遍「上勾下回」，底角马上归位！',
          recognitionTip: `黄色朝上时，原地连续做 3 遍上勾下回就能把黄色翻到底面。`,
          moves: roundMoves,
          rhythms: makeSexyRhythms(target.rot),
          recommendedView: VIEW_BY_ROT[target.rot],
          highlightFacelets: [...CORNER_FACELETS[curSlot]],
        });
      }
    }
  }

  // =========================================================================
  // STAGE 3: Middle Layer Edges (FR, BR, BL, FL)
  // =========================================================================
  // Edge slots: 8:FR [23(F),12(R)], 11:BR [48(B),14(R)], 10:BL [50(B),39(L)], 9:FL [21(F),41(L)]
  const midTargets: Array<{ c1: Face; c2: Face; rot: 0 | 1 | 2 | 3; slot: number; idx1: number; idx2: number }> = [
    { c1: 'F', c2: 'R', rot: 0, slot: 8, idx1: 23, idx2: 12 },
    { c1: 'R', c2: 'B', rot: 1, slot: 11, idx1: 14, idx2: 48 },
    { c1: 'B', c2: 'L', rot: 2, slot: 10, idx1: 50, idx2: 39 },
    { c1: 'L', c2: 'F', rot: 3, slot: 9, idx1: 41, idx2: 21 },
  ];

  const RIGHT_MID_INSERT: Move[] = ['U', 'R', "U'", "R'", "U'", "F'", 'U', 'F'];
  const LEFT_MID_INSERT: Move[] = ["U'", "L'", 'U', 'L', 'U', 'F', "U'", "F'"];

  for (const target of midTargets) {
    let f = sim.getFacelets();
    if (f[target.idx1] === target.c1 && f[target.idx2] === target.c2) {
      continue;
    }

    let slot = findEdgeSlot(f, target.c1, target.c2);
    const labelZh = `${FACE_ZH[target.c1]}-${FACE_ZH[target.c2]}`;

    // Step 3a: If stuck in a middle slot (8..11), pop it out using right-insert conjugated to that slot's rot
    if (slot >= 8 && slot <= 11) {
      const slotRotMap: Record<number, 0 | 1 | 2 | 3> = {
        8: 0,  // FR -> right slot of rot 0
        11: 1, // BR -> right slot of rot 1
        10: 2, // BL -> right slot of rot 2
        9: 3,  // FL -> right slot of rot 3
      };
      const popRot = slotRotMap[slot];
      const popMoves = conjugateMoves(RIGHT_MID_INSERT, popRot);
      emitChunk({
        stageId: 3,
        title: `弹出中层错位棱 (${labelZh})`,
        formulaName: '中层替换弹出',
        formulaNotation: popMoves.join(' '),
        mnemonic: '把顶层随便一个无关棱块换进去，就能把卡在中层的目标棱顶出来',
        recognitionTip: `${labelZh}棱块卡在中层且方向不对或错位，先做一遍右入公式将它替换到顶层。`,
        moves: popMoves,
        recommendedView: VIEW_BY_ROT[popRot],
        highlightFacelets: [...EDGE_FACELETS[slot]],
      });
      f = sim.getFacelets();
      slot = findEdgeSlot(f, target.c1, target.c2);
    }

    // Step 3b: Now in U layer (0..3). Match side sticker to its own center (c1 or c2) to form T-shape!
    const [uIdx, sIdx] = EDGE_FACELETS[slot];
    const sideColor = f[sIdx] as Face; // Either c1 or c2
    const topColor = f[uIdx] as Face;
    const alignTargetRot = FACE_CW_ORDER.indexOf(sideColor) as 0 | 1 | 2 | 3;
    const curPosRot = U_EDGE_TARGET_ROT[slot];
    const deltaCW = (curPosRot - alignTargetRot + 4) % 4;

    if (deltaCW !== 0) {
      const alignMoves = uAlignmentMoves(deltaCW);
      emitChunk({
        stageId: 3,
        title: `对齐侧色成 T 字 (${labelZh})`,
        formulaName: '顶棱对齐中心',
        formulaNotation: alignMoves.join(' '),
        mnemonic: `把${FACE_ZH[sideColor]}色对齐到${FACE_ZH[sideColor]}色中心块正上方，形成小 T 字`,
        recognitionTip: `看棱块朝外的侧面是${FACE_ZH[sideColor]}色，先转顶层让它和${FACE_ZH[sideColor]}色中心对齐。`,
        moves: alignMoves,
        recommendedView: VIEW_BY_ROT[alignTargetRot],
        highlightFacelets: [...EDGE_FACELETS[slot]],
      });
      f = sim.getFacelets();
      slot = findEdgeSlot(f, target.c1, target.c2);
    }

    // Step 3c: Decide Left vs Right insertion relative to alignTargetRot!
    // Look at sideColor's face as front (rot = alignTargetRot):
    // Right face is conjugateFace('R', alignTargetRot); Left face is conjugateFace('L', alignTargetRot).
    const rightFace = conjugateFace('R', alignTargetRot);
    const goRight = topColor === rightFace;

    const insertMoves = conjugateMoves(goRight ? RIGHT_MID_INSERT : LEFT_MID_INSERT, alignTargetRot);
    emitChunk({
      stageId: 3,
      title: `${goRight ? '向右' : '向左'}装入中层棱 (${labelZh})`,
      formulaName: goRight ? '中层右入公式' : '中层左入公式',
      formulaNotation: insertMoves.join(' '),
      mnemonic: goRight
        ? '顶色在右边 -> 顶层先往左躲开 -> 右手做上勾下回 -> 换正面把底角推回'
        : '顶色在左边 -> 顶层先往右躲开 -> 左手做上勾下回 -> 换正面把底角推回',
      recognitionTip: `对齐 ${FACE_ZH[sideColor]} 中心后，顶面是 ${FACE_ZH[topColor]} 色（在${goRight ? '右' : '左'}侧），因此向${goRight ? '右' : '左'}槽位装入。`,
      moves: insertMoves,
      recommendedView: VIEW_BY_ROT[alignTargetRot],
      highlightFacelets: [...EDGE_FACELETS[slot]],
    });
  }

  // =========================================================================
  // STAGE 4: Top White Cross on U (U1, U3, U5, U7)
  // =========================================================================
  for (let guard = 0; guard < 4; guard++) {
    const f = sim.getFacelets();
    const u1 = f[1] === 'U'; // UB
    const u3 = f[3] === 'U'; // UL
    const u5 = f[5] === 'U'; // UR
    const u7 = f[7] === 'U'; // UF
    const count = [u1, u3, u5, u7].filter(Boolean).length;

    if (count === 4) break;

    if (count === 0) {
      // Dot pattern -> F R U R' U' F'
      emitChunk({
        stageId: 4,
        title: '点状起手 · 变为直角',
        formulaName: '顶层十字公式',
        formulaNotation: OLL_CROSS.join(' '),
        mnemonic: '中心孤点：直接做一遍 F (上勾下回) F\'，就能变出小直角',
        recognitionTip: '顶面只有中心 1 个白块，任意角度直接执行十字公式即可。',
        moves: OLL_CROSS,
        rhythms: ['前顺', '右上', '顶左', '右下', '顶右', '前逆'],
        recommendedView: 'HOME',
        highlightFacelets: [4],
      });
    } else if ((u3 && u5) || (u1 && u7)) {
      // Line pattern
      if (u1 && u7) {
        emitChunk({
          stageId: 4,
          title: '竖线摆横 · 准备拼十字',
          formulaName: '横线摆位',
          formulaNotation: 'U',
          mnemonic: '一字必须横着放（左右方向），不能竖着前后放',
          recognitionTip: '当前顶层白棱呈前后竖线，转一次顶层摆成左右横线。',
          moves: ['U'],
          recommendedView: 'HOME',
          highlightFacelets: [1, 4, 7],
        });
      }
      emitChunk({
        stageId: 4,
        title: '横线变十字 · 完成顶层白十字',
        formulaName: '顶层十字公式',
        formulaNotation: OLL_CROSS.join(' '),
        mnemonic: '横线摆水平 -> F 放倒 -> 上勾下回 -> F\' 立起，白十字达成！',
        recognitionTip: '顶层白棱已呈水平一字横线，做一遍十字公式即可拼出白色十字！',
        moves: OLL_CROSS,
        rhythms: ['前顺', '右上', '顶左', '右下', '顶右', '前逆'],
        recommendedView: 'HOME',
        highlightFacelets: [3, 4, 5],
      });
    } else {
      // L-shape: rotate U so the two white edges sit at UB(1) and UL(3) ("9 o'clock")
      let alignU: Move[] = [];
      let tipPos = '左上角（9 点钟）';
      if (u1 && u5) alignU = ["U'"]; // UB+UR -> rotate CCW to UB+UL? Wait: U moves R->F, B->R, L->B, F->L. So U' moves R->B, B->L! Yes: UB+UR -> UL+UB!
      else if (u5 && u7) alignU = ['U2']; // UR+UF -> UL+UB
      else if (u7 && u3) alignU = ['U']; // UF+UL -> UL+UB

      if (alignU.length > 0) {
        const activeLights = [1, 3, 5, 7].filter((idx) => f[idx] === 'U');
        emitChunk({
          stageId: 4,
          title: '小直角摆到左上角（9 点钟）',
          formulaName: '直角摆位',
          formulaNotation: alignU.join(' '),
          mnemonic: '把小直角（拐角）转到左后方（9 点钟方向）再做公式',
          recognitionTip: `顶层已有两条白棱呈直角，先转动顶层把直角摆到${tipPos}。`,
          moves: alignU,
          recommendedView: 'HOME',
          highlightFacelets: [4, ...activeLights],
        });
      }

      emitChunk({
        stageId: 4,
        title: '直角变横线 · 推进白十字',
        formulaName: '顶层十字公式',
        formulaNotation: OLL_CROSS.join(' '),
        mnemonic: '直角摆好后做 F (上勾下回) F\'，马上变成水平一字横线',
        recognitionTip: '直角已摆在左上角，执行一遍十字公式变为横线。',
        moves: OLL_CROSS,
        rhythms: ['前顺', '右上', '顶左', '右下', '顶右', '前逆'],
        recommendedView: 'HOME',
        highlightFacelets: [1, 3, 4],
      });
    }
  }

  // =========================================================================
  // STAGE 5: Top Face All White (Orient U Corners using Sune / Anti-Sune)
  // =========================================================================
  const U_CORNER_INDICES = [0, 2, 6, 8];
  const countWhiteUCorners = (faceletsStr: string) =>
    U_CORNER_INDICES.filter((i) => faceletsStr[i] === 'U').length;

  for (let guard = 0; guard < 4; guard++) {
    const f = sim.getFacelets();
    const whiteCount = countWhiteUCorners(f);
    if (whiteCount === 4) break;

    const uOptions: Array<{ moves: Move[]; cwCount: number }> = [
      { moves: [], cwCount: 0 },
      { moves: ['U'], cwCount: 1 },
      { moves: ['U2'], cwCount: 2 },
      { moves: ["U'"], cwCount: 3 },
    ];

    // 1. Check if 1-shot Sune solves it
    let solvedChoice: { align: Move[]; formula: Move[]; name: string; mnemonic: string; rhythms: string[] } | null = null;

    for (const opt of uOptions) {
      const test = new CubeState(f);
      test.applyMoves([...opt.moves, ...SUNE]);
      if (countWhiteUCorners(test.getFacelets()) === 4) {
        solvedChoice = {
          align: opt.moves,
          formula: SUNE,
          name: '小鱼一式 (Sune)',
          mnemonic: '鱼头朝左前：右上 -> 顶左 -> 右下 -> 顶左 -> 右上 -> 顶两圈 -> 右下',
          rhythms: ['右上', '顶左', '右下', '顶左', '右上', '顶180°', '右下'],
        };
        break;
      }
    }

    // 2. Else check if 1-shot Anti-Sune solves it
    if (!solvedChoice) {
      for (const opt of uOptions) {
        const test = new CubeState(f);
        test.applyMoves([...opt.moves, ...ANTI_SUNE]);
        if (countWhiteUCorners(test.getFacelets()) === 4) {
          solvedChoice = {
            align: opt.moves,
            formula: ANTI_SUNE,
            name: '小鱼二式 (Anti-Sune)',
            mnemonic: '鱼头朝右后：右上 -> 顶两圈 -> 右下 -> 顶右 -> 右上 -> 顶右 -> 右下',
            rhythms: ['右上', '顶180°', '右下', '顶右', '右上', '顶右', '右下'],
          };
          break;
        }
      }
    }

    if (solvedChoice) {
      if (solvedChoice.align.length > 0) {
        emitChunk({
          stageId: 5,
          title: '摆好小鱼鱼头方向',
          formulaName: '小鱼摆位',
          formulaNotation: solvedChoice.align.join(' '),
          mnemonic: '转动顶层，让小鱼进入最顺手的起手位置',
          recognitionTip: `顶面有 1 个白角像小鱼，转动顶层摆好鱼头准备一式收官！`,
          moves: solvedChoice.align,
          recommendedView: 'HOME',
          highlightFacelets: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => f[i] === 'U'),
        });
      }
      emitChunk({
        stageId: 5,
        title: `顶面全白收官 · ${solvedChoice.name}`,
        formulaName: solvedChoice.name,
        formulaNotation: solvedChoice.formula.join(' '),
        mnemonic: solvedChoice.mnemonic,
        recognitionTip: `小鱼摆位正确！执行一遍${solvedChoice.name}即可实现顶面全白！`,
        moves: solvedChoice.formula,
        rhythms: solvedChoice.rhythms,
        recommendedView: 'HOME',
        highlightFacelets: [0, 2, 6, 8],
      });
      break;
    }

    // 3. Not 1-shot yet (0 or 2 white corners) -> pick alignment where Sune yields 1 white corner (Fish!)
    let chosenAlign: Move[] = [];
    for (const opt of uOptions) {
      const test = new CubeState(f);
      test.applyMoves([...opt.moves, ...SUNE]);
      if (countWhiteUCorners(test.getFacelets()) === 1) {
        chosenAlign = opt.moves;
        break;
      }
    }

    if (chosenAlign.length > 0) {
      emitChunk({
        stageId: 5,
        title: '调整顶层角块起手方向',
        formulaName: '角块摆位',
        formulaNotation: chosenAlign.join(' '),
        mnemonic: '把顶层角块先摆到合适方向，再做一遍小鱼就能变出标准小鱼形状',
        recognitionTip: `当前顶面有 ${whiteCount} 个白角，先转顶层对齐起手角度。`,
        moves: chosenAlign,
        recommendedView: 'HOME',
        highlightFacelets: [0, 2, 6, 8].filter((i) => f[i] === 'U'),
      });
    }

    emitChunk({
      stageId: 5,
      title: '小鱼一式 · 变出标准小鱼',
      formulaName: '小鱼一式 (Sune)',
      formulaNotation: SUNE.join(' '),
      mnemonic: '右上 -> 顶左 -> 右下 -> 顶左 -> 右上 -> 顶两圈 -> 右下',
      recognitionTip: '先做一遍小鱼一式，把多角状态转化为唯一的「小鱼」形状。',
      moves: SUNE,
      rhythms: ['右上', '顶左', '右下', '顶左', '右上', '顶180°', '右下'],
      recommendedView: 'HOME',
      highlightFacelets: [0, 2, 6, 8],
    });
  }

  // =========================================================================
  // STAGE 6: Permute Top Corners (Headlights -> L + T-Perm -> U Align)
  // =========================================================================
  const findCornerPairFaces = (faceletsStr: string): Face[] => {
    const pairs: Face[] = [];
    if (faceletsStr[18] === faceletsStr[20]) pairs.push('F');
    if (faceletsStr[9] === faceletsStr[11]) pairs.push('R');
    if (faceletsStr[45] === faceletsStr[47]) pairs.push('B');
    if (faceletsStr[36] === faceletsStr[38]) pairs.push('L');
    return pairs;
  };

  for (let guard = 0; guard < 3; guard++) {
    const f = sim.getFacelets();
    const pairs = findCornerPairFaces(f);

    if (pairs.length === 4) {
      // All corners are mutually correct! Align U so Front-Left corner matches F center
      // Check how many CW U turns needed to make f[18] === 'F'
      // Currently UFL(18) goes F->L->B->R on U CW. Let's just test U options!
      const uOptions: Move[][] = [[], ['U'], ['U2'], ["U'"]];
      for (const opt of uOptions) {
        const test = new CubeState(f);
        test.applyMoves(opt);
        const tf = test.getFacelets();
        if (tf[18] === 'F' && tf[20] === 'F' && tf[9] === 'R') {
          if (opt.length > 0) {
            emitChunk({
              stageId: 6,
              title: '对齐顶层四角颜色',
              formulaName: '顶层四角归位',
              formulaNotation: opt.join(' '),
              mnemonic: '四条边角块都已成对，转一下顶层就能全部对齐对应侧面！',
              recognitionTip: '四周角块已各自成双，只需调整顶层方向即可对齐中心。',
              moves: opt,
              recommendedView: 'HOME',
              highlightFacelets: [18, 20, 9, 11],
            });
          }
          break;
        }
      }
      break;
    }

    if (pairs.length === 1) {
      // Place the 1 headlight pair on Left (L)
      const pairFace = pairs[0];
      // F->L is U, R->L is U2, B->L is U', L->L is []
      const alignToLeft: Record<Face, Move[]> = {
        L: [],
        F: ['U'],
        R: ['U2'],
        B: ["U'"],
        U: [],
        D: [],
      };
      const alignMoves = alignToLeft[pairFace];
      const pairIndicesMap: Record<Face, number[]> = {
        F: [18, 20],
        R: [9, 11],
        B: [45, 47],
        L: [36, 38],
        U: [],
        D: [],
      };

      if (alignMoves.length > 0) {
        emitChunk({
          stageId: 6,
          title: '把同色「双眼」摆到左手边',
          formulaName: '双眼摆左',
          formulaNotation: alignMoves.join(' '),
          mnemonic: `在${FACE_ZH[pairFace]}色面找到一对同色角块（双眼），转到左手边(L)保护起来`,
          recognitionTip: '找到顶层唯一一对同色角块（「车灯/双眼」），摆到左边再做换角公式。',
          moves: alignMoves,
          recommendedView: 'ISO_FL',
          highlightFacelets: pairIndicesMap[pairFace],
        });
      }

      emitChunk({
        stageId: 6,
        title: '双眼换角 · 四角全部成对',
        formulaName: '双眼换角 (T-Perm)',
        formulaNotation: T_PERM.join(' '),
        mnemonic: '左手保护好双眼，右侧执行 T 字换角公式，一次让四面全部出现双眼！',
        recognitionTip: '双眼已在左手边，执行双眼换角公式即可让右侧两个角块对调归位。',
        moves: T_PERM,
        recommendedView: 'HOME',
        highlightFacelets: [9, 11, 20, 45],
      });
    } else {
      // 0 pairs -> diagonal corners swapped -> run T-Perm once to create 1 pair
      emitChunk({
        stageId: 6,
        title: '无双眼对角交换 · 先变出一对双眼',
        formulaName: '双眼换角 (T-Perm)',
        formulaNotation: T_PERM.join(' '),
        mnemonic: '四面都没有同色双眼时，任意方向先做一遍 T 字公式就能变出双眼！',
        recognitionTip: '当前顶层四面角块均不同色（对角互换），先做一遍换角公式变出双眼。',
        moves: T_PERM,
        recommendedView: 'HOME',
        highlightFacelets: [18, 20, 9, 11],
      });
    }
  }

  // =========================================================================
  // STAGE 7: Permute Top Edges (Ua-Perm / Ub-Perm -> Solved!)
  // =========================================================================
  const findSolvedTopEdgeFaces = (faceletsStr: string): Face[] => {
    const solved: Face[] = [];
    if (faceletsStr[19] === 'F') solved.push('F');
    if (faceletsStr[10] === 'R') solved.push('R');
    if (faceletsStr[46] === 'B') solved.push('B');
    if (faceletsStr[37] === 'L') solved.push('L');
    return solved;
  };

  for (let guard = 0; guard < 2; guard++) {
    const f = sim.getFacelets();
    if (f === SOLVED_FACELETS) break;

    const solvedEdges = findSolvedTopEdgeFaces(f);
    if (solvedEdges.length === 4) break;

    if (solvedEdges.length === 0) {
      emitChunk({
        stageId: 7,
        title: '四棱全错位 · 先拼好一条完整边',
        formulaName: '顺时针三棱 (Ua-Perm)',
        formulaNotation: UA_PERM.join(' '),
        mnemonic: '四个顶棱都没对齐时，任意方向先做一遍三棱公式就会出现一条完整边！',
        recognitionTip: '顶层四条边目前都没有完整一面，先执行一遍三棱公式即可得到一面完整。',
        moves: UA_PERM,
        recommendedView: 'HOME',
        highlightFacelets: [19, 10, 46, 37],
      });
      continue;
    }

    // 1 solved edge -> AUF to put it on Back (B)
    const solvedFace = solvedEdges[0];
    // F->B is U2, R->B is U', L->B is U, B->B is []
    const aufToBack: Record<Face, Move[]> = {
      B: [],
      F: ['U2'],
      R: ["U'"],
      L: ['U'],
      U: [],
      D: [],
    };
    const aufUndo: Record<Face, Move[]> = {
      B: [],
      F: ['U2'],
      R: ['U'],
      L: ["U'"],
      U: [],
      D: [],
    };

    const edgeFaceletMap: Record<Face, number[]> = {
      F: [18, 19, 20],
      R: [9, 10, 11],
      B: [45, 46, 47],
      L: [36, 37, 38],
      U: [],
      D: [],
    };

    const preAuf = aufToBack[solvedFace];
    if (preAuf.length > 0) {
      emitChunk({
        stageId: 7,
        title: '把完整一面转到背面保护',
        formulaName: '完整面摆后',
        formulaNotation: preAuf.join(' '),
        mnemonic: `把已经完整的${FACE_ZH[solvedFace]}色边转到背面(B)保护起来`,
        recognitionTip: `已找到${FACE_ZH[solvedFace]}面顶层完整一条边！先把它转到背面，准备三棱收官。`,
        moves: preAuf,
        recommendedView: 'HOME',
        highlightFacelets: edgeFaceletMap[solvedFace],
      });
    }

    // Determine whether Ua or Ub solves the cube (after undoing AUF)
    const afterPre = sim.getFacelets();
    const undoMoves = aufUndo[solvedFace];

    const testUa = new CubeState(afterPre);
    testUa.applyMoves([...UA_PERM, ...undoMoves]);
    const useUa = testUa.isSolved();

    emitChunk({
      stageId: 7,
      title: useUa ? '顺时针三棱置换 · 顶层收官' : '逆时针三棱置换 · 顶层收官',
      formulaName: useUa ? '顺时针三棱 (Ua-Perm)' : '逆时针三棱 (Ub-Perm)',
      formulaNotation: (useUa ? UA_PERM : UB_PERM).join(' '),
      mnemonic: useUa
        ? '完整面在后，前三棱顺时针调换：做一遍顺三棱公式！'
        : '完整面在后，前三棱逆时针调换：做一遍逆三棱公式！',
      recognitionTip: `观察正面顶棱需要去${useUa ? '右' : '左'}边，执行${useUa ? '顺' : '逆'}时针三棱公式即可对齐！`,
      moves: useUa ? UA_PERM : UB_PERM,
      recommendedView: 'HOME',
      highlightFacelets: [19, 10, 37],
    });

    if (undoMoves.length > 0) {
      emitChunk({
        stageId: 7,
        title: '回正顶层 · 六面全部复原！',
        formulaName: '顶层回正',
        formulaNotation: undoMoves.join(' '),
        mnemonic: '最后拧一下顶层对齐中心色，六面魔方完全复原！',
        recognitionTip: '所有块都已排好顺序，转动最后一下顶层完成复原！',
        moves: undoMoves,
        recommendedView: 'HOME',
        highlightFacelets: [19, 10, 46, 37],
      });
    }
    break;
  }

  if (!sim.isSolved()) {
    throw new Error(`LBL solver did not reach solved state! Progress: ${JSON.stringify(evaluateLblProgress(sim.getFacelets()))}`);
  }

  return {
    moves: allMoves,
    chunks,
    stageStartIndices,
    initialCompletedStages: initialReport.completedStages,
  };
}

/**
 * Generates a realistic scrambled cube state whose NEXT unsolved LBL stage is exactly `stageId` (1..7).
 */
export function generateStagePracticeState(stageId: LblStageId): {
  facelets: string;
  solution: LblSolution;
} {
  for (let attempt = 0; attempt < 40; attempt++) {
    const scramble = CubeState.generateScramble(20);
    const baseCube = new CubeState();
    baseCube.applyMoves(scramble);
    const scrambledFacelets = baseCube.getFacelets();

    if (stageId === 1) {
      const rep = evaluateLblProgress(scrambledFacelets);
      if (rep.currentStage === 1) {
        return {
          facelets: scrambledFacelets,
          solution: solveLBL(scrambledFacelets),
        };
      }
      continue;
    }

    const fullSol = solveLBL(scrambledFacelets);
    const startIdx = fullSol.stageStartIndices[stageId];
    if (startIdx === undefined) continue;

    const sim = new CubeState(scrambledFacelets);
    sim.applyMoves(fullSol.moves.slice(0, startIdx));
    const stageFacelets = sim.getFacelets();

    const rep = evaluateLblProgress(stageFacelets);
    if (rep.currentStage === stageId) {
      return {
        facelets: stageFacelets,
        solution: solveLBL(stageFacelets),
      };
    }
  }

  // Deterministic fallback pattern (Superflip) if random loop somehow missed
  const fallback = new CubeState();
  fallback.applyMoves(['U', 'R2', 'F', 'B', 'R', 'B2', 'R', 'U2', 'L', 'B2', 'R', "U'", "D'", 'R2', 'F', "R'", 'L', 'B2', 'U2', 'F2']);
  const fbSol = solveLBL(fallback.getFacelets());
  const startIdx = fbSol.stageStartIndices[stageId] ?? 0;
  fallback.applyMoves(fbSol.moves.slice(0, startIdx));
  const finalFacelets = fallback.getFacelets();
  return {
    facelets: finalFacelets,
    solution: solveLBL(finalFacelets),
  };
}

export function getInverseMovesSequence(moves: Move[]): Move[] {
  return [...moves].reverse().map((m) => INVERSE_MOVES[m]);
}
