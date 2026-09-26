/**
 * Core text search and replacement utilities for Google Docs style Find & Replace
 */

export interface FindMatch {
  from: number;
  to: number;
  text: string;
}

export interface FindOptions {
  caseSensitive: boolean;
  useRegex: boolean;
  ignoreDiacritics: boolean;
}

/**
 * 1-to-1 character normalization that removes diacritics / accents while preserving
 * exact string length and character index mapping.
 * Handles Vietnamese vowels, đ/Đ, and international accented characters (ā, É, etc.)
 */
export function stripDiacritics1to1(str: string): string {
  if (!str) return '';
  return str.split('').map(ch => {
    if (ch === 'đ') return 'd';
    if (ch === 'Đ') return 'D';
    // NFD decomposes base char + combining marks.
    // Index 0 is always the base character!
    const nfd = ch.normalize('NFD');
    return nfd[0];
  }).join('');
}

/**
 * Safely prepares a RegExp object based on options.
 * Returns null if regex syntax is invalid.
 */
export function buildSearchRegex(searchTerm: string, options: FindOptions): RegExp | null {
  if (!searchTerm) return null;

  let searchStr = searchTerm;
  if (options.ignoreDiacritics) {
    searchStr = stripDiacritics1to1(searchStr);
  }

  const flags = options.caseSensitive ? 'g' : 'gi';

  try {
    if (options.useRegex) {
      return new RegExp(searchStr, flags);
    } else {
      const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, flags);
    }
  } catch {
    return null;
  }
}

/**
 * Unescapes special sequences like \n and \t in replacement text when regex mode is enabled.
 */
export function processReplacementText(replacement: string, useRegex: boolean): string {
  if (!useRegex) return replacement;
  return replacement
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');
}

/**
 * Finds all matches within a plain text string with 1-to-1 index accuracy.
 */
export function findMatchesInString(
  text: string,
  searchTerm: string,
  options: FindOptions
): { start: number; end: number; text: string }[] {
  if (!text || !searchTerm) return [];

  const targetText = options.ignoreDiacritics ? stripDiacritics1to1(text) : text;
  const regex = buildSearchRegex(searchTerm, options);
  if (!regex) return [];

  const results: { start: number; end: number; text: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(targetText)) !== null) {
    const matchLength = match[0].length;
    if (matchLength === 0) {
      regex.lastIndex++;
      continue;
    }
    const start = match.index;
    const end = start + matchLength;
    results.push({
      start,
      end,
      text: text.slice(start, end)
    });
  }

  return results;
}

/**
 * Scans a TipTap / ProseMirror document and maps every match to exact document positions (`from`, `to`).
 * Traverses all textblocks and maintains absolute positions across all marks and text nodes.
 */
export function findMatchesInDoc(doc: any, searchTerm: string, options: FindOptions): FindMatch[] {
  if (!doc || !searchTerm) return [];

  const matches: FindMatch[] = [];

  try {
    doc.descendants((node: any, pos: number) => {
      if (node.isTextblock) {
        let blockText = '';
        const positions: number[] = [];

        node.forEach((child: any, childOffset: number) => {
          if (child.isText && child.text) {
            const startPos = pos + 1 + childOffset;
            for (let i = 0; i < child.text.length; i++) {
              blockText += child.text[i];
              positions.push(startPos + i);
            }
          }
        });

        if (!blockText || positions.length === 0) return;

        const blockMatches = findMatchesInString(blockText, searchTerm, options);
        for (const bm of blockMatches) {
          if (bm.start < positions.length && bm.end <= positions.length) {
            const from = positions[bm.start];
            const to = positions[bm.end - 1] + 1;
            matches.push({
              from,
              to,
              text: blockText.slice(bm.start, bm.end)
            });
          }
        }
      }
    });
  } catch (err) {
    console.error('Error finding matches in doc:', err);
  }

  return matches;
}
