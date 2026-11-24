import { describe, it, expect } from 'vitest';
import { LEVELS, PATTERNS } from '../src/data/levels';
import { ALL_MOVES } from '../src/core/types';
import { CubeState } from '../src/core/cubeState';
import { validateCubeState } from '../src/core/cubeValidator';

describe('20 Levels & Art Patterns Validation', () => {
  it('should have exactly 20 levels across 4 chapters with 5 levels per chapter', () => {
    expect(LEVELS.length).toBe(20);

    for (let ch = 1; ch <= 4; ch++) {
      const chapterLevels = LEVELS.filter((l) => l.chapter === ch);
      expect(chapterLevels.length, `Chapter ${ch} should have 5 levels`).toBe(5);
    }
  });

  it('should contain all required metadata for each level', () => {
    LEVELS.forEach((lvl, idx) => {
      expect(lvl.id).toBe(idx + 1);
      expect(lvl.title).toBeTruthy();
      expect(lvl.subtitle).toBeTruthy();
      expect(lvl.description).toBeTruthy();
      expect(lvl.hint).toBeTruthy();
      expect(lvl.threeStarCondition).toBeTruthy();
      expect(lvl.twoStarCondition).toBeTruthy();
      expect(lvl.scramble.length).toBeGreaterThan(0);

      // Validate all scramble moves are valid Singmaster moves
      for (const m of lvl.scramble) {
        expect(ALL_MOVES).toContain(m);
      }
    });
  });

  it('should result in 100% physically valid cube states for all 20 levels', () => {
    for (const lvl of LEVELS) {
      const cube = new CubeState();
      cube.applyMoves(lvl.scramble);
      const facelets = cube.getFacelets();

      const validation = validateCubeState(facelets);
      expect(
        validation.valid,
        `Level ${lvl.id} (${lvl.title}) failed physical validation: ${validation.message}`
      ).toBe(true);
    }
  });

  it('should have valid move sequences for all art patterns and pass physical validation', () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(5);

    for (const pat of PATTERNS) {
      expect(pat.id).toBeTruthy();
      expect(pat.nameZh).toBeTruthy();
      expect(pat.moves.length).toBeGreaterThan(0);

      const cube = new CubeState();
      cube.applyMoves(pat.moves);
      const facelets = cube.getFacelets();

      const validation = validateCubeState(facelets);
      expect(
        validation.valid,
        `Pattern ${pat.nameZh} failed physical validation: ${validation.message}`
      ).toBe(true);
    }
  });
});
