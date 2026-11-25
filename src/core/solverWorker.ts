/**
 * Web Worker for Kociemba Two-Phase Algorithm Solver (cubejs)
 * Keeps heavy table generation and search off the main UI thread.
 */

// @ts-ignore
import Cube from 'cubejs';
import { findExactShortSolution } from './exactSolver';

let initialized = false;

self.onmessage = function (event: MessageEvent) {
  const { type, id, facelets } = event.data;

  if (type === 'INIT') {
    try {
      if (!initialized) {
        Cube.initSolver();
        initialized = true;
      }
      self.postMessage({ type: 'INIT_DONE' });
    } catch (err: any) {
      self.postMessage({ type: 'INIT_ERROR', error: err?.message || String(err) });
    }
    return;
  }

  if (type === 'SOLVE') {
    try {
      // Check fast exact optimal solution (<= 8 moves) via Meet-in-the-Middle first
      const exactShort = findExactShortSolution(facelets, 8);
      if (exactShort !== null) {
        self.postMessage({
          type: 'SOLVE_SUCCESS',
          id,
          moves: exactShort,
          raw: exactShort.join(' '),
        });
        return;
      }

      if (!initialized) {
        Cube.initSolver();
        initialized = true;
      }

      const cube = Cube.fromString(facelets);
      const solution = cube.solve();
      const moves = solution ? solution.trim().split(/\s+/).filter(Boolean) : [];

      self.postMessage({
        type: 'SOLVE_SUCCESS',
        id,
        moves,
        raw: solution,
      });
    } catch (err: any) {
      self.postMessage({
        type: 'SOLVE_ERROR',
        id,
        error: err?.message || String(err),
      });
    }
  }
};
