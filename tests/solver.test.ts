import { describe, it, expect, beforeAll } from 'vitest';
import { CubeState } from '../src/core/cubeState';
import { validateCubeState } from '../src/core/cubeValidator';
import { initSolver, solveCube } from '../src/core/solverService';

describe('Solver Closed-Loop Verification', () => {
  beforeAll(async () => {
    await initSolver();
  });

  it('should return empty solution for already solved cube', async () => {
    const cube = new CubeState();
    const solution = await solveCube(cube.getFacelets());
    expect(solution.length).toBe(0);
  });

  it('should solve 1-move scramble optimally in 1 move and restore solved state', async () => {
    const cube = new CubeState();
    cube.applyMove('R');
    const solution = await solveCube(cube.getFacelets());
    expect(solution).toEqual(["R'"]);

    for (const move of solution) {
      cube.applyMove(move);
    }
    expect(cube.isSolved()).toBe(true);
  });

  it('should solve 7-move step-limit Level 9 state within <= 7 moves via genuine search', async () => {
    const cube = new CubeState();
    cube.applyMoves(['R', 'U2', "R'", 'D', 'R', "D'", 'R2']);
    const solution = await solveCube(cube.getFacelets());
    expect(solution.length).toBeLessThanOrEqual(7);
    expect(solution.length).toBeGreaterThan(0);

    for (const move of solution) {
      cube.applyMove(move);
    }
    expect(cube.isSolved()).toBe(true);
  });

  it('should solve 10 random 20-move scrambles and restore to 100% solved', async () => {
    for (let testIdx = 0; testIdx < 10; testIdx++) {
      const scramble = CubeState.generateScramble(20);
      const cube = new CubeState();
      cube.applyMoves(scramble);

      const facelets = cube.getFacelets();
      // Must pass 5-layer physical validity check
      const validation = validateCubeState(facelets);
      expect(validation.valid, `Scramble ${testIdx} failed validation: ${validation.message}`).toBe(true);

      // Solve
      const solution = await solveCube(facelets);
      expect(solution.length, `Test ${testIdx} solution too long`).toBeLessThanOrEqual(24);
      expect(solution.length, `Test ${testIdx} solution empty`).toBeGreaterThan(0);

      // Apply solution to the scrambled cube
      for (const m of solution) {
        cube.applyMove(m);
      }

      // Assert complete restoration
      expect(cube.isSolved(), `Test ${testIdx} did not restore to solved state!`).toBe(true);
    }
  }, 30000); // 30s timeout for 10 solves
});
