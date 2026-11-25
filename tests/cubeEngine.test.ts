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

  it('should correctly determine moves from drag on center, edge, and corner pieces across faces', async () => {
    const { CubeEngine } = await import('../src/engine/CubeEngine');
    const engine = new CubeEngine();

    const mockSticker = (face: Face, isCenter: boolean, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh();
      const cubie = new THREE.Mesh();
      cubie.position.set(x, y, z);
      mesh.userData = {
        initialFace: face,
        isCenter,
        cubie,
      };
      return mesh;
    };

    // 1. Center piece of Front face (swipe right -> F, swipe left -> F')
    const centerF = mockSticker('F', true, 0, 0, 1);
    expect(engine.determineMoveFromDrag(centerF, 50, 0)).toBe('F');
    expect(engine.determineMoveFromDrag(centerF, -50, 0)).toBe("F'");

    // 2. Top row of Front face (swipe right -> U', swipe left -> U)
    const topEdgeF = mockSticker('F', false, 0, 1, 1);
    expect(engine.determineMoveFromDrag(topEdgeF, 50, 0)).toBe("U'");
    expect(engine.determineMoveFromDrag(topEdgeF, -50, 0)).toBe('U');

    // 3. Right column of Front face (swipe up -> R, swipe down -> R')
    const rightEdgeF = mockSticker('F', false, 1, 0, 1);
    expect(engine.determineMoveFromDrag(rightEdgeF, 0, -50)).toBe('R');
    expect(engine.determineMoveFromDrag(rightEdgeF, 0, 50)).toBe("R'");

    // 4. Center piece of Up face (swipe right -> U, swipe left -> U')
    const centerU = mockSticker('U', true, 0, 1, 0);
    expect(engine.determineMoveFromDrag(centerU, 50, 0)).toBe('U');
    expect(engine.determineMoveFromDrag(centerU, -50, 0)).toBe("U'");

    // 5. Center piece of Right face (swipe right -> R, swipe left -> R')
    const centerR = mockSticker('R', true, 1, 0, 0);
    expect(engine.determineMoveFromDrag(centerR, 50, 0)).toBe('R');
    expect(engine.determineMoveFromDrag(centerR, -50, 0)).toBe("R'");
  });

  it('should handle rotated cubie stickers using true world normals rather than stale initialFace', async () => {
    const { CubeEngine } = await import('../src/engine/CubeEngine');
    const engine = new CubeEngine();

    // Simulate a cubie originally from (1, 1, 1) whose Front sticker rotated onto Up (+Y) after R move:
    const cubie = new THREE.Mesh();
    cubie.position.set(1, 1, -1);
    cubie.rotation.set(-Math.PI / 2, 0, 0); // R turn rotates +Z local face -> +Y world!
    cubie.updateMatrixWorld(true);

    const sticker = new THREE.Mesh();
    sticker.position.set(0, 0, 0.472); // Originally placed on +Z (initialFace: 'F')
    sticker.rotation.set(0, 0, 0);
    cubie.add(sticker);
    cubie.updateMatrixWorld(true);

    sticker.userData = {
      initialFace: 'F',
      isCenter: false,
      cubie,
    };

    // Verify local +Z transformed into world +Y
    const worldNormal = new THREE.Vector3(0, 0, 1).transformDirection(sticker.matrixWorld).round();
    expect(worldNormal.y).toBe(1);

    // Dragging RIGHT horizontally (+X) on this rotated top sticker (z = -1 back edge of U) should turn B' / B, NOT U!
    const moveRight = engine.determineMoveFromDrag(sticker, 50, 0);
    expect(moveRight).toBe("B'");
    const moveLeft = engine.determineMoveFromDrag(sticker, -50, 0);
    expect(moveLeft).toBe('B');
  });
});
