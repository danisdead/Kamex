'use strict';

const {
  THEME_IDS,
  THEME_LABELS,
  DEFAULT_THEME,
  STORAGE_KEY,
  resolveTheme,
} = require('../lib/theme');

describe('theme helpers', () => {
  test('THEME_IDS lists default, dracula, evangelion', () => {
    expect(THEME_IDS).toEqual(['default', 'dracula', 'evangelion']);
  });

  test('STORAGE_KEY is kamex-theme', () => {
    expect(STORAGE_KEY).toBe('kamex-theme');
  });

  test('DEFAULT_THEME is default', () => {
    expect(DEFAULT_THEME).toBe('default');
  });

  test('THEME_LABELS has Spanish-friendly display names', () => {
    expect(THEME_LABELS.default).toBe('Kamex');
    expect(THEME_LABELS.dracula).toBe('Dracula');
    expect(THEME_LABELS.evangelion).toBe('Evangelion');
  });

  test('resolveTheme accepts known ids (case-insensitive)', () => {
    expect(resolveTheme('default')).toBe('default');
    expect(resolveTheme('Dracula')).toBe('dracula');
    expect(resolveTheme(' EVANGELION ')).toBe('evangelion');
  });

  test('resolveTheme falls back for unknown / empty', () => {
    expect(resolveTheme('')).toBe('default');
    expect(resolveTheme(null)).toBe('default');
    expect(resolveTheme(undefined)).toBe('default');
    expect(resolveTheme('solarized')).toBe('default');
    expect(resolveTheme(42)).toBe('default');
  });
});
