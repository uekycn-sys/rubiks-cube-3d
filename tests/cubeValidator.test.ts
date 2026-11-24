import { describe, it, expect } from 'vitest';
import { validateCubeState } from '../src/core/cubeValidator';
import { CubeState, CORNER_FACELETS, EDGE_FACELETS } from '../src/core/cubeState';
import { SOLVED_FACELETS } from '../src/core/types';

describe('CubeValidator - 5-Layer Physical Validity Tests', () => {
  // Positive Tests
  describe('Positive Legal States', () => {
    it('should validate solved cube state as valid', () => {
      const result = validateCubeState(SOLVED_FACELETS);
      expect(result.valid).toBe(true);
      expect(result.errorCode).toBeUndefined();
    });

    it('should validate legal random scrambles as valid', () => {
      for (let i = 0; i < 10; i++) {
        const cube = new CubeState();
        cube.applyMoves(CubeState.generateScramble(20));
        const result = validateCubeState(cube.getFacelets());
        expect(result.valid, `Scramble ${i} should be physically valid: ${result.message}`).toBe(true);
      }
    });
  });

  // Negative Tests: 6 Critical Physical Violations
  describe('Negative Illegal States (6 Red Lines)', () => {
    // 1. Incomplete / unpainted 'X'
    it('Negative 1: should reject incomplete cube with unpainted X', () => {
      const arr = SOLVED_FACELETS.split('');
      arr[0] = 'X';
      arr[15] = 'X';
      const result = validateCubeState(arr.join(''));

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INCOMPLETE');
      expect(result.message).toContain('未涂色');
      expect(result.problemIndices).toEqual([0, 15]);
    });

    it('Negative 1b: should reject string with invalid length', () => {
      const result = validateCubeState('UUUU');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INCOMPLETE');
    });

    // 2. Color count != 9
    it('Negative 2: should reject when color count is not strictly 9 each', () => {
      const arr = SOLVED_FACELETS.split('');
      // Change one U (idx 0) to R
      arr[0] = 'R';
      const result = validateCubeState(arr.join(''));

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('COLOR_COUNT');
      expect(result.message).toContain('多涂了');
      expect(result.message).toContain('少了');
    });

    // 3. Illegal / duplicate pieces
    it('Negative 3a: should reject modified center block', () => {
      const arr = SOLVED_FACELETS.split('');
      // Center of U is 4, swap it with another yellow sticker at 27
      arr[4] = 'D';
      arr[27] = 'U';
      const result = validateCubeState(arr.join(''));

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIECE');
      expect(result.message).toContain('中心块');
    });

    it('Negative 3b: should reject corner with physically impossible color combination (e.g. White + Yellow)', () => {
      const arr = SOLVED_FACELETS.split('');
      // Corner URF: [8, 9, 20]. Replace R (9) with D (Yellow, opposite of U!).
      arr[9] = 'D';
      // Balance color counts: replace D at non-corner 28 with R
      arr[28] = 'R';
      const result = validateCubeState(arr.join(''));

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIECE');
    });

    it('Negative 3c: should reject duplicate corner pieces', () => {
      const arr = SOLVED_FACELETS.split('');
      // Corner 0 (URF: [8, 9, 20]): colors U, R, F
      // Corner 1 (UFL: [6, 18, 38]): colors U, F, L
      // Duplicate corner 0 into corner 1:
      arr[6] = 'U';
      arr[18] = 'R';
      arr[38] = 'F';
      // Facelet 18 changed from F to R (+1 R, -1 F)
      // Facelet 38 changed from L to F (+1 F, -1 L)
      // Balance color counts: replace R at 14 with L (+1 L, -1 R)
      arr[14] = 'L';
      const result = validateCubeState(arr.join(''));

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIECE');
    });

    // 4. Single corner twist (orientation sum % 3 !== 0)
    it('Negative 4: should reject single corner twist (mod 3 != 0)', () => {
      const arr = SOLVED_FACELETS.split('');
      // Corner URF facelets: [8, 9, 20] -> originally ['U', 'R', 'F']
      // Twist URF cyclically: 8='F', 9='U', 20='R'
      // All colors are still U, R, F so color counts are strictly 9 each!
      arr[8] = 'F';
      arr[9] = 'U';
      arr[20] = 'R';

      const result = validateCubeState(arr.join(''));
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CORNER_TWIST');
      expect(result.message).toContain('角块朝向异常');
    });

    // 5. Single edge flip (orientation sum % 2 !== 0)
    it('Negative 5: should reject single edge flip (mod 2 != 0)', () => {
      const arr = SOLVED_FACELETS.split('');
      // Edge UR facelets: [5, 10] -> originally ['U', 'R']
      // Flip UR: 5='R', 10='U'
      // Colors are still 1 U and 1 R so color counts remain strictly 9!
      arr[5] = 'R';
      arr[10] = 'U';

      const result = validateCubeState(arr.join(''));
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EDGE_FLIP');
      expect(result.message).toContain('棱块朝向异常');
    });

    // 6. Two pieces swapped / Permutation parity violation (parity sum % 2 !== 0)
    it('Negative 6: should reject two swapped corners without swapping edges (parity violation)', () => {
      const arr = SOLVED_FACELETS.split('');
      // Corner 0 (URF: [8, 9, 20]): originally U, R, F
      // Corner 1 (UFL: [6, 18, 38]): originally U, F, L
      // Swap their locations with zero twist:
      // In corner 0, place corner 1's colors: U at 8, F at 9, L at 20 (Wait: canonical 1 is U, F, L)
      arr[8] = 'U';
      arr[9] = 'F';
      arr[20] = 'L';

      // In corner 1, place corner 0's colors: U at 6, R at 18, F at 38
      arr[6] = 'U';
      arr[18] = 'R';
      arr[38] = 'F';

      const result = validateCubeState(arr.join(''));
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('PARITY');
      expect(result.message).toContain('奇偶校验未通过');
    });
  });
});
