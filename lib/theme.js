'use strict';

const STORAGE_KEY = 'kamex-theme';

const THEME_IDS = ['default', 'dracula', 'evangelion'];

const THEME_LABELS = {
  default: 'Kamex',
  dracula: 'Dracula',
  evangelion: 'Evangelion',
};

const DEFAULT_THEME = 'default';

/**
 * Resolve a stored / requested theme id to a known theme.
 * Unknown or empty values fall back to DEFAULT_THEME.
 * @param {unknown} id
 * @returns {string}
 */
function resolveTheme(id) {
  if (typeof id !== 'string') return DEFAULT_THEME;
  const normalized = id.trim().toLowerCase();
  if (THEME_IDS.includes(normalized)) return normalized;
  return DEFAULT_THEME;
}

/**
 * Apply theme to documentElement and persist to localStorage.
 * Safe to call from browser only (guards when document/localStorage missing).
 * @param {unknown} id
 * @returns {string} resolved theme id
 */
function applyTheme(id) {
  const theme = resolveTheme(id);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch (_) {
    /* ignore quota / private mode */
  }
  return theme;
}

/**
 * Read persisted theme from localStorage (or default).
 * @returns {string}
 */
function loadStoredTheme() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_THEME;
    return resolveTheme(localStorage.getItem(STORAGE_KEY));
  } catch (_) {
    return DEFAULT_THEME;
  }
}

module.exports = {
  STORAGE_KEY,
  THEME_IDS,
  THEME_LABELS,
  DEFAULT_THEME,
  resolveTheme,
  applyTheme,
  loadStoredTheme,
};
