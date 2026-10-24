import type { SudokuDifficulty } from './sudoku';

export const SUDOKU_PROGRESS_KEY = 'yyphone:sudoku:progress';
export type SudokuCharacterMode = 'off' | 'help' | 'participate' | 'watch';
export interface SudokuProgress {
  version: 1;
  difficulty: SudokuDifficulty;
  nextDifficulty: SudokuDifficulty;
  puzzle: number[];
  solution: number[];
  grid: number[];
  gameId: string;
  selected: number;
  notes: Record<number, number[]>;
  pencil: boolean;
  mode: SudokuCharacterMode;
  characterId: string;
  speechHistory: string[];
  characterCells: number[];
  recipients: string[];
  shared: boolean;
  shareNote: string;
  hintIndex: number;
  correctMoves: number;
  seenCorrect: number[];
  nextCommentAt: number;
}

const digits = (value: unknown): value is number[] => Array.isArray(value) && value.length === 81 &&
  value.every(item => Number.isInteger(item) && item >= 0 && item <= 9);
const indexes = (value: unknown): value is number[] => Array.isArray(value) &&
  value.every(item => Number.isInteger(item) && item >= 0 && item < 81);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
export const isSudokuProgress = (value: unknown): value is SudokuProgress => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SudokuProgress>;
  if (item.version !== 1 || !['normal', 'hard'].includes(item.difficulty ?? '') ||
    !['normal', 'hard'].includes(item.nextDifficulty ?? '') ||
    !digits(item.puzzle) || !digits(item.solution) || !digits(item.grid) ||
    typeof item.gameId !== 'string' || !Number.isInteger(item.selected) || item.selected! < -1 || item.selected! > 80 ||
    !item.notes || typeof item.notes !== 'object' || Array.isArray(item.notes) ||
    !Object.values(item.notes).every(value => Array.isArray(value) && value.every(n => Number.isInteger(n) && n >= 1 && n <= 9)) ||
    typeof item.pencil !== 'boolean' || !['off', 'help', 'participate', 'watch'].includes(item.mode ?? '') ||
    typeof item.characterId !== 'string' || !strings(item.speechHistory) || !indexes(item.characterCells) ||
    !strings(item.recipients) || typeof item.shared !== 'boolean' || typeof item.shareNote !== 'string' ||
    !Number.isInteger(item.hintIndex) || item.hintIndex! < -1 || item.hintIndex! > 80 ||
    !Number.isInteger(item.correctMoves) || item.correctMoves! < 0 || !indexes(item.seenCorrect) ||
    !Number.isInteger(item.nextCommentAt) || item.nextCommentAt! < 1) return false;
  return item.puzzle.every((digit, index) => !digit || digit === item.solution![index]) &&
    item.grid.every((digit, index) => !item.puzzle![index] || digit === item.puzzle![index]);
};
