export const STORAGE_KEY = 'kamex-theme';

export const THEME_IDS = ['default', 'dracula', 'evangelion'];

export const THEME_LABELS = {
  default: 'Kamex',
  dracula: 'Dracula',
  evangelion: 'Evangelion',
};

export const DEFAULT_THEME = 'default';

/**
 * Resolve a stored / requested theme id to a known theme.
 * @param {unknown} id
 * @returns {string}
 */
export function resolveTheme(id) {
  if (typeof id !== 'string') return DEFAULT_THEME;
  const normalized = id.trim().toLowerCase();
  if (THEME_IDS.includes(normalized)) return normalized;
  return DEFAULT_THEME;
}

/**
 * Apply theme to documentElement and persist to localStorage.
 * @param {unknown} id
 * @returns {string}
 */
export function applyTheme(id) {
  const theme = resolveTheme(id);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch (_) {
    /* ignore */
  }
  return theme;
}

/**
 * Read persisted theme from localStorage (or default).
 * @returns {string}
 */
export function loadStoredTheme() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_THEME;
    return resolveTheme(localStorage.getItem(STORAGE_KEY));
  } catch (_) {
    return DEFAULT_THEME;
  }
}
