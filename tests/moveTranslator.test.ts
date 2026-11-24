import { describe, it, expect } from 'vitest';
import { translateMove, translateSolution } from '../src/core/moveTranslator';
import { ALL_MOVES, Move } from '../src/core/types';

describe('MoveTranslator Guides', () => {
  it('should translate all 18 moves into plain-Chinese instructions', () => {
    for (const move of ALL_MOVES) {
      const instruction = translateMove(move, 0, 1);
      expect(instruction.title).toContain(move);
      expect(instruction.gesture).toBeTruthy();
      expect(instruction.explanation).toBeTruthy();
      expect(instruction.targetLayer).toBe(move[0]);
    }
  });

  it('should translate key user gesture specs strictly as required', () => {
    expect(translateMove('R').title).toContain('右侧面 · 向上推 90°');
    expect(translateMove("R'").title).toContain('右侧面 · 向下拉 90°');
    expect(translateMove('L').title).toContain('左侧面 · 向下拉 90°');
    expect(translateMove("L'").title).toContain('左侧面 · 向上推 90°');
    expect(translateMove('U').title).toContain('顶层 · 向左拧 90°');
    expect(translateMove("U'").title).toContain('顶层 · 向右拧 90°');
    expect(translateMove('D').title).toContain('底层 · 向右拧 90°');
    expect(translateMove("D'").title).toContain('底层 · 向左拧 90°');
    expect(translateMove('F').title).toContain('正面 · 顺时针拧 90°');
    expect(translateMove("F'").title).toContain('正面 · 逆时针拧 90°');
    expect(translateMove('B').title).toContain('背面 · 顶部向左拧 90°');
    expect(translateMove("B'").title).toContain('背面 · 顶部向右拧 90°');
    expect(translateMove('R2').title).toContain('180°');
  });

  it('should translate entire solution with progressive step numbers', () => {
    const solution: Move[] = ['R', 'U', "R'", "U'"];
    const steps = translateSolution(solution);
    expect(steps.length).toBe(4);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].totalSteps).toBe(4);
    expect(steps[3].stepNumber).toBe(4);
  });
});
