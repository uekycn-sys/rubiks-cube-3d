/**
 * Core Types for 3D Rubik's Cube Application
 * Standard Singmaster Notation & Cube Definition
 */

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export type FaceletColor = 'U' | 'R' | 'F' | 'D' | 'L' | 'B' | 'X'; // 'X' represents unpainted

export type ColorName = 'white' | 'red' | 'green' | 'yellow' | 'orange' | 'blue';

export type Move =
  | 'U' | "U'" | 'U2'
  | 'D' | "D'" | 'D2'
  | 'L' | "L'" | 'L2'
  | 'R' | "R'" | 'R2'
  | 'F' | "F'" | 'F2'
  | 'B' | "B'" | 'B2';

export const ALL_MOVES: Move[] = [
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'L', "L'", 'L2',
  'R', "R'", 'R2',
  'F', "F'", 'F2',
  'B', "B'", 'B2',
];

export const INVERSE_MOVES: Record<Move, Move> = {
  'U': "U'", "U'": 'U', 'U2': 'U2',
  'D': "D'", "D'": 'D', 'D2': 'D2',
  'L': "L'", "L'": 'L', 'L2': 'L2',
  'R': "R'", "R'": 'R', 'R2': 'R2',
  'F': "F'", "F'": 'F', 'F2': 'F2',
  'B': "B'", "B'": 'B', 'B2': 'B2',
};

// Face offset in 54-facelet representation
export const FACE_OFFSETS: Record<Face, number> = {
  U: 0,
  R: 9,
  F: 18,
  D: 27,
  L: 36,
  B: 45,
};

// Center facelet indices
export const CENTER_INDICES: Record<Face, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};

export const CENTER_INDEX_LIST = [4, 13, 22, 31, 40, 49];

export const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

export type ValidationErrorCode =
  | 'INCOMPLETE'
  | 'COLOR_COUNT'
  | 'INVALID_PIECE'
  | 'CORNER_TWIST'
  | 'EDGE_FLIP'
  | 'PARITY';

export interface ValidationResult {
  valid: boolean;
  errorCode?: ValidationErrorCode;
  message?: string;
  problemIndices?: number[];
  details?: Record<string, any>;
}

export type LblStageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SolverMethod = 'lbl' | 'kociemba';

export type LblCameraView = 'HOME' | 'ISO_FL' | 'ISO_BL' | 'ISO_BR' | 'ISO_BOTTOM';

export interface LblStageMeta {
  id: LblStageId;
  name: string;
  shortName: string;
  goal: string;
  formulaDisplay: string;
  mnemonic: string;
  tip: string;
}

export interface LblChunk {
  id: string;
  stageId: LblStageId;
  title: string;
  formulaName: string;
  formulaNotation: string;
  mnemonic: string;
  recognitionTip: string;
  moves: Move[];
  rhythms: string[];
  recommendedView: LblCameraView;
  highlightFacelets: number[];
  startMoveIndex: number;
}

export interface LblSolution {
  moves: Move[];
  chunks: LblChunk[];
  stageStartIndices: Partial<Record<LblStageId, number>>;
  initialCompletedStages: boolean[];
}

export interface LblProgressReport {
  completedStages: boolean[];
  currentStage: LblStageId | null;
  isSolved: boolean;
  completedCount: number;
  currentStageMeta: LblStageMeta | null;
}

export interface StepInstruction {
  move: Move;
  stepNumber: number;
  totalSteps: number;
  title: string;
  face: Face;
  direction: 'CW' | 'CCW' | 'DOUBLE';
  gesture: string;
  explanation: string;
  targetLayer: Face;
  stageId?: LblStageId;
  stageTitle?: string;
  formulaName?: string;
  mnemonic?: string;
  recognitionTip?: string;
  chunkIndex?: number;
  stepInChunk?: number;
  chunkLength?: number;
}

export type AppMode = 'learn' | 'free' | 'paint' | 'tutor' | 'level' | 'speedrun';

export type ColorTheme = 'classic' | 'cyberpunk' | 'morandi' | 'aurora';
