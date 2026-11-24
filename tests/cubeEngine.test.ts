import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { THEME_PALETTES } from '../src/engine/themes';
import { createLayerHighlight, createCurvedArrow } from '../src/engine/arrowHelper';
import { ALL_MOVES, ColorTheme, Face } from '../src/core/types';

describe('CubeEngine Helpers & 3D Generators', () => {
  it('should define all 4 required color themes with complete palette', () => {
    const requiredThemes: ColorTheme[] = ['classic', 'cyberpunk', 'morandi', 'aurora'];
    const requiredFaces: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

    for (const theme of requiredThemes) {
      const palette = THEME_PALETTES[theme];
      expect(palette, `Missing palette for theme ${theme}`).toBeDefined();
      expect(palette.name).toBeTruthy();
      expect(typeof palette.body).toBe('number');
      expect(typeof palette.unpainted).toBe('number');

      for (const face of requiredFaces) {
        expect(typeof palette[face], `Missing face ${face} in theme ${theme}`).toBe('number');
      }
    }
  });

  it('should generate 3D layer highlight for all 6 faces', () => {
    const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
    for (const face of faces) {
      const group = createLayerHighlight(face);
      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe('LayerHighlight');
      expect(group.children.length).toBeGreaterThanOrEqual(2); // Fill mesh + Edges mesh
    }
  });

  it('should generate 3D curved neon direction arrows for all 18 Singmaster moves', () => {
    for (const move of ALL_MOVES) {
      const arrowGroup = createCurvedArrow(move);
      expect(arrowGroup).toBeInstanceOf(THREE.Group);
      expect(arrowGroup.name).toBe('CurvedArrow');
      expect(arrowGroup.children.length).toBeGreaterThanOrEqual(2); // Tube + Cone
    }
  });
});
