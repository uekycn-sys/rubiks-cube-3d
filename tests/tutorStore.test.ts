import { describe, it, expect, beforeEach } from 'vitest';
import { store, BLANK_PAINT_FACELETS } from '../src/store/cubeStore';
import { SOLVED_FACELETS, Move } from '../src/core/types';
import { CubeState } from '../src/core/cubeState';

describe('CubeStore & Tutor State Progression', () => {
  beforeEach(() => {
    store.resetPaintToBlank();
  });

  it('should initialize with blank paint state and center pieces intact', () => {
    const state = store.getState();
    expect(state.paintFacelets).toBe(BLANK_PAINT_FACELETS);
    expect(state.paintFacelets[4]).toBe('U');
    expect(state.paintFacelets[13]).toBe('R');
    expect(state.paintFacelets[22]).toBe('F');
    expect(state.paintFacelets[31]).toBe('D');
    expect(state.paintFacelets[40]).toBe('L');
    expect(state.paintFacelets[49]).toBe('B');
    expect(state.validationResult.valid).toBe(false);
    expect(state.validationResult.errorCode).toBe('INCOMPLETE');
  });

  it('should ignore attempts to edit fixed center pieces', () => {
    store.setPaintFacelet(4, 'D'); // Try changing U center to D
    expect(store.getState().paintFacelets[4]).toBe('U');
  });

  it('should setup tutor with history states matching the solution simulation', () => {
    const scramble = ['R', 'U', "R'", "U'"] as Move[];
    const sim = new CubeState();
    sim.applyMoves(scramble);
    const initialFacelets = sim.getFacelets();

    const solution = ["U", "R", "U'", "R'"] as Move[];
    store.setupTutor(initialFacelets, solution);

    const tutorState = store.getState();
    expect(tutorState.mode).toBe('tutor');
    expect(tutorState.solutionMoves).toEqual(solution);
    expect(tutorState.instructions.length).toBe(solution.length);
    expect(tutorState.historyFacelets.length).toBe(solution.length + 1);

    // Initial history state should be the scrambled state
    expect(tutorState.historyFacelets[0]).toBe(initialFacelets);

    // Final history state after applying all 4 inverse moves should be solved!
    expect(tutorState.historyFacelets[4]).toBe(SOLVED_FACELETS);
  });
});
