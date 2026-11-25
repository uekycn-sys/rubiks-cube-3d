import { describe, it, expect } from 'vitest';
import {
  rgbToLab,
  calibrateAndSolveColors,
  LabColor,
  RgbColor,
  ALL_FACES,
} from '../src/core/colorClassifier';
import { CubeState } from '../src/core/cubeState';
import { validateCubeState } from '../src/core/cubeValidator';
import { Face, FACE_OFFSETS } from '../src/core/types';

// Ideal sticker RGB values
const BASE_RGB: Record<Face, RgbColor> = {
  U: { r: 245, g: 245, b: 245 }, // White
  R: { r: 215, g: 35, b: 35 },   // Red
  F: { r: 25, g: 165, b: 75 },   // Green
  D: { r: 245, g: 205, b: 25 },  // Yellow
  L: { r: 240, g: 105, b: 20 },  // Orange
  B: { r: 30, g: 95, b: 225 },   // Blue
};

function buildSyntheticCapturedFaces(
  facelets: string,
  transformRgb: (rgb: RgbColor, face: Face, subIdx: number) => RgbColor
): Record<Face, LabColor[]> {
  const result = {} as Record<Face, LabColor[]>;
  for (const face of ALL_FACES) {
    const offset = FACE_OFFSETS[face];
    const labs: LabColor[] = [];
    for (let sub = 0; sub < 9; sub++) {
      const trueColor = facelets[offset + sub] as Face;
      const litRgb = transformRgb(BASE_RGB[trueColor], face, sub);
      labs.push(rgbToLab(litRgb));
    }
    result[face] = labs;
  }
  return result;
}

describe('CIELAB Color Classifier & Dynamic Center Calibration', () => {
  it('should accurately convert canonical sRGB colors into perceptual CIELAB coordinates', () => {
    const white = rgbToLab({ r: 255, g: 255, b: 255 });
    const black = rgbToLab({ r: 0, g: 0, b: 0 });
    const red = rgbToLab(BASE_RGB.R);
    const green = rgbToLab(BASE_RGB.F);
    const blue = rgbToLab(BASE_RGB.B);
    const yellow = rgbToLab(BASE_RGB.D);

    expect(white.L).toBeGreaterThan(98);
    expect(Math.abs(white.a)).toBeLessThan(1);
    expect(Math.abs(white.b)).toBeLessThan(1);

    expect(black.L).toBeLessThan(1);
    expect(red.a).toBeGreaterThan(45);
    expect(green.a).toBeLessThan(-35);
    expect(blue.b).toBeLessThan(-45);
    expect(yellow.b).toBeGreaterThan(60);
  });

  it('should recover 100% exact 54-tile state under heavy warm incandescent indoor tint', () => {
    const cube = new CubeState();
    cube.applyMoves(CubeState.generateScramble(20));
    const expected = cube.getFacelets();

    // Simulate strong warm yellow lighting bias (+35 R, +20 G, -55 B) + mild per-tile noise
    const captured = buildSyntheticCapturedFaces(expected, (rgb, _face, sub) => ({
      r: Math.min(255, Math.max(0, rgb.r * 1.02 + 25 + (sub % 3) * 2)),
      g: Math.min(255, Math.max(0, rgb.g * 0.96 + 15 - (sub % 2) * 3)),
      b: Math.min(255, Math.max(0, rgb.b * 0.72 - 15 + (sub % 4))),
    }));

    const solved = calibrateAndSolveColors(captured);
    expect(solved).toBe(expected);
    expect(validateCubeState(solved).valid).toBe(true);
  });

  it('should recover 100% exact 54-tile state under cool LED lighting and face-to-face shadows', () => {
    const cube = new CubeState();
    cube.applyMoves(['R', 'U', "R'", 'F2', 'L', "D'", 'B2', 'U2', 'R', 'F']);
    const expected = cube.getFacelets();

    // Simulate cool blue shift + 25% shadow darkening on B and D faces
    const captured = buildSyntheticCapturedFaces(expected, (rgb, face) => {
      const shade = face === 'B' || face === 'D' ? 0.75 : 1.0;
      return {
        r: Math.min(255, Math.max(0, rgb.r * 0.85 * shade)),
        g: Math.min(255, Math.max(0, rgb.g * 0.98 * shade + 8)),
        b: Math.min(255, Math.max(0, rgb.b * 1.05 * shade + 28)),
      };
    });

    const solved = calibrateAndSolveColors(captured);
    expect(solved).toBe(expected);
    expect(validateCubeState(solved).valid).toBe(true);
  });

  it('should strictly enforce 9 tiles per color even when noisy tiles create ambiguous clusters', () => {
    const cube = new CubeState();
    cube.applyMoves(['U', 'R', 'F', 'D', 'L', 'B']);
    const expected = cube.getFacelets();

    const captured = buildSyntheticCapturedFaces(expected, (rgb) => rgb);
    // Corrupt one non-center orange ('L') tile on U[0] slightly toward Red ('R')
    // (still closer to L than other colors except R, forcing global constraint check)
    captured.U[0] = rgbToLab({ r: 222, g: 55, b: 30 });

    const solved = calibrateAndSolveColors(captured);
    const counts: Record<string, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
    for (const ch of solved) {
      counts[ch]++;
    }

    for (const f of ALL_FACES) {
      expect(counts[f]).toBe(9);
    }
  });
});
