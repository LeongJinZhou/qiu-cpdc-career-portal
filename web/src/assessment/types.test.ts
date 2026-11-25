import { describe, expect, it } from 'vitest';
import { editorProblem, toSaveBody } from './types';

const good = {
  title: 'Fake readiness',
  description: '',
  bands: [{ min_percent: 0, label: 'Start' }, { min_percent: 70, label: 'Ready' }],
  questions: [{ id: 3, prompt: 'Ready?', options: [{ id: 9, label: 'No', points: 0 }, { label: 'Yes', points: 2 }] }],
};

describe('assessment editor rules', () => {
  it('accepts a complete assessment', () => {
    expect(editorProblem(good)).toBeNull();
  });

  it('names the first problem the server would refuse', () => {
    expect(editorProblem({ ...good, bands: [{ min_percent: 10, label: 'A' }] })).toBe('One result band must start at 0%.');
    expect(editorProblem({ ...good, bands: [{ min_percent: 0, label: 'A' }, { min_percent: 0, label: 'B' }] })).toMatch(/same score/);
    expect(editorProblem({ ...good, questions: [] })).toBe('Add at least one question.');
    expect(editorProblem({ ...good, questions: [{ prompt: 'Ready?', options: [{ label: 'Only', points: 1 }] }] })).toMatch(/two answers/);
  });

  it('sends no ids', () => {
    expect(JSON.stringify(toSaveBody(good))).not.toContain('"id"');
  });
});
