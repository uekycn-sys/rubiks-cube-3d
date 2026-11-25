/**
 * 3D Rubik's Cube Engine (Three.js)
 * High-performance, silky-smooth WebGL rendering and interaction engine
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import {
  Move,
  Face,
  ColorTheme,
} from '../core/types';
import { CubeState, CENTER_FACELETS } from '../core/cubeState';
import { THEME_PALETTES, CubePalette } from './themes';
import { createLayerHighlight, createCurvedArrow } from './arrowHelper';

export type CameraViewPreset = 'HOME' | 'TOP' | 'BOTTOM' | 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';

export interface CubeEngineCallbacks {
  onMoveComplete?: (move: Move, remaining: number) => void;
  onQueueFinished?: () => void;
  onFaceletClick?: (faceletIndex: number, isCenter: boolean) => void;
  onFaceletHover?: (faceletIndex: number | null, isCenter?: boolean) => void;
  onSound?: (type: 'turn' | 'snap' | 'click' | 'paint') => void;
}

export class CubeEngine {
  private container!: HTMLElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private cubeRoot!: THREE.Group;
  private pivot!: THREE.Group;
  private tutorGroup!: THREE.Group;

  private cubies: THREE.Mesh[] = [];
  private stickerMeshes: (THREE.Mesh | null)[] = new Array(54).fill(null);
  private cubieInitialPositions: Map<THREE.Mesh, THREE.Vector3> = new Map();

  private theme: ColorTheme = 'classic';
  private palette: CubePalette = THEME_PALETTES.classic;
  private cubeState: CubeState = new CubeState();

  // Animation & Queue
  private moveQueue: Move[] = [];
  private isAnimating = false;
  private baseTurnDuration = 320; // ms

  // Interaction
  private mode: 'free' | 'paint' | 'tutor' | 'level' | 'speedrun' = 'free';
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private isPointerDown = false;
  private pointerDownPos = new THREE.Vector2();
  private pointerDownTime = 0;
  private intersectedSticker: THREE.Mesh | null = null;
  private hoveredFaceletIndex: number | null = null;
  private currentPreviewMove: Move | null = null;

  // Camera Animation
  private isCameraMoving = false;
  private cameraStartPos = new THREE.Vector3();
  private cameraEndPos = new THREE.Vector3();
  private cameraAnimStart = 0;
  private cameraAnimDuration = 400; // ms

  // Callbacks
  public callbacks: CubeEngineCallbacks = {};

  // Lifecycle & Animation Safety Guard
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private currentMoveRafId: number | null = null;
  private currentMoveResolver: (() => void) | null = null;

  constructor(callbacks: CubeEngineCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public init(container: HTMLElement): void {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    this.camera.position.set(3.6, 3.2, 5.8); // Calibrated 3/4 handheld view: White top, Green front-left, Red right
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. Environment & Lighting
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(5, 8, 5);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight2.position.set(-5, -4, -5);
    this.scene.add(dirLight2);

    // 5. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 12.0;

    // 6. Hierarchy Groups
    this.cubeRoot = new THREE.Group();
    this.scene.add(this.cubeRoot);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.tutorGroup = new THREE.Group();
    this.scene.add(this.tutorGroup);

    // 7. Build Cubies & Stickers
    this.buildCube();

    // 8. Event Listeners
    this.setupEvents();

    // 9. Start Loop
    this.animate();
  }

  /**
   * Builds the 26 physical cubies and 54 stickers
   */
  private buildCube(): void {
    // Clear previous
    while (this.cubeRoot.children.length > 0) {
      this.cubeRoot.remove(this.cubeRoot.children[0]);
    }
    this.cubies = [];
    this.stickerMeshes = new Array(54).fill(null);
    this.cubieInitialPositions.clear();

    const cubieGeo = new RoundedBoxGeometry(0.94, 0.94, 0.94, 4, 0.07);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: this.palette.body,
      roughness: 0.65,
      metalness: 0.1,
      clearcoat: 0.1,
    });

    const stickerGeo = new RoundedBoxGeometry(0.82, 0.82, 0.02, 2, 0.04);

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // Core block omitted

          const cubie = new THREE.Mesh(cubieGeo, bodyMat.clone());
          cubie.position.set(x, y, z);
          cubie.userData = { initialX: x, initialY: y, initialZ: z };
          this.cubieInitialPositions.set(cubie, new THREE.Vector3(x, y, z));
          this.cubeRoot.add(cubie);
          this.cubies.push(cubie);

          // Add stickers on exposed faces
          // U: y === 1
          if (y === 1) {
            const idx = this.coordsToFaceletIndex('U', x, y, z);
            this.createSticker(cubie, stickerGeo, 'U', idx, new THREE.Vector3(0, 0.472, 0), new THREE.Euler(-Math.PI / 2, 0, 0));
          }
          // D: y === -1
          if (y === -1) {
            const idx = this.coordsToFaceletIndex('D', x, y, z);
            this.createSticker(cubie, stickerGeo, 'D', idx, new THREE.Vector3(0, -0.472, 0), new THREE.Euler(Math.PI / 2, 0, 0));
          }
          // F: z === 1
          if (z === 1) {
            const idx = this.coordsToFaceletIndex('F', x, y, z);
            this.createSticker(cubie, stickerGeo, 'F', idx, new THREE.Vector3(0, 0, 0.472), new THREE.Euler(0, 0, 0));
          }
          // B: z === -1
          if (z === -1) {
            const idx = this.coordsToFaceletIndex('B', x, y, z);
            this.createSticker(cubie, stickerGeo, 'B', idx, new THREE.Vector3(0, 0, -0.472), new THREE.Euler(0, Math.PI, 0));
          }
          // L: x === -1
          if (x === -1) {
            const idx = this.coordsToFaceletIndex('L', x, y, z);
            this.createSticker(cubie, stickerGeo, 'L', idx, new THREE.Vector3(-0.472, 0, 0), new THREE.Euler(0, -Math.PI / 2, 0));
          }
          // R: x === 1
          if (x === 1) {
            const idx = this.coordsToFaceletIndex('R', x, y, z);
            this.createSticker(cubie, stickerGeo, 'R', idx, new THREE.Vector3(0.472, 0, 0), new THREE.Euler(0, Math.PI / 2, 0));
          }
        }
      }
    }
  }

  /**
   * Maps 3D cubie coordinate (x, y, z) on a specific face to standard 54-facelet index
   */
  private coordsToFaceletIndex(face: Face, x: number, y: number, z: number): number {
    switch (face) {
      case 'U': // y = 1; Row 0: z=-1, Row 1: z=0, Row 2: z=1; Col 0: x=-1, Col 1: x=0, Col 2: x=1
        return 0 + (z + 1) * 3 + (x + 1);
      case 'D': // y = -1; Row 0: z=1, Row 1: z=0, Row 2: z=-1; Col 0: x=-1, Col 1: x=0, Col 2: x=1
        return 27 + (1 - z) * 3 + (x + 1);
      case 'F': // z = 1; Row 0: y=1, Row 1: y=0, Row 2: y=-1; Col 0: x=-1, Col 1: x=0, Col 2: x=1
        return 18 + (1 - y) * 3 + (x + 1);
      case 'B': // z = -1; Row 0: y=1, Row 1: y=0, Row 2: y=-1; Col 0: x=1, Col 1: x=0, Col 2: x=-1
        return 45 + (1 - y) * 3 + (1 - x);
      case 'L': // x = -1; Row 0: y=1, Row 1: y=0, Row 2: y=-1; Col 0: z=-1, Col 1: z=0, Col 2: z=1
        return 36 + (1 - y) * 3 + (z + 1);
      case 'R': // x = 1; Row 0: y=1, Row 1: y=0, Row 2: y=-1; Col 0: z=1, Col 1: z=0, Col 2: z=-1
        return 9 + (1 - y) * 3 + (1 - z);
    }
  }

  private createSticker(
    cubie: THREE.Mesh,
    geo: THREE.BufferGeometry,
    face: Face,
    faceletIndex: number,
    pos: THREE.Vector3,
    rot: THREE.Euler
  ): void {
    const isCenter = CENTER_FACELETS.includes(faceletIndex);
    const color = this.palette[face];

    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });

    const sticker = new THREE.Mesh(geo, mat);
    sticker.position.copy(pos);
    sticker.rotation.copy(rot);
    sticker.userData = {
      isFacelet: true,
      faceletIndex,
      isCenter,
      initialFace: face,
      cubie,
    };

    cubie.add(sticker);
    this.stickerMeshes[faceletIndex] = sticker;
  }

  /**
   * Resets all cubies cleanly to solved coordinates and applies facelet colors
   */
  public setStateFromFacelets(facelets: string): void {
    // 1. Reset all cubies physical positions and orthogonal orientation
    for (const cubie of this.cubies) {
      const initPos = this.cubieInitialPositions.get(cubie);
      if (initPos) {
        cubie.position.copy(initPos);
      }
      cubie.rotation.set(0, 0, 0);
      cubie.quaternion.identity();
      cubie.updateMatrix();
      cubie.updateMatrixWorld();
    }

    // 2. Update sticker colors according to 54-char string
    for (let i = 0; i < 54; i++) {
      const sticker = this.stickerMeshes[i];
      if (!sticker) continue;

      const char = facelets[i] || 'X';
      const mat = sticker.material as THREE.MeshPhysicalMaterial;

      if (char === 'X') {
        // Translucent unpainted slate grid appearance
        mat.color.setHex(this.palette.unpainted);
        mat.transparent = true;
        mat.opacity = 0.55;
        mat.roughness = 0.6;
        mat.clearcoat = 0.1;
      } else {
        const faceChar = char as Face;
        mat.color.setHex(this.palette[faceChar]);
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.roughness = 0.25;
        mat.clearcoat = 0.85;
      }
    }

    this.cubeState.setFacelets(facelets);
  }

  public getTheme(): ColorTheme {
    return this.theme;
  }

  public setTheme(theme: ColorTheme): void {
    this.theme = theme;
    this.palette = THEME_PALETTES[theme];

    // Refresh cubie bodies
    for (const cubie of this.cubies) {
      (cubie.material as THREE.MeshPhysicalMaterial).color.setHex(this.palette.body);
    }

    // Refresh stickers
    this.setStateFromFacelets(this.cubeState.getFacelets());
  }

  public getFacelets(): string {
    return this.cubeState.getFacelets();
  }

  public isSolved(): boolean {
    return this.cubeState.isSolved();
  }

  public setInteractionMode(mode: 'free' | 'paint' | 'tutor' | 'level' | 'speedrun'): void {
    this.mode = mode;
    if (mode === 'paint') {
      this.hideTutorGuide();
    }
  }

  /**
   * Immediately finishes or cancels any active rotation, restoring pivot and snapping all cubies cleanly.
   * Guarantees 0 orphaned cubies in pivot, 0 floating rotation drift.
   */
  public cancelAnimations(): void {
    if (this.currentMoveRafId !== null) {
      cancelAnimationFrame(this.currentMoveRafId);
      this.currentMoveRafId = null;
    }

    // If cubies are attached to pivot, re-attach to cubeRoot with snapped coordinates
    if (this.pivot.children.length > 0) {
      while (this.pivot.children.length > 0) {
        const cubie = this.pivot.children[0] as THREE.Mesh;
        this.cubeRoot.attach(cubie);
        cubie.position.x = Math.round(cubie.position.x);
        cubie.position.y = Math.round(cubie.position.y);
        cubie.position.z = Math.round(cubie.position.z);
        this.snapRotationToOrthogonal(cubie);
        cubie.updateMatrix();
        cubie.updateMatrixWorld();
      }
    }
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.updateMatrixWorld();

    this.moveQueue = [];
    this.isAnimating = false;

    if (this.currentMoveResolver) {
      const resolve = this.currentMoveResolver;
      this.currentMoveResolver = null;
      resolve();
    }
  }

  /**
   * Reliable async move execution:
   * Plays a smooth 3D layer rotation with guaranteed duration and snaps upon landing before resolving.
   */
  public async playMoveAsync(move: Move, durationMs = 350): Promise<void> {
    // If an animation is already in progress, safely finish/cancel it first
    if (this.isAnimating) {
      this.cancelAnimations();
    }

    this.isAnimating = true;

    await this.executeMoveAnimation(move, Math.max(60, durationMs));

    // Update logical cube state
    this.cubeState.applyMove(move);

    this.isAnimating = false;

    // Trigger audio snap effect
    this.callbacks.onSound?.('snap');

    // Trigger move complete callback
    this.callbacks.onMoveComplete?.(move, this.moveQueue.length);
  }

  /**
   * Applies a single Singmaster move with smooth animation and mathematical guard rails
   */
  public async applyMove(move: Move, speedFactor = 1.0): Promise<void> {
    if (this.isAnimating) {
      // If already animating, queue it
      this.moveQueue.push(move);
      return;
    }

    const duration = Math.max(80, Math.round(this.baseTurnDuration / speedFactor));
    await this.playMoveAsync(move, duration);

    // Process next queued move if any
    if (this.moveQueue.length > 0) {
      const nextMove = this.moveQueue.shift()!;
      await this.applyMove(nextMove, speedFactor);
    } else {
      this.callbacks.onQueueFinished?.();
    }
  }

  /**
   * Queues an array of moves to execute sequentially
   */
  public async queueMoves(moves: Move[], speedFactor = 1.0): Promise<void> {
    for (const m of moves) {
      await this.applyMove(m, speedFactor);
    }
  }

  public clearQueue(): void {
    this.moveQueue = [];
  }

  /**
   * Core rotation animation with pivot attachment and zero floating-point drift
   */
  private executeMoveAnimation(move: Move, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.currentMoveResolver = resolve;

      const face = move[0] as Face;
      const isCCW = move.includes("'");
      const isDouble = move.includes('2');

      // 1. Determine rotation axis, layer coordinate and target angle strictly aligned with WCA
      // WCA Right-Hand System: +X Right, +Y Up, +Z Front
      // R: -X, L: +X, U: -Y, D: +Y, F: -Z, B: +Z
      let axis = 'y';
      let layerCoord = 1;
      let angle = -Math.PI / 2;

      switch (face) {
        case 'U':
          axis = 'y';
          layerCoord = 1;
          angle = isCCW ? Math.PI / 2 : -Math.PI / 2;
          break;
        case 'D':
          axis = 'y';
          layerCoord = -1;
          angle = isCCW ? -Math.PI / 2 : Math.PI / 2;
          break;
        case 'R':
          axis = 'x';
          layerCoord = 1;
          angle = isCCW ? Math.PI / 2 : -Math.PI / 2;
          break;
        case 'L':
          axis = 'x';
          layerCoord = -1;
          angle = isCCW ? -Math.PI / 2 : Math.PI / 2;
          break;
        case 'F':
          axis = 'z';
          layerCoord = 1;
          angle = isCCW ? Math.PI / 2 : -Math.PI / 2;
          break;
        case 'B':
          axis = 'z';
          layerCoord = -1;
          angle = isCCW ? -Math.PI / 2 : Math.PI / 2;
          break;
      }

      if (isDouble) {
        angle = isCCW ? -Math.PI : Math.PI;
      }

      // 2. Collect 9 cubies in target layer
      const layerCubies: THREE.Mesh[] = [];
      for (const cubie of this.cubies) {
        const val = Math.round(
          axis === 'x' ? cubie.position.x : axis === 'y' ? cubie.position.y : cubie.position.z
        );
        if (val === layerCoord) {
          layerCubies.push(cubie);
        }
      }

      // 3. Attach cubies to clean pivot
      this.pivot.rotation.set(0, 0, 0);
      this.pivot.position.set(0, 0, 0);
      this.pivot.updateMatrixWorld();

      for (const cubie of layerCubies) {
        this.pivot.attach(cubie);
      }

      // 4. Animate with easeInOutCubic
      const startTime = performance.now();

      const animateStep = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const ease = this.easeInOutCubic(progress);

        if (axis === 'x') this.pivot.rotation.x = angle * ease;
        if (axis === 'y') this.pivot.rotation.y = angle * ease;
        if (axis === 'z') this.pivot.rotation.z = angle * ease;

        if (progress < 1.0) {
          this.currentMoveRafId = requestAnimationFrame(animateStep);
        } else {
          this.currentMoveRafId = null;
          // 5. Finalize rotation: re-attach to cubeRoot, round position to {-1,0,1}, snap orthogonal
          if (axis === 'x') this.pivot.rotation.x = angle;
          if (axis === 'y') this.pivot.rotation.y = angle;
          if (axis === 'z') this.pivot.rotation.z = angle;
          this.pivot.updateMatrixWorld();

          for (const cubie of layerCubies) {
            this.cubeRoot.attach(cubie);
            // Snap position
            cubie.position.x = Math.round(cubie.position.x);
            cubie.position.y = Math.round(cubie.position.y);
            cubie.position.z = Math.round(cubie.position.z);
            // Snap orientation to closest 90-degree orthogonal matrix
            this.snapRotationToOrthogonal(cubie);
            cubie.updateMatrix();
            cubie.updateMatrixWorld();
          }

          this.pivot.rotation.set(0, 0, 0);
          this.pivot.updateMatrixWorld();

          if (this.currentMoveResolver === resolve) {
            this.currentMoveResolver = null;
          }
          resolve();
        }
      };

      this.currentMoveRafId = requestAnimationFrame(animateStep);
    });
  }

  private snapRotationToOrthogonal(object: THREE.Object3D): void {
    const euler = new THREE.Euler().setFromQuaternion(object.quaternion, 'XYZ');
    const snap = (rad: number) => Math.round(rad / (Math.PI / 2)) * (Math.PI / 2);
    euler.x = snap(euler.x);
    euler.y = snap(euler.y);
    euler.z = snap(euler.z);
    object.quaternion.setFromEuler(euler);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * 3D Tutor Mode: Highlights the target layer and renders 3D curved neon direction arrow
   */
  public showTutorGuide(move: Move): void {
    this.hideTutorGuide();

    const face = move[0] as Face;
    const highlight = createLayerHighlight(face);
    const arrow = createCurvedArrow(move);

    this.tutorGroup.add(highlight);
    this.tutorGroup.add(arrow);
  }

  public hideTutorGuide(): void {
    while (this.tutorGroup.children.length > 0) {
      const child = this.tutorGroup.children[0];
      this.tutorGroup.remove(child);
    }
  }

  /**
   * Smoothly aligns camera to 6 standard face views or isometric Home
   */
  public alignCamera(view: CameraViewPreset): void {
    const targetPos = new THREE.Vector3();
    const distance = 6.8;

    switch (view) {
      case 'HOME':
        targetPos.set(3.6, 3.2, 5.8);
        break;
      case 'TOP': // U (+Y)
        targetPos.set(0.001, distance, 0.001);
        break;
      case 'BOTTOM': // D (-Y)
        targetPos.set(0.001, -distance, 0.001);
        break;
      case 'FRONT': // F (+Z)
        targetPos.set(0, 0, distance);
        break;
      case 'BACK': // B (-Z)
        targetPos.set(0, 0, -distance);
        break;
      case 'RIGHT': // R (+X)
        targetPos.set(distance, 0, 0);
        break;
      case 'LEFT': // L (-X)
        targetPos.set(-distance, 0, 0);
        break;
    }

    this.isCameraMoving = true;
    this.cameraStartPos.copy(this.camera.position);
    this.cameraEndPos.copy(targetPos);
    this.cameraAnimStart = performance.now();
  }

  /**
   * Event listeners and Raycaster drag-to-rotate / click-to-paint logic
   */
  private setupEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.pointerDownPos.set(e.clientX, e.clientY);
      this.pointerDownTime = performance.now();
      this.currentPreviewMove = null;

      this.updateMouse(e);
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.cubies, true);

      this.intersectedSticker = null;
      for (const hit of hits) {
        if (hit.object.userData?.isFacelet) {
          this.intersectedSticker = hit.object as THREE.Mesh;
          break;
        }
      }

      // If user touches a cube piece in game/free/speedrun/level mode:
      // LOCK OrbitControls so dragging rotates the specific cube layer, NOT the entire camera view!
      if (this.intersectedSticker && this.mode !== 'paint') {
        this.controls.enabled = false;
      } else {
        this.controls.enabled = true;
      }
    });

    window.addEventListener('pointermove', (e) => {
      this.updateMouse(e);

      // Handle hover in paint mode
      if (this.mode === 'paint' && !this.isPointerDown) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.cubies, true);
        let foundIdx: number | null = null;
        let isCenter = false;

        for (const hit of hits) {
          if (hit.object.userData?.isFacelet) {
            foundIdx = hit.object.userData.faceletIndex;
            isCenter = hit.object.userData.isCenter;
            break;
          }
        }

        if (foundIdx !== this.hoveredFaceletIndex) {
          this.hoveredFaceletIndex = foundIdx;
          this.callbacks.onFaceletHover?.(foundIdx, isCenter);
        }
      } else if (this.isPointerDown && this.intersectedSticker && this.mode !== 'paint' && this.mode !== 'tutor') {
        // Drag turn prospective preview (Layer Highlight Box + 3D Curved Arrow preview)
        const deltaX = e.clientX - this.pointerDownPos.x;
        const deltaY = e.clientY - this.pointerDownPos.y;
        const dist = Math.hypot(deltaX, deltaY);

        if (dist > 12) {
          const prospectiveMove = this.determineMoveFromDrag(this.intersectedSticker, deltaX, deltaY);
          if (prospectiveMove && prospectiveMove !== this.currentPreviewMove) {
            this.currentPreviewMove = prospectiveMove;
            this.showTutorGuide(prospectiveMove);
          }
        } else if (dist <= 6 && this.currentPreviewMove) {
          this.hideTutorGuide();
          this.currentPreviewMove = null;
        }
      }
    });

    const handlePointerUpOrCancel = (e: PointerEvent | MouseEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      this.controls.enabled = true; // Always restore camera control

      const deltaX = e.clientX - this.pointerDownPos.x;
      const deltaY = e.clientY - this.pointerDownPos.y;
      const dist = Math.hypot(deltaX, deltaY);
      const duration = performance.now() - this.pointerDownTime;

      // Click detection (short duration, small distance)
      if (dist < 8 && duration < 350) {
        if (this.intersectedSticker && this.mode === 'paint') {
          const { faceletIndex, isCenter } = this.intersectedSticker.userData;
          this.callbacks.onFaceletClick?.(faceletIndex, isCenter);
          this.callbacks.onSound?.('click');
        }
      } else if (dist >= 16 && this.mode !== 'paint' && this.mode !== 'tutor') {
        // Apply detected move
        const move = this.currentPreviewMove || (this.intersectedSticker ? this.determineMoveFromDrag(this.intersectedSticker, deltaX, deltaY) : null);
        if (move) {
          this.applyMove(move);
        }
      }

      if (this.currentPreviewMove) {
        this.hideTutorGuide();
        this.currentPreviewMove = null;
      }
      this.intersectedSticker = null;
    };

    window.addEventListener('pointerup', handlePointerUpOrCancel);
    window.addEventListener('pointercancel', handlePointerUpOrCancel);

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.container);
  }

  private updateMouse(e: PointerEvent | MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Converts 2D screen drag on a cubie face into corresponding 3D Singmaster move
   * Supports all 6 faces (U, D, L, R, F, B), center pieces (direct face rotation),
   * and edge/corner pieces (layer rotation).
   */
  public determineMoveFromDrag(sticker: THREE.Mesh, deltaX: number, deltaY: number): Move | null {
    if (this.isAnimating) return null;

    const initialFace = sticker.userData.initialFace as Face;
    const isCenter = sticker.userData.isCenter as boolean;
    const cubie = sticker.userData.cubie as THREE.Mesh;
    const pos = cubie.position;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 1. Center piece drag: Directly rotates the face itself!
    if (isCenter) {
      switch (initialFace) {
        case 'F':
          return (deltaX > 0 || (absY > absX && deltaY < 0)) ? 'F' : "F'";
        case 'B':
          return (deltaX < 0 || (absY > absX && deltaY < 0)) ? 'B' : "B'";
        case 'R':
          return (deltaX > 0 || (absY > absX && deltaY < 0)) ? 'R' : "R'";
        case 'L':
          return (deltaX < 0 || (absY > absX && deltaY < 0)) ? 'L' : "L'";
        case 'U':
          return (deltaX > 0 || (absY > absX && deltaY < 0)) ? 'U' : "U'";
        case 'D':
          return (deltaX > 0 || (absY > absX && deltaY > 0)) ? 'D' : "D'";
      }
    }

    // 2. Non-center pieces (edges & corners)
    switch (initialFace) {
      case 'F':
        if (absX > absY) {
          if (pos.y > 0.3) return deltaX > 0 ? "U'" : 'U';
          if (pos.y < -0.3) return deltaX > 0 ? 'D' : "D'";
          return deltaX > 0 ? 'F' : "F'";
        } else {
          if (pos.x > 0.3) return deltaY < 0 ? 'R' : "R'";
          if (pos.x < -0.3) return deltaY > 0 ? 'L' : "L'";
          return deltaY < 0 ? 'F' : "F'";
        }

      case 'B':
        if (absX > absY) {
          if (pos.y > 0.3) return deltaX > 0 ? 'U' : "U'";
          if (pos.y < -0.3) return deltaX > 0 ? "D'" : 'D';
          return deltaX < 0 ? 'B' : "B'";
        } else {
          if (pos.x > 0.3) return deltaY < 0 ? "R'" : 'R';
          if (pos.x < -0.3) return deltaY > 0 ? "L'" : 'L';
          return deltaY < 0 ? 'B' : "B'";
        }

      case 'R':
        if (absX > absY) {
          if (pos.y > 0.3) return deltaX > 0 ? 'U' : "U'";
          if (pos.y < -0.3) return deltaX > 0 ? "D'" : 'D';
          return deltaX > 0 ? 'R' : "R'";
        } else {
          if (pos.z > 0.3) return deltaY < 0 ? 'F' : "F'";
          if (pos.z < -0.3) return deltaY > 0 ? 'B' : "B'";
          return deltaY < 0 ? 'R' : "R'";
        }

      case 'L':
        if (absX > absY) {
          if (pos.y > 0.3) return deltaX > 0 ? "U'" : 'U';
          if (pos.y < -0.3) return deltaX > 0 ? 'D' : "D'";
          return deltaX < 0 ? 'L' : "L'";
        } else {
          if (pos.z > 0.3) return deltaY < 0 ? "F'" : 'F';
          if (pos.z < -0.3) return deltaY > 0 ? "B'" : 'B';
          return deltaY < 0 ? 'L' : "L'";
        }

      case 'U':
        if (absX > absY) {
          if (pos.z > 0.3) return deltaX > 0 ? 'F' : "F'";
          if (pos.z < -0.3) return deltaX > 0 ? "B'" : 'B';
          return deltaX > 0 ? 'U' : "U'";
        } else {
          if (pos.x > 0.3) return deltaY < 0 ? 'R' : "R'";
          if (pos.x < -0.3) return deltaY > 0 ? 'L' : "L'";
          return deltaY < 0 ? 'U' : "U'";
        }

      case 'D':
        if (absX > absY) {
          if (pos.z > 0.3) return deltaX > 0 ? "F'" : 'F';
          if (pos.z < -0.3) return deltaX > 0 ? 'B' : "B'";
          return deltaX > 0 ? 'D' : "D'";
        } else {
          if (pos.x > 0.3) return deltaY < 0 ? "R'" : 'R';
          if (pos.x < -0.3) return deltaY > 0 ? "L'" : 'L';
          return deltaY > 0 ? 'D' : "D'";
        }
    }

    return null;
  }

  public handleResize(): void {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);

    // Camera animation
    if (this.isCameraMoving) {
      const elapsed = performance.now() - this.cameraAnimStart;
      const progress = Math.min(1.0, elapsed / this.cameraAnimDuration);
      const ease = this.easeInOutCubic(progress);

      this.camera.position.lerpVectors(this.cameraStartPos, this.cameraEndPos, ease);
      this.camera.lookAt(0, 0, 0);

      if (progress >= 1.0) {
        this.isCameraMoving = false;
        this.controls.update();
      }
    } else {
      this.controls.update();
    }

    // Tutor arrow & highlight box breathing pulse
    if (this.tutorGroup.children.length > 0) {
      const time = performance.now() * 0.0035;
      const pulse = Math.sin(time);
      const scale = 1.0 + pulse * 0.02;
      this.tutorGroup.scale.set(scale, scale, scale);

      // Pulse emissive glow of arrows
      this.tutorGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = 1.2 + pulse * 0.35;
          }
        }
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy(): void {
    this.cancelAnimations();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
