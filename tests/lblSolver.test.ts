import { describe, it, expect } from 'vitest';
import { CubeState } from '../src/core/cubeState';
import { validateCubeState } from '../src/core/cubeValidator';
import {
  LBL_STAGES,
  conjugateMove,
  evaluateLblProgress,
  generateStagePracticeState,
  solveLBL,
} from '../src/core/lblSolver';
import { translateLblSolution } from '../src/core/moveTranslator';
import { PATTERNS } from '../src/data/levels';
import { LblStageId, SOLVED_FACELETS } from '../src/core/types';

describe('7-Stage Layer-by-Layer (LBL) Solver & Curriculum', () => {
  it('should recognize an already solved cube with 0 moves and all 7 stages complete', () => {
    const report = evaluateLblProgress(SOLVED_FACELETS);
    expect(report.isSolved).toBe(true);
    expect(report.currentStage).toBeNull();
    expect(report.completedCount).toBe(7);
    expect(report.completedStages).toEqual([true, true, true, true, true, true, true]);

    const sol = solveLBL(SOLVED_FACELETS);
    expect(sol.moves).toEqual([]);
    expect(sol.chunks).toEqual([]);
    expect(LBL_STAGES.length).toBe(7);
  });

  it('should conjugate Y-axis moves accurately across all 4 quadrants', () => {
    expect(conjugateMove('R', 0)).toBe('R');
    expect(conjugateMove('R', 1)).toBe('B');
    expect(conjugateMove('R', 2)).toBe('L');
    expect(conjugateMove('R', 3)).toBe('F');
    expect(conjugateMove("F'", 1)).toBe("R'");
    expect(conjugateMove('U2', 3)).toBe('U2');
  });

  it('should solve 100 random 20-move scrambles layer-by-layer and preserve prior stages', () => {
    for (let i = 0; i < 100; i++) {
      const scramble = CubeState.generateScramble(20);
      const cube = new CubeState();
      cube.applyMoves(scramble);
      const facelets = cube.getFacelets();

      const sol = solveLBL(facelets);
      expect(sol.moves.length).toBeGreaterThan(0);

      // Verify full solution solves cube
      const sim = new CubeState(facelets);
      sim.applyMoves(sol.moves);
      expect(sim.isSolved(), `Scramble #${i} did not reach SOLVED`).toBe(true);

      // Verify stage-by-stage monotonic progress
      const stageSim = new CubeState(facelets);
      let prevStage: number = 0;
      for (const chunk of sol.chunks) {
        expect(chunk.stageId).toBeGreaterThanOrEqual(prevStage);
        expect(chunk.rhythms.length).toBe(chunk.moves.length);
        stageSim.applyMoves(chunk.moves);
        prevStage = chunk.stageId;
      }
      expect(stageSim.isSolved()).toBe(true);

      // Verify stageStartIndices integrity: at stage k start, stages 1..k-1 must be complete
      for (let stage = 2; stage <= 7; stage++) {
        const idx = sol.stageStartIndices[stage as LblStageId];
        if (idx !== undefined) {
          const check = new CubeState(facelets);
          check.applyMoves(sol.moves.slice(0, idx));
          const rep = evaluateLblProgress(check.getFacelets());
          for (let prev = 0; prev < stage - 1; prev++) {
            expect(
              rep.completedStages[prev],
              `Scramble #${i}: at start of stage ${stage}, stage ${prev + 1} was incomplete`
            ).toBe(true);
          }
        }
      }
    }
  });

  it('should solve all 7 classic art patterns via LBL', () => {
    for (const pat of PATTERNS) {
      const cube = new CubeState();
      cube.applyMoves(pat.moves);
      const facelets = cube.getFacelets();

      const sol = solveLBL(facelets);
      cube.applyMoves(sol.moves);
      expect(cube.isSolved(), `Pattern ${pat.nameZh} failed LBL solve`).toBe(true);
    }
  });

  it('should generate valid focused practice states for every stage 1..7', () => {
    for (let s = 1; s <= 7; s++) {
      const stageId = s as LblStageId;
      const { facelets, solution } = generateStagePracticeState(stageId);

      const validation = validateCubeState(facelets);
      expect(validation.valid, `Stage ${stageId} generated invalid cube`).toBe(true);

      const report = evaluateLblProgress(facelets);
      expect(report.currentStage, `Stage ${stageId} practice mismatch`).toBe(stageId);

      const sim = new CubeState(facelets);
      sim.applyMoves(solution.moves);
      expect(sim.isSolved()).toBe(true);
    }
  });

  it('should translate an LBL solution into rich step instructions', () => {
    const cube = new CubeState();
    cube.applyMoves(['R', 'U', "R'", "U'", 'F', 'R', 'U', "R'", "U'", "F'"]);
    const lbl = solveLBL(cube.getFacelets());
    const instructions = translateLblSolution(lbl);

    expect(instructions.length).toBe(lbl.moves.length);
    instructions.forEach((inst, idx) => {
      expect(inst.stepNumber).toBe(idx + 1);
      expect(inst.totalSteps).toBe(lbl.moves.length);
      expect(inst.stageId).toBeGreaterThanOrEqual(1);
      expect(inst.stageId).toBeLessThanOrEqual(7);
      expect(inst.stageTitle).toBeTruthy();
      expect(inst.formulaName).toBeTruthy();
      expect(inst.mnemonic).toBeTruthy();
    });
  });
});
