/**
 * 5-Layer Rubik's Cube Physical Validity Validator
 * Strictly verifies physical legality before feeding state to Kociemba solver
 */

import { ValidationResult, Face } from './types';
import {
  CORNER_FACELETS,
  EDGE_FACELETS,
  CORNER_COLORS,
  EDGE_COLORS,
  CENTER_FACELETS,
} from './cubeState';

const COLOR_NAMES_ZH: Record<string, string> = {
  U: '白色(U)',
  R: '红色(R)',
  F: '绿色(F)',
  D: '黄色(D)',
  L: '橙色(L)',
  B: '蓝色(B)',
  X: '未涂色',
};

const EXPECTED_CENTERS: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/**
 * Validates a 54-facelet string according to 5 physical laws of the Rubik's Cube.
 */
export function validateCubeState(facelets: string): ValidationResult {
  // 1. Completeness Check
  if (!facelets || facelets.length !== 54) {
    return {
      valid: false,
      errorCode: 'INCOMPLETE',
      message: `魔方数据长度异常（当前 ${facelets ? facelets.length : 0}/54 格）`,
      problemIndices: [],
    };
  }

  const unpaintedIndices: number[] = [];
  for (let i = 0; i < 54; i++) {
    if (facelets[i] === 'X') {
      unpaintedIndices.push(i);
    }
  }

  if (unpaintedIndices.length > 0) {
    return {
      valid: false,
      errorCode: 'INCOMPLETE',
      message: `魔方尚未涂满，还有 ${unpaintedIndices.length} 个未涂色格子`,
      problemIndices: unpaintedIndices,
      details: { remainingCount: unpaintedIndices.length },
    };
  }

  // Verify Center pieces standard orientation
  const centerErrors: number[] = [];
  for (let i = 0; i < 6; i++) {
    const centerIdx = CENTER_FACELETS[i];
    if (facelets[centerIdx] !== EXPECTED_CENTERS[i]) {
      centerErrors.push(centerIdx);
    }
  }
  if (centerErrors.length > 0) {
    return {
      valid: false,
      errorCode: 'INVALID_PIECE',
      message: '魔方中心块颜色不符合白顶绿前标准（U=白, F=绿, R=红, D=黄, L=橙, B=蓝），中心块不可随意修改',
      problemIndices: centerErrors,
    };
  }

  // 2. Color Count Check: strictly 9 pieces for each color
  const counts: Record<string, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  const colorIndices: Record<string, number[]> = { U: [], R: [], F: [], D: [], L: [], B: [] };

  for (let i = 0; i < 54; i++) {
    const color = facelets[i];
    if (counts[color] !== undefined) {
      counts[color]++;
      colorIndices[color].push(i);
    } else {
      return {
        valid: false,
        errorCode: 'COLOR_COUNT',
        message: `出现未知颜色标识 '${color}'（位于第 ${i} 格）`,
        problemIndices: [i],
      };
    }
  }

  const countMismatchMessages: string[] = [];
  const countProblemIndices: number[] = [];

  for (const c of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) {
    const count = counts[c];
    if (count !== 9) {
      if (count > 9) {
        countMismatchMessages.push(`${COLOR_NAMES_ZH[c]}多涂了 ${count - 9} 块（当前 ${count}/9）`);
        countProblemIndices.push(...colorIndices[c]);
      } else {
        countMismatchMessages.push(`${COLOR_NAMES_ZH[c]}少了 ${9 - count} 块（当前 ${count}/9）`);
      }
    }
  }

  if (countMismatchMessages.length > 0) {
    return {
      valid: false,
      errorCode: 'COLOR_COUNT',
      message: countMismatchMessages.join('，'),
      problemIndices: countProblemIndices,
      details: { counts },
    };
  }

  // 3. Corner and Edge Piece Physical Existence & Uniqueness Check
  const cp: number[] = new Array(8).fill(-1);
  const co: number[] = new Array(8).fill(-1);
  const cornerProblemIndices: number[] = [];

  for (let i = 0; i < 8; i++) {
    const [idx0, idx1, idx2] = CORNER_FACELETS[i];
    const c0 = facelets[idx0];
    const c1 = facelets[idx1];
    const c2 = facelets[idx2];
    const cornerColors = [c0, c1, c2];

    // Find facelet with 'U' or 'D'
    let ori = -1;
    let udCount = 0;
    for (let o = 0; o < 3; o++) {
      if (cornerColors[o] === 'U' || cornerColors[o] === 'D') {
        ori = o;
        udCount++;
      }
    }

    if (udCount !== 1 || ori === -1) {
      cornerProblemIndices.push(idx0, idx1, idx2);
      return {
        valid: false,
        errorCode: 'INVALID_PIECE',
        message: `第 ${i + 1} 个角块存在非法颜色组合（角块必须且仅能包含一个顶底色白/黄）`,
        problemIndices: [idx0, idx1, idx2],
      };
    }

    const col1 = cornerColors[(ori + 1) % 3];
    const col2 = cornerColors[(ori + 2) % 3];
    const udCol = cornerColors[ori];

    let matchedCorner = -1;
    for (let j = 0; j < 8; j++) {
      if (
        CORNER_COLORS[j][0] === udCol &&
        CORNER_COLORS[j][1] === col1 &&
        CORNER_COLORS[j][2] === col2
      ) {
        matchedCorner = j;
        break;
      }
    }

    if (matchedCorner === -1) {
      return {
        valid: false,
        errorCode: 'INVALID_PIECE',
        message: `第 ${i + 1} 个角块物理上不存在（颜色组合或顺逆方向有误）`,
        problemIndices: [idx0, idx1, idx2],
      };
    }

    cp[i] = matchedCorner;
    co[i] = ori % 3;
  }

  // Check corner uniqueness (no duplicate corners)
  const cornerSeen = new Set<number>();
  for (let i = 0; i < 8; i++) {
    if (cornerSeen.has(cp[i])) {
      return {
        valid: false,
        errorCode: 'INVALID_PIECE',
        message: '存在重复或冲突的角块，请核对相应贴片颜色',
        problemIndices: CORNER_FACELETS[i],
      };
    }
    cornerSeen.add(cp[i]);
  }

  // Edge pieces check
  const ep: number[] = new Array(12).fill(-1);
  const eo: number[] = new Array(12).fill(-1);

  for (let i = 0; i < 12; i++) {
    const [idx0, idx1] = EDGE_FACELETS[i];
    const col0 = facelets[idx0];
    const col1 = facelets[idx1];

    let matchedEdge = -1;
    let matchedOri = -1;

    for (let j = 0; j < 12; j++) {
      if (EDGE_COLORS[j][0] === col0 && EDGE_COLORS[j][1] === col1) {
        matchedEdge = j;
        matchedOri = 0;
        break;
      }
      if (EDGE_COLORS[j][0] === col1 && EDGE_COLORS[j][1] === col0) {
        matchedEdge = j;
        matchedOri = 1;
        break;
      }
    }

    if (matchedEdge === -1) {
      return {
        valid: false,
        errorCode: 'INVALID_PIECE',
        message: `第 ${i + 1} 条棱块物理上不存在（如对立色相邻或非法颜色搭配）`,
        problemIndices: [idx0, idx1],
      };
    }

    ep[i] = matchedEdge;
    eo[i] = matchedOri;
  }

  // Check edge uniqueness
  const edgeSeen = new Set<number>();
  for (let i = 0; i < 12; i++) {
    if (edgeSeen.has(ep[i])) {
      return {
        valid: false,
        errorCode: 'INVALID_PIECE',
        message: '存在重复或冲突的棱块，请核对相应贴片颜色',
        problemIndices: EDGE_FACELETS[i],
      };
    }
    edgeSeen.add(ep[i]);
  }

  // 4. Orientation Parity Check
  // Corner twist orientation sum must be divisible by 3
  const cornerTwistSum = co.reduce((acc, val) => acc + val, 0);
  if (cornerTwistSum % 3 !== 0) {
    return {
      valid: false,
      errorCode: 'CORNER_TWIST',
      message: '角块朝向异常：可能某块颜色涂错，或你手中的魔方有单个角块被强行掰转过',
      problemIndices: [],
      details: { cornerTwistSum },
    };
  }

  // Edge flip orientation sum must be divisible by 2
  const edgeFlipSum = eo.reduce((acc, val) => acc + val, 0);
  if (edgeFlipSum % 2 !== 0) {
    return {
      valid: false,
      errorCode: 'EDGE_FLIP',
      message: '棱块朝向异常：可能某条棱块的两个面涂反了，或魔方有单条棱块装反',
      problemIndices: [],
      details: { edgeFlipSum },
    };
  }

  // 5. Permutation Parity Check
  // Count inversions of corner permutation cp
  let cornerInversions = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      if (cp[i] > cp[j]) cornerInversions++;
    }
  }
  const pCorner = cornerInversions % 2;

  // Count inversions of edge permutation ep
  let edgeInversions = 0;
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      if (ep[i] > ep[j]) edgeInversions++;
    }
  }
  const pEdge = edgeInversions % 2;

  if ((pCorner + pEdge) % 2 !== 0) {
    return {
      valid: false,
      errorCode: 'PARITY',
      message: '奇偶校验未通过：存在两个块位置互换，请检查是否录错颜色或魔方曾拆装错位',
      problemIndices: [],
      details: { pCorner, pEdge, cornerInversions, edgeInversions },
    };
  }

  return {
    valid: true,
    message: '魔方状态物理合法，可进行最优解计算',
  };
}
