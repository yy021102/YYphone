// Retained only to read existing chat snapshots and exports without deleting historical data.
export interface ThoughtField { key: string; label: string; instruction: string }
export interface ThoughtPreset {
  id: string; name: string; fields: ThoughtField[]; prompt: string; html: string; css: string; height?: number;
}
export interface ThoughtSnapshot {
  version: 1; preset: ThoughtPreset; values: Record<string, string>; characterName: string; at: string;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const RESERVED = new Set(['characterName', 'time', 'fields', '__proto__', 'constructor', 'prototype']);
export function isThoughtPreset(value: unknown): value is ThoughtPreset {
  if (!record(value) || !text(value.id, 100) || !value.id || !text(value.name, 60) || !value.name.trim() ||
    !text(value.prompt, 4000) || !text(value.html, 16000) || !value.html.trim() || !text(value.css, 16000) ||
    (value.height !== undefined && (typeof value.height !== 'number' || !Number.isInteger(value.height) || value.height < 160 || value.height > 700)) ||
    !Array.isArray(value.fields) || value.fields.length < 1 || value.fields.length > 16) return false;
  const keys = new Set<string>();
  for (const field of value.fields) {
    if (!record(field) || !text(field.key, 40) || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key) ||
      RESERVED.has(field.key) || keys.has(field.key) || !text(field.label, 40) || !field.label.trim() || !text(field.instruction, 1000)) return false;
    keys.add(field.key);
  }
  return keys.has('thought');
}
export function isThoughtSnapshot(value: unknown): value is ThoughtSnapshot {
  return record(value) && value.version === 1 && isThoughtPreset(value.preset) && record(value.values) &&
    Object.keys(value.values).length === value.preset.fields.length &&
    value.preset.fields.every(field => text(value.values && Reflect.get(value.values, field.key), 4000)) &&
    typeof value.characterName === 'string' && text(value.at, 100) && Number.isFinite(Date.parse(value.at));
}
