/**
 * Fast Exact God's-Algorithm Meet-in-the-Middle Solver for shallow states (<= 8 moves).
 * Guarantees optimal shortest solutions for beginner/challenge levels and near-solved states
 * without relying on move history, before delegating deeper states (> 8 moves) to Kociemba.
 */

import { ALL_MOVES, Face, INVERSE_MOVES, Move, SOLVED_FACELETS } from './types';
import { CubeState, MOVE_PERMUTATIONS } from './cubeState';

const FACE_ORDER: Record<Face, number> = {
  U: 0,
  D: 1,
  R: 2,
  L: 3,
  F: 4,
  B: 5,
};

const OPPOSITE_FACE: Record<Face, Face> = {
  U: 'D',
  D: 'U',
  R: 'L',
  L: 'R',
  F: 'B',
  B: 'F',
};

function applyPermutation(facelets: string, perm: number[]): string {
  let out = '';
  for (let i = 0; i < 54; i++) {
    out += facelets[perm[i]];
  }
  return out;
}

function isRedundantNextFace(prevFace: Face | null, nextFace: Face): boolean {
  if (!prevFace) return false;
  if (prevFace === nextFace) return true;
  // Canonical ordering for commutative opposite faces (e.g. allow U->D, prune D->U)
  if (OPPOSITE_FACE[prevFace] === nextFace && FACE_ORDER[nextFace] < FACE_ORDER[prevFace]) {
    return true;
  }
  return false;
}

// Lazy-initialized Meet-in-the-Middle reverse table up to depth 4 from SOLVED_FACELETS
// Stores packed move string from SOLVED to key state.
let reverseTableDepth4: Map<string, string> | null = null;

function getReverseTable(): Map<string, string> {
  if (reverseTableDepth4) return reverseTableDepth4;

  const map = new Map<string, string>();
  map.set(SOLVED_FACELETS, '');

  // BFS layers 1..4
  let frontier: Array<{ state: string; path: string; lastFace: Face | null }> = [
    { state: SOLVED_FACELETS, path: '', lastFace: null },
  ];

  for (let depth = 1; depth <= 4; depth++) {
    const nextFrontier: Array<{ state: string; path: string; lastFace: Face | null }> = [];
    for (let i = 0; i < frontier.length; i++) {
      const node = frontier[i];
      for (let mIdx = 0; mIdx < ALL_MOVES.length; mIdx++) {
        const move = ALL_MOVES[mIdx];
        const nextFace = move[0] as Face;
        if (isRedundantNextFace(node.lastFace, nextFace)) continue;

        const nextState = applyPermutation(node.state, MOVE_PERMUTATIONS[move]);
        if (!map.has(nextState)) {
          const nextPath = node.path ? `${node.path} ${move}` : move;
          map.set(nextState, nextPath);
          if (depth < 4) {
            nextFrontier.push({ state: nextState, path: nextPath, lastFace: nextFace });
          }
        }
      }
    }
    frontier = nextFrontier;
  }

  reverseTableDepth4 = map;
  return map;
}

/**
 * Attempts to find an exact shortest solution up to 8 moves via bidirectional Meet-in-the-Middle.
 * Returns null if the state requires >= 9 moves (caller should fall back to Kociemba two-phase).
 */
export function findExactShortSolution(facelets: string, maxDepth = 8): Move[] | null {
  if (facelets === SOLVED_FACELETS) return [];

  const targetMap = getReverseTable();

  const buildSolution = (forwardMoves: Move[], reversePathStr: string): Move[] => {
    const revMoves = reversePathStr
      ? (reversePathStr.split(' ') as Move[]).reverse().map((m) => INVERSE_MOVES[m])
      : [];
    const combined = [...forwardMoves, ...revMoves];

    // Sanity verify solution actually solves target facelets
    const verify = new CubeState(facelets);
    verify.applyMoves(combined);
    if (!verify.isSolved()) {
      throw new Error('Exact solver verification mismatch');
    }
    return combined;
  };

  // Check depth 0..4 directly in reverse table
  const direct = targetMap.get(facelets);
  if (direct !== undefined) {
    const sol = buildSolution([], direct);
    return sol.length <= maxDepth ? sol : null;
  }

  // Forward iterative deepening DFS up to min(4, maxDepth - 4) to cover total depths 5..8
  const forwardLimit = Math.max(0, Math.min(4, maxDepth));
  let bestSolution: Move[] | null = null;

  const dfs = (
    state: string,
    depthRemaining: number,
    lastFace: Face | null,
    path: Move[]
  ): boolean => {
    if (depthRemaining === 0) {
      const hit = targetMap.get(state);
      if (hit !== undefined) {
        const candidate = buildSolution(path, hit);
        if (candidate.length <= maxDepth) {
          bestSolution = candidate;
          return true;
        }
      }
      return false;
    }

    for (let i = 0; i < ALL_MOVES.length; i++) {
      const move = ALL_MOVES[i];
      const nextFace = move[0] as Face;
      if (isRedundantNextFace(lastFace, nextFace)) continue;

      const nextState = applyPermutation(state, MOVE_PERMUTATIONS[move]);
      path.push(move);
      const found = dfs(nextState, depthRemaining - 1, nextFace, path);
      path.pop();
      if (found) return true;
    }
    return false;
  };

  for (let d = 1; d <= forwardLimit; d++) {
    if (dfs(facelets, d, null, [])) {
      return bestSolution;
    }
  }

  return null;
}
