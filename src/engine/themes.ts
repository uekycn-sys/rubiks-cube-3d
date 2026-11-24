/**
 * Theme & Color Definitions for 3D Rubik's Cube Engine
 */

import { ColorTheme, Face } from '../core/types';

export interface CubePalette {
  name: string;
  U: number; // Top (White)
  R: number; // Right (Red)
  F: number; // Front (Green)
  D: number; // Down (Yellow)
  L: number; // Left (Orange)
  B: number; // Back (Blue)
  body: number;
  unpainted: number;
  unpaintedBorder: number;
}

export const THEME_PALETTES: Record<ColorTheme, CubePalette> = {
  classic: {
    name: 'WCA 竞速经典',
    U: 0xFFFFFF, // Pure White
    R: 0xDC2626, // Vivid Red
    F: 0x16A34A, // Vivid Green
    D: 0xFACC15, // Golden Yellow
    L: 0xEA580C, // Bright Orange
    B: 0x2563EB, // Royal Blue
    body: 0x111317,
    unpainted: 0x222A3F,
    unpaintedBorder: 0x38BDF8,
  },
  cyberpunk: {
    name: '赛博霓虹',
    U: 0xF5F3FF, // Neon Ice
    R: 0xFF007F, // Neon Magenta
    F: 0x00FF88, // Electric Lime
    D: 0xFFE600, // Cyber Yellow
    L: 0xFF6600, // Radiant Orange
    B: 0x00E5FF, // Electric Cyan
    body: 0x0A0D18,
    unpainted: 0x1A2238,
    unpaintedBorder: 0x00E5FF,
  },
  morandi: {
    name: '莫兰迪柔光',
    U: 0xF1F1F1, // Soft White
    R: 0xC46262, // Muted Red
    F: 0x6E9A75, // Sage Green
    D: 0xD8B868, // Muted Sand
    L: 0xC5774E, // Terracotta
    B: 0x5C7D99, // Dusty Slate Blue
    body: 0x242526,
    unpainted: 0x363A42,
    unpaintedBorder: 0x94A3B8,
  },
  aurora: {
    name: '极光磨砂',
    U: 0xF8FAFC, // Frost White
    R: 0xF43F5E, // Rose Aurora
    F: 0x10B981, // Emerald Aurora
    D: 0xFBBF24, // Polar Sun
    L: 0xFB923C, // Solar Flare
    B: 0x38BDF8, // Arctic Sky
    body: 0x0F172A,
    unpainted: 0x1E293B,
    unpaintedBorder: 0x38BDF8,
  },
};

export const FACE_TO_COLOR_NAME: Record<Face, string> = {
  U: '白色',
  R: '红色',
  F: '绿色',
  D: '黄色',
  L: '橙色',
  B: '蓝色',
};

export const COLOR_TO_HEX_STRING: Record<Face, string> = {
  U: '#FFFFFF',
  R: '#DC2626',
  F: '#16A34A',
  D: '#FACC15',
  L: '#EA580C',
  B: '#2563EB',
};
