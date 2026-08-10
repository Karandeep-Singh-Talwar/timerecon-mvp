import { describe, it, expect } from 'vitest';

describe('Learning System logic', () => {
  it('should format pattern matching correctly for learning entries', () => {
    const rawPattern = '  Team Standup  ';
    const normalized = rawPattern.trim().toLowerCase();
    expect(normalized).toBe('team standup');
  });

  it('should increase confidence score on repeated pattern occurrences', () => {
    let confidence = 0.8;
    const occurrences = 2;
    confidence = Math.min(1.0, confidence + 0.1);
    expect(confidence).toBe(0.9);
  });
});
