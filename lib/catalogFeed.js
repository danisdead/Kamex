'use strict';

const DEFAULT_CATALOG_FEED_URL =
  'https://gist.githubusercontent.com/danisdead/96dd3cdc607cf3b12247e2ffbfcf0c1b/raw/catalog.json';

/** How often a running server rechecks the catalog feed. */
const CATALOG_POLL_MS = 30 * 60 * 1000;

/**
 * Items from a Mingus catalog wrapper `{ updated_at, source, count, items[] }`.
 * Missing or malformed wrappers yield an empty list (never throws).
 * @param {unknown} feed
 * @returns {Array}
 */
function extractItems(feed) {
  if (!feed || typeof feed !== 'object' || Array.isArray(feed)) return [];
  return Array.isArray(feed.items) ? feed.items : [];
}

/**
 * `updated_at` stamp from a catalog wrapper, or null when absent.
 * @param {unknown} feed
 * @returns {string|null}
 */
function feedUpdatedAt(feed) {
  if (!feed || typeof feed !== 'object' || Array.isArray(feed)) return null;
  const stamp = feed.updated_at;
  if (stamp == null) return null;
  const text = String(stamp).trim();
  return text === '' ? null : text;
}

/**
 * True only when both stamps are present and equal.
 * A missing previous or next stamp is treated as changed so the caller upserts.
 * @param {unknown} previousUpdatedAt
 * @param {unknown} nextUpdatedAt
 * @returns {boolean}
 */
function isUnchangedUpdatedAt(previousUpdatedAt, nextUpdatedAt) {
  if (previousUpdatedAt == null || nextUpdatedAt == null) return false;
  const prev = String(previousUpdatedAt).trim();
  const next = String(nextUpdatedAt).trim();
  if (!prev || !next) return false;
  return prev === next;
}

/**
 * Strip http(s) URLs so logs never echo a feed URL that might carry a token.
 * @param {unknown} text
 * @returns {string}
 */
function redactUrls(text) {
  return String(text == null ? '' : text).replace(/https?:\/\/\S+/gi, '[url]');
}

module.exports = {
  DEFAULT_CATALOG_FEED_URL,
  CATALOG_POLL_MS,
  extractItems,
  feedUpdatedAt,
  isUnchangedUpdatedAt,
  redactUrls,
};
