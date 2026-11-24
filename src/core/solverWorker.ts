/**
 * Web Worker for Kociemba Two-Phase Algorithm Solver (cubejs)
 * Keeps heavy table generation and search off the main UI thread.
 */

// @ts-ignore
import Cube from 'cubejs';

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
