/**
 * Global Game & Tutor State Management
 */

import {
  AppMode,
  ColorTheme,
  Face,
  Move,
  StepInstruction,
  ValidationResult,
  SOLVED_FACELETS,
} from '../core/types';
import { validateCubeState } from '../core/cubeValidator';
import { translateSolution } from '../core/moveTranslator';
import { CubeState, CENTER_FACELETS } from '../core/cubeState';

// Blank state with only the 6 standard center pieces filled and rest 'X'
export const BLANK_PAINT_FACELETS = (() => {
  const arr = new Array(54).fill('X');
  arr[4] = 'U';  // White top
  arr[13] = 'R'; // Red right
  arr[22] = 'F'; // Green front
  arr[31] = 'D'; // Yellow bottom
  arr[40] = 'L'; // Orange left
  arr[49] = 'B'; // Blue back
  return arr.join('');
})();

export interface AppState {
  // Mode & Theme
  mode: AppMode;
  theme: ColorTheme;

  // Paint Mode State
  paintFacelets: string;
  selectedPaintColor: Face | 'X';
  validationResult: ValidationResult;
  isSolving: boolean;
  solveError: string | null;

  // AI Tutor Mode State
  initialTutorFacelets: string;
  solutionMoves: Move[];
  instructions: StepInstruction[];
  currentStepIndex: number;
  historyFacelets: string[]; // 54-facelet string at each step (0 .. totalSteps)
  isAutoPlay: boolean;
  playMode: 'continuous' | 'followAlong';
  autoPlayInterval: number; // ms: 1500, 3000, 5000
  playbackSpeed: number;    // 0.5, 1.0, 2.0, 4.0
  isTutorFinished: boolean;

  // Level & Speedrun State (prepared for Phase 4)
  currentLevelIndex: number;
  unlockedLevels: number;
}

type Listener = () => void;

class StateStore {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = {
      mode: 'free',
      theme: 'classic',

      paintFacelets: BLANK_PAINT_FACELETS,
      selectedPaintColor: 'U',
      validationResult: validateCubeState(BLANK_PAINT_FACELETS),
      isSolving: false,
      solveError: null,

      initialTutorFacelets: SOLVED_FACELETS,
      solutionMoves: [],
      instructions: [],
      currentStepIndex: 0,
      historyFacelets: [SOLVED_FACELETS],
      isAutoPlay: false,
      playMode: 'continuous',
      autoPlayInterval: 1500,
      playbackSpeed: 1.0,
      isTutorFinished: false,

      currentLevelIndex: 0,
      unlockedLevels: 1,
    };
  }

  public getState(): AppState {
    return this.state;
  }

  public setState(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // Paint actions
  public setPaintFacelet(index: number, color: Face | 'X'): void {
    if (CENTER_FACELETS.includes(index)) {
      // Centers cannot be modified
      return;
    }
    const arr = this.state.paintFacelets.split('');
    arr[index] = color;
    const nextFacelets = arr.join('');
    const validation = validateCubeState(nextFacelets);

    this.setState({
      paintFacelets: nextFacelets,
      validationResult: validation,
      solveError: null,
    });
  }

  public setPaintFacelets(facelets: string): void {
    const validation = validateCubeState(facelets);
    this.setState({
      paintFacelets: facelets,
      validationResult: validation,
      solveError: null,
    });
  }

  public resetPaintToBlank(): void {
    this.setState({
      paintFacelets: BLANK_PAINT_FACELETS,
      validationResult: validateCubeState(BLANK_PAINT_FACELETS),
      solveError: null,
    });
  }

  public resetPaintToSolved(): void {
    this.setState({
      paintFacelets: SOLVED_FACELETS,
      validationResult: validateCubeState(SOLVED_FACELETS),
      solveError: null,
    });
  }

  public fillPaintWithScramble(): void {
    const scramble = CubeState.generateScramble(20);
    const cube = new CubeState();
    cube.applyMoves(scramble);
    const facelets = cube.getFacelets();
    this.setState({
      paintFacelets: facelets,
      validationResult: validateCubeState(facelets),
      solveError: null,
    });
  }

  // Setup AI Tutor
  public setupTutor(initialFacelets: string, solution: Move[]): void {
    // Generate state history for each step so stepping forward/backward is 100% deterministic
    const instructions = translateSolution(solution);
    const history: string[] = [initialFacelets];

    const sim = new CubeState(initialFacelets);
    for (const move of solution) {
      sim.applyMove(move);
      history.push(sim.getFacelets());
    }

    this.setState({
      mode: 'tutor',
      initialTutorFacelets: initialFacelets,
      solutionMoves: solution,
      instructions,
      currentStepIndex: 0,
      historyFacelets: history,
      isAutoPlay: false,
      isTutorFinished: solution.length === 0,
    });
  }
}

export const store = new StateStore();
