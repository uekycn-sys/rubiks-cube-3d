import { describe, it, expect } from 'vitest';
import { CubeState } from '../src/core/cubeState';
import { ALL_MOVES, INVERSE_MOVES, SOLVED_FACELETS, Move } from '../src/core/types';
// @ts-ignore
import Cube from 'cubejs';

describe('CubeState & Moves', () => {
  it('should initialize with standard solved state', () => {
    const cube = new CubeState();
    expect(cube.getFacelets()).toBe(SOLVED_FACELETS);
    expect(cube.isSolved()).toBe(true);
  });

  it('should match cubejs for all 18 basic moves', () => {
    for (const move of ALL_MOVES) {
      const state = new CubeState();
      state.applyMove(move);

      const cj = new Cube();
      cj.move(move);

      expect(state.getFacelets(), `Mismatch on move ${move}`).toBe(cj.asString());
    }
  });

  it('should restore solved state when applying each move and its inverse', () => {
    for (const move of ALL_MOVES) {
      const state = new CubeState();
      state.applyMove(move);
      expect(state.isSolved()).toBe(false);

      const inv = INVERSE_MOVES[move];
      state.applyMove(inv);
      expect(state.isSolved(), `Failed inverse closure for ${move} -> ${inv}`).toBe(true);
      expect(state.getFacelets()).toBe(SOLVED_FACELETS);
    }
  });

  it('should restore solved state when repeating 90 deg move 4 times or 180 deg move 2 times', () => {
    for (const move of ALL_MOVES) {
      const state = new CubeState();
      const repeat = move.endsWith('2') ? 2 : 4;
      for (let i = 0; i < repeat; i++) {
        state.applyMove(move);
      }
      expect(state.isSolved(), `Failed cyclic closure for ${move} repeated ${repeat} times`).toBe(true);
    }
  });

  it('should generate valid scrambles without consecutive same-face moves', () => {
    const scramble = CubeState.generateScramble(25);
    expect(scramble.length).toBe(25);

    for (let i = 0; i < scramble.length - 1; i++) {
      const faceA = scramble[i][0];
      const faceB = scramble[i + 1][0];
      expect(faceA).not.toBe(faceB);
    }
  });
});
