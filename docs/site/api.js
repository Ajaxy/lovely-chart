// The tables of the reference: a row per option, method, CSS variable or class, each with an anchor of its own

import { stripInline } from './markdown.js';

// The first header cells of the tables whose rows are entries of the reference
const ENTRY_HEADERS = new Set(['Parameter', 'Argument', 'Method', 'Option', 'Export', 'Variable', 'Class', 'Type']);
const ENTRY_TABLE_ROW = /^\|?\s*(Parameter|Argument|Method|Option|Export|Variable|Class|Type)\s*\|/;
const NAME = /`([^`]+)`/g;

export function isEntryTable(header) {
  return ENTRY_HEADERS.has(stripInline(header[0]));
}

/**
 * The anchor of a name of the reference: `datasets[*].color` → `datasets-color`, `update(newData, options?)` →
 * `update`, `.lovely-chart--tooltip-change[data-tone]` → `lovely-chart--tooltip-change`
 */
export function getEntryAnchor(name) {
  return name
    .replace(/\(.*$/, '')
    .replace(/\[\*\]/g, '')
    .replace(/\[[^\]]*\]$/, '')
    .replace(/^\./, '')
    .replace(/\./g, '-')
    .trim();
}

/**
 * The names a cell of the first column holds, as `--background-color`, `--text-color` and the rest of one row
 */
export function readEntryNames(cell) {
  return [...cell.matchAll(NAME)].map((match) => match[1]);
}

/**
 * The entries of the reference tables in `markdown`: `{ name, anchor, aliases, type, summary }`
 */
export function readEntries(markdown) {
  const entries = [];
  let header;

  markdown.split('\n').forEach((line) => {
    if (ENTRY_TABLE_ROW.test(line)) {
      header = splitCells(line);
      return;
    }
    if (!header || !line.includes('|')) {
      header = undefined;
      return;
    }
    if (/^\s*\|?\s*:?-+/.test(line)) {
      return;
    }
    const cells = splitCells(line);
    const names = readEntryNames(cells[0]);
    if (!names.length) {
      return;
    }
    const typeIndex = header.indexOf('Type', 1);
    entries.push({
      name: names[0],
      anchor: getEntryAnchor(names[0]),
      aliases: names.slice(1).map(getEntryAnchor),
      type: typeIndex === -1 ? undefined : stripInline(cells[typeIndex] || ''),
      summary: summarize(stripInline(cells[cells.length - 1] || '')),
    });
  });

  return entries;
}

function splitCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim());
}

// The first sentence of a description
function summarize(text) {
  const sentence = text.match(/^.*?[.!?](?=\s|$)/);
  return (sentence ? sentence[0] : text).slice(0, 220);
}
