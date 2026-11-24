/**
 * CubeState Engine
 * Maintains 54-facelet representation and handles move permutations
 */

import { Move, ALL_MOVES, SOLVED_FACELETS, Face } from './types';
// @ts-ignore
import Cube from 'cubejs';

// Canonical Facelet definitions matching standard cubejs
export const CORNER_FACELETS = [
  [8, 9, 20],   // 0: URF (U8, R0, F2)
  [6, 18, 38],  // 1: UFL (U6, F0, L2)
  [0, 36, 47],  // 2: ULB (U0, L0, B2)
  [2, 45, 11],  // 3: UBR (U2, B0, R2)
  [29, 26, 15], // 4: DFR (D2, F8, R6)
  [27, 44, 24], // 5: DLF (D0, L8, F6)
  [33, 53, 42], // 6: DBL (D6, B8, L6)
  [35, 17, 51], // 7: DRB (D8, R8, B6)
];

export const EDGE_FACELETS = [
  [5, 10],  // 0: UR (U5, R1)
  [7, 19],  // 1: UF (U7, F1)
  [3, 37],  // 2: UL (U3, L1)
  [1, 46],  // 3: UB (U1, B1)
  [32, 16], // 4: DR (D5, R7)
  [28, 25], // 5: DF (D1, F7)
  [30, 43], // 6: DL (D3, L7)
  [34, 52], // 7: DB (D7, B7)
  [23, 12], // 8: FR (F5, R3)
  [21, 41], // 9: FL (F3, L5)
  [50, 39], // 10: BL (B5, L3)
  [48, 14], // 11: BR (B3, R5)
];

export const CORNER_COLORS: [Face, Face, Face][] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B'],
];

export const EDGE_COLORS: [Face, Face][] = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R'],
];

export const CENTER_FACELETS = [4, 13, 22, 31, 40, 49];

/**
 * Computes exact 54-facelet permutation array for a given move using cubejs model
 * dest[i] = src[PERMUTATION[i]]
 */
function computeMovePermutation(moveStr: string): number[] {
  const cube = new Cube();
  cube.move(moveStr);
  const perm = new Array(54);

  // Centers
  for (let i = 0; i < 6; i++) {
    perm[9 * i + 4] = 9 * cube.center[i] + 4;
  }
  // Corners
  for (let i = 0; i < 8; i++) {
    const corner = cube.cp[i];
    const ori = cube.co[i];
    for (let n = 0; n < 3; n++) {
      const dest = CORNER_FACELETS[i][(n + ori) % 3];
      const src = CORNER_FACELETS[corner][n];
      perm[dest] = src;
    }
  }
  // Edges
  for (let i = 0; i < 12; i++) {
    const edge = cube.ep[i];
    const ori = cube.eo[i];
    for (let n = 0; n < 2; n++) {
      const dest = EDGE_FACELETS[i][(n + ori) % 2];
      const src = EDGE_FACELETS[edge][n];
      perm[dest] = src;
    }
  }
  return perm;
}

// Precompute all 18 permutations on startup for maximum runtime performance
export const MOVE_PERMUTATIONS: Record<Move, number[]> = (() => {
  const map: Partial<Record<Move, number[]>> = {};
  for (const m of ALL_MOVES) {
    map[m] = computeMovePermutation(m);
  }
  return map as Record<Move, number[]>;
})();

/**
 * Pure TypeScript Rubik's Cube state representation
 */
export class CubeState {
  private facelets: string;

  constructor(initialFacelets: string = SOLVED_FACELETS) {
    this.facelets = initialFacelets;
  }

  getFacelets(): string {
    return this.facelets;
  }

  setFacelets(facelets: string): void {
    this.facelets = facelets;
  }

  isSolved(): boolean {
    return this.facelets === SOLVED_FACELETS;
  }

  applyMove(move: Move): void {
    const perm = MOVE_PERMUTATIONS[move];
    if (!perm) return;
    const current = this.facelets;
    const next = new Array(54);
    for (let i = 0; i < 54; i++) {
      next[i] = current[perm[i]];
    }
    this.facelets = next.join('');
  }

  applyMoves(moves: Move[] | string): void {
    const moveList: Move[] = typeof moves === 'string'
      ? (moves.trim().split(/\s+/).filter(Boolean) as Move[])
      : moves;
    for (const m of moveList) {
      this.applyMove(m);
    }
  }

  reset(): void {
    this.facelets = SOLVED_FACELETS;
  }

  clone(): CubeState {
    return new CubeState(this.facelets);
  }

  /**
   * Generates a random scramble of n moves (default 20)
   * avoiding adjacent redundant moves (e.g. U then U')
   */
  static generateScramble(length: number = 20): Move[] {
    const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
    const suffixes = ['', "'", '2'];
    const scramble: Move[] = [];
    let lastFace: Face | null = null;
    let secondLastFace: Face | null = null;

    const opposites: Record<Face, Face> = {
      U: 'D', D: 'U',
      L: 'R', R: 'L',
      F: 'B', B: 'F',
    };

    while (scramble.length < length) {
      const face = faces[Math.floor(Math.random() * faces.length)];
      if (face === lastFace) continue;
      // Also prevent e.g. U D U (opposite face redundancy)
      if (secondLastFace === face && opposites[face] === lastFace) continue;

      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const move = `${face}${suffix}` as Move;
      scramble.push(move);
      secondLastFace = lastFace;
      lastFace = face;
    }

    return scramble;
  }
}
