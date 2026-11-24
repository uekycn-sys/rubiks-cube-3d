/**
 * Solver Service
 * Provides unified interface to the Kociemba solver,
 * delegating to Web Worker in browser and running natively in Node/Vitest.
 */

import { Move } from './types';
// @ts-ignore
import Cube from 'cubejs';

let worker: Worker | null = null;
let isNodeInitialized = false;
let workerInitPromise: Promise<void> | null = null;

const pendingRequests = new Map<
  string,
  {
    resolve: (moves: Move[]) => void;
    reject: (err: Error) => void;
  }
>();

const isBrowser = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./solverWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent) => {
      const { type, id, moves, error } = event.data;

      if (type === 'SOLVE_SUCCESS') {
        const req = pendingRequests.get(id);
        if (req) {
          req.resolve(moves as Move[]);
          pendingRequests.delete(id);
        }
      } else if (type === 'SOLVE_ERROR') {
        const req = pendingRequests.get(id);
        if (req) {
          req.reject(new Error(error || 'Solve failed in worker'));
          pendingRequests.delete(id);
        }
      }
    };

    worker.onerror = (err) => {
      console.error('Solver worker error:', err);
    };
  }
  return worker;
}

export async function initSolver(): Promise<void> {
  if (isBrowser) {
    if (workerInitPromise) return workerInitPromise;

    workerInitPromise = new Promise<void>((resolve, reject) => {
      const w = getWorker();
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'INIT_DONE') {
          w.removeEventListener('message', handler);
          resolve();
        } else if (event.data.type === 'INIT_ERROR') {
          w.removeEventListener('message', handler);
          reject(new Error(event.data.error));
        }
      };
      w.addEventListener('message', handler);
      w.postMessage({ type: 'INIT' });
    });

    return workerInitPromise;
  } else {
    // Node / Vitest environment
    if (!isNodeInitialized) {
      Cube.initSolver();
      isNodeInitialized = true;
    }
  }
}

export async function solveCube(facelets: string): Promise<Move[]> {
  // If already solved, return empty array immediately
  if (facelets === 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB') {
    return [];
  }

  if (isBrowser) {
    await initSolver();
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const w = getWorker();

    return new Promise<Move[]>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      w.postMessage({
        type: 'SOLVE',
        id,
        facelets,
      });

      // Safety timeout after 15 seconds
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('求解超时（15秒）'));
        }
      }, 15000);
    });
  } else {
    // Direct computation for Node/Vitest
    if (!isNodeInitialized) {
      Cube.initSolver();
      isNodeInitialized = true;
    }
    const cube = Cube.fromString(facelets);
    const solution = cube.solve();
    if (!solution) return [];
    return solution.trim().split(/\s+/).filter(Boolean) as Move[];
  }
}
