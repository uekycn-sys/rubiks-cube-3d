/**
 * CIELAB Color Space Converter & Dynamic Center-Calibrated Rubik's Cube Color Classifier
 * Resilient against warm/cool indoor lighting shifts by calibrating against the 6 fixed center tiles
 * and solving a constrained global minimum-DeltaE assignment (strictly 9 tiles per color).
 */

import { Face, FACE_OFFSETS } from './types';

export interface RgbColor {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

export interface LabColor {
  L: number; // 0..100
  a: number; // ~ -128..127
  b: number; // ~ -128..127
}

export const ALL_FACES: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
export const SCAN_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];

/**
 * Standard D65 reference CIELAB centroids used ONLY for live single-face preview dots
 * before all 6 centers have been captured.
 */
export const DEFAULT_LAB_CENTROIDS: Record<Face, LabColor> = {
  U: { L: 94, a: 0, b: 2 },     // White
  R: { L: 46, a: 64, b: 42 },   // Red
  F: { L: 56, a: -54, b: 36 },  // Green
  D: { L: 84, a: -4, b: 78 },   // Yellow
  L: { L: 65, a: 44, b: 64 },   // Orange
  B: { L: 42, a: 12, b: -58 },  // Blue
};

/**
 * Converts sRGB (0..255) to CIE L*a*b* (D65 illuminant)
 */
export function rgbToLab({ r, g, b }: RgbColor): LabColor {
  const toLinear = (c: number): number => {
    const v = Math.max(0, Math.min(255, c)) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);

  // sRGB to XYZ (D65)
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  const z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const f = (t: number): number =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Shadow-resilient perceptual distance in CIELAB.
 * Slightly down-weights lightness L* (0.5x) so lighting brightness differences across cube
 * tilts do not overpower hue/chroma cues (a*, b*), while keeping red vs orange & white vs yellow distinct.
 */
export function deltaELabWeighted(c1: LabColor, c2: LabColor): number {
  const dL = (c1.L - c2.L) * 0.5;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Classifies a single LAB color against a given centroid table (used for live video preview).
 */
export function classifyLabAgainstCentroids(
  lab: LabColor,
  centroids: Record<Face, LabColor> = DEFAULT_LAB_CENTROIDS
): Face {
  let bestFace: Face = 'U';
  let minDist = Infinity;

  for (const face of ALL_FACES) {
    const dist = deltaELabWeighted(lab, centroids[face]);
    if (dist < minDist) {
      minDist = dist;
      bestFace = face;
    }
  }
  return bestFace;
}

/**
 * Dynamically calibrates against the 6 captured center tiles (sub-index 4 on each face)
 * and solves the globally optimal 48-tile assignment subject to strictly 9 tiles per color
 * (6 fixed centers + 8 assigned outer tiles per color).
 *
 * Uses Negative Cycle Elimination on the 6-color residual graph to guarantee the exact
 * global minimum total perceptual Delta-E error.
 */
export function calibrateAndSolveColors(
  capturedFaces: Record<Face, LabColor[]>
): string {
  // 1. Extract the 6 real-world center LAB centroids under current lighting
  const centroids: Record<Face, LabColor> = {
    U: capturedFaces.U[4],
    R: capturedFaces.R[4],
    F: capturedFaces.F[4],
    D: capturedFaces.D[4],
    L: capturedFaces.L[4],
    B: capturedFaces.B[4],
  };

  // 2. Collect the 48 non-center facelet indices & compute cost[i][colorIdx]
  interface TileItem {
    faceletIndex: number;
    costs: number[]; // length 6 matching ALL_FACES order
  }

  const items: TileItem[] = [];
  const result = new Array<Face>(54);

  for (const face of ALL_FACES) {
    const offset = FACE_OFFSETS[face];
    const samples = capturedFaces[face];
    for (let sub = 0; sub < 9; sub++) {
      const idx = offset + sub;
      if (sub === 4) {
        // Center piece is fixed by standard cube orientation
        result[idx] = face;
      } else {
        const lab = samples[sub];
        const costs = ALL_FACES.map((targetFace) => deltaELabWeighted(lab, centroids[targetFace]));
        items.push({ faceletIndex: idx, costs });
      }
    }
  }

  // 3. Initial feasible assignment (exactly 8 items per color) ordered by highest confidence margin
  const assignment = new Array<number>(48).fill(0);
  const buckets: number[][] = [[], [], [], [], [], []]; // item indices (0..47) assigned to each color

  const itemMargins = items.map((item, idx) => {
    const sorted = [...item.costs].sort((a, b) => a - b);
    return { idx, margin: sorted[1] - sorted[0] };
  });
  // Assign most unambiguous tiles first
  itemMargins.sort((a, b) => b.margin - a.margin);

  for (const { idx } of itemMargins) {
    const costs = items[idx].costs;
    let bestColor = 0;
    let bestCost = Infinity;
    for (let c = 0; c < 6; c++) {
      if (buckets[c].length < 8 && costs[c] < bestCost) {
        bestCost = costs[c];
        bestColor = c;
      }
    }
    assignment[idx] = bestColor;
    buckets[bestColor].push(idx);
  }

  // 4. Global optimal refinement via Negative Cycle Elimination in the 6-color residual graph
  // By the Negative Cycle Theorem, a capacity-constrained assignment is globally minimum-cost
  // iff no negative-cost cyclic exchange exists among the 6 colors.
  const EPS = 1e-6;
  for (let iter = 0; iter < 200; iter++) {
    // Build 6x6 residual edge weights W[c1][c2] = min_{i in c1} (cost[i][c2] - cost[i][c1])
    const W: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(Infinity));
    const bestItemForEdge: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(-1));

    for (let c1 = 0; c1 < 6; c1++) {
      for (const itemIdx of buckets[c1]) {
        const curCost = items[itemIdx].costs[c1];
        for (let c2 = 0; c2 < 6; c2++) {
          if (c1 === c2) continue;
          const delta = items[itemIdx].costs[c2] - curCost;
          if (delta < W[c1][c2]) {
            W[c1][c2] = delta;
            bestItemForEdge[c1][c2] = itemIdx;
          }
        }
      }
    }

    // Bellman-Ford from virtual super-source to find any negative cycle on 6 vertices
    const dist = new Array(6).fill(0);
    const parent = new Array(6).fill(-1);
    let cycleStart = -1;

    for (let step = 0; step < 6; step++) {
      cycleStart = -1;
      for (let u = 0; u < 6; u++) {
        for (let v = 0; v < 6; v++) {
          if (u === v) continue;
          if (dist[u] + W[u][v] < dist[v] - EPS) {
            dist[v] = dist[u] + W[u][v];
            parent[v] = u;
            cycleStart = v;
          }
        }
      }
    }

    if (cycleStart === -1) {
      // No negative cycles remain: assignment is provably global optimum!
      break;
    }

    // Trace back 6 steps to guarantee landing inside the cycle
    let node = cycleStart;
    for (let k = 0; k < 6; k++) {
      node = parent[node];
    }

    const cycleNodes: number[] = [];
    let cur = node;
    do {
      cycleNodes.push(cur);
      cur = parent[cur];
    } while (cur !== node && cycleNodes.length <= 6);
    cycleNodes.reverse(); // Forward order: c_0 -> c_1 -> ... -> c_{k-1} -> c_0

    // Collect items to shift before mutating buckets
    const moves: Array<{ itemIdx: number; fromColor: number; toColor: number }> = [];
    for (let i = 0; i < cycleNodes.length; i++) {
      const fromColor = cycleNodes[i];
      const toColor = cycleNodes[(i + 1) % cycleNodes.length];
      const itemIdx = bestItemForEdge[fromColor][toColor];
      moves.push({ itemIdx, fromColor, toColor });
    }

    // Apply cyclic exchange (strictly preserves count = 8 per color)
    for (const m of moves) {
      assignment[m.itemIdx] = m.toColor;
      const pos = buckets[m.fromColor].indexOf(m.itemIdx);
      if (pos !== -1) buckets[m.fromColor].splice(pos, 1);
      buckets[m.toColor].push(m.itemIdx);
    }
  }

  // 5. Write resolved 54-char facelet string
  for (let i = 0; i < items.length; i++) {
    result[items[i].faceletIndex] = ALL_FACES[assignment[i]];
  }

  return result.join('');
}

/**
 * Extracts 9 averaged 10x10px CIELAB color samples from a square VideoFrame crop drawn onto an offscreen canvas.
 * Assumes `canvas` is a square (e.g., 90x90) holding the exact 3x3 grid viewport crop.
 */
export function sampleGrid3x3FromCanvas(
  ctx: CanvasRenderingContext2D,
  canvasSize: number
): LabColor[] {
  const cellSize = canvasSize / 3;
  const sampleRadius = 5; // 10x10 region (from -5 to +4 around cell center)
  const samples: LabColor[] = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = Math.round((col + 0.5) * cellSize);
      const cy = Math.round((row + 0.5) * cellSize);
      const sx = Math.max(0, cx - sampleRadius);
      const sy = Math.max(0, cy - sampleRadius);
      const sw = Math.min(canvasSize - sx, sampleRadius * 2);
      const sh = Math.min(canvasSize - sy, sampleRadius * 2);

      const imageData = ctx.getImageData(sx, sy, sw, sh).data;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      const pixelCount = sw * sh;

      for (let i = 0; i < imageData.length; i += 4) {
        sumR += imageData[i];
        sumG += imageData[i + 1];
        sumB += imageData[i + 2];
      }

      samples.push(
        rgbToLab({
          r: sumR / pixelCount,
          g: sumG / pixelCount,
          b: sumB / pixelCount,
        })
      );
    }
  }

  return samples;
}
