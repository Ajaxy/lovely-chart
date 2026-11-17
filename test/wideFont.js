/**
 * Builds a TrueType font whose digits are boxes 1.5em wide, about three times the digits of a system font, for the
 * checks of what a web font that loads after the chart changes. Every other character falls back to the next font.
 */

export const WIDE_FONT_FAMILY = 'LovelyWide';

const UNITS_PER_EM = 1000;
const ASCENT = 800;
const DESCENT = 200;
const NOTDEF_ADVANCE = 500;
const DIGIT_ADVANCE = 1500;
// The box a digit draws, inside its advance
const BOX = { left: 100, bottom: 0, right: 1400, top: 700 };
const FIRST_DIGIT = 0x30;
const LAST_DIGIT = 0x39;
const DIGIT_GLYPH = 1;
const GLYPH_COUNT = 2;
const VERSION_1 = 0x00010000;
const POST_VERSION_3 = 0x00030000;
const HEAD_MAGIC = 0x5F0F3CF5;
const CHECKSUM_MAGIC = 0xB1B0AFBA;
const FONT_HEADER_SIZE = 12;
const TABLE_RECORD_SIZE = 16;
const NAME_HEADER_SIZE = 6;
const NAME_RECORD_SIZE = 12;
const WINDOWS_PLATFORM = 3;
const UNICODE_BMP_ENCODING = 1;
const ENGLISH_US = 0x0409;
const NAMES = [
  [1, WIDE_FONT_FAMILY], [2, 'Regular'], [3, WIDE_FONT_FAMILY], [4, WIDE_FONT_FAMILY], [6, WIDE_FONT_FAMILY],
];

export function buildWideFont() {
  const glyf = buildGlyf();

  return assembleFont({
    'OS/2': buildOs2(),
    cmap: buildCmap(),
    glyf,
    head: buildHead(),
    hhea: buildHhea(),
    // Advance and left side bearing of `.notdef`, then of the digit
    hmtx: Buffer.concat([u16(NOTDEF_ADVANCE), i16(0), u16(DIGIT_ADVANCE), i16(BOX.left)]),
    // Short offsets, in halves: `.notdef` is empty and the digit's box follows
    loca: u16(0, 0, glyf.length / 2),
    // Version, glyphs, points, contours, then no composites, two zones and no instructions
    maxp: Buffer.concat([u32(VERSION_1), u16(GLYPH_COUNT, 4, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)]),
    name: buildName(),
    // Version, italic angle, underline position and thickness, then proportional digits and no memory hints
    post: Buffer.concat([u32(POST_VERSION_3, 0), i16(-100, 50), u32(0, 0, 0, 0, 0)]),
  });
}

function buildOs2() {
  return Buffer.concat([
    // Version 4, average advance, regular weight, normal width, installable
    u16(4), i16(DIGIT_ADVANCE), u16(400, 5, 0),
    // Subscript and superscript sizes and offsets, strikeout size and position
    i16(650, 600, 0, 75, 650, 600, 0, 350, 50, 300),
    // Family class, PANOSE, the Basic Latin range and the vendor
    i16(0), Buffer.alloc(10), u32(1, 0, 0, 0), Buffer.from('NONE'),
    // Regular selection, then the first and the last character
    u16(0x40, FIRST_DIGIT, LAST_DIGIT),
    // Typographic and Windows ascent, descent and gap
    i16(ASCENT, -DESCENT, 0), u16(ASCENT, DESCENT),
    // The Latin 1 code page
    u32(1, 0),
    // x-height, cap height, default and break characters, context
    i16(500, BOX.top), u16(0, 0x20, 1),
  ]);
}

// One segment maps every digit to the box through the glyph ID array, and the closing one maps 0xFFFF to `.notdef`
function buildCmap() {
  const digitCount = LAST_DIGIT - FIRST_DIGIT + 1;
  const segmentCount = 2;
  const subtable = Buffer.concat([
    // Format 4, its length, any language, the doubled segment count and the binary search fields of two segments
    u16(4, 16 + segmentCount * 8 + digitCount * 2, 0, segmentCount * 2, 4, 1, 0),
    // End codes, padding and start codes
    u16(LAST_DIGIT, 0xFFFF), u16(0), u16(FIRST_DIGIT, 0xFFFF),
    // Deltas, and the range offset from the digits' entry to the glyph ID array that follows the offsets
    i16(0, 1), u16(segmentCount * 2, 0),
    u16(...Array(digitCount).fill(DIGIT_GLYPH)),
  ]);

  return Buffer.concat([u16(0, 1, WINDOWS_PLATFORM, UNICODE_BMP_ENCODING), u32(12), subtable]);
}

// One contour of four points on the curve, each coordinate a 16-bit step from the one before
function buildGlyf() {
  const width = BOX.right - BOX.left;
  const height = BOX.top - BOX.bottom;

  return Buffer.concat([
    i16(1, BOX.left, BOX.bottom, BOX.right, BOX.top),
    // The last point of the contour, and no instructions
    u16(3, 0),
    Buffer.from([1, 1, 1, 1]),
    i16(BOX.left, width, 0, -width),
    i16(BOX.bottom, 0, height, 0),
  ]);
}

function buildHead() {
  return Buffer.concat([
    // Version, revision, the checksum adjustment `assembleFont` fills and the magic number
    u32(VERSION_1, VERSION_1, 0, HEAD_MAGIC),
    // Baseline and left side bearing at 0, integer scaling
    u16(0x000B, UNITS_PER_EM),
    // Creation and modification dates
    Buffer.alloc(16),
    i16(BOX.left, BOX.bottom, BOX.right, BOX.top),
    // Style, smallest readable size, direction hint, short offsets and the glyph format
    u16(0, 8), i16(2, 0, 0),
  ]);
}

function buildHhea() {
  return Buffer.concat([
    u32(VERSION_1),
    i16(ASCENT, -DESCENT, 0),
    u16(DIGIT_ADVANCE),
    // Side bearings, extent, an upright caret, reserved fields and the metric format
    i16(BOX.left, DIGIT_ADVANCE - BOX.right, BOX.right, 1, 0, 0, 0, 0, 0, 0, 0),
    u16(GLYPH_COUNT),
  ]);
}

function buildName() {
  const strings = NAMES.map(([, text]) => Buffer.from(text, 'utf16le').swap16());
  let offset = 0;
  const records = NAMES.map(([nameId], i) => {
    const record = u16(WINDOWS_PLATFORM, UNICODE_BMP_ENCODING, ENGLISH_US, nameId, strings[i].length, offset);
    offset += strings[i].length;
    return record;
  });

  return Buffer.concat([
    u16(0, NAMES.length, NAME_HEADER_SIZE + NAME_RECORD_SIZE * NAMES.length), ...records, ...strings,
  ]);
}

// The table directory, sorted by tag, then each table padded to 4 bytes, and the checksum the head table carries
function assembleFont(tables) {
  const tags = Object.keys(tables).sort();
  const searchCount = 2 ** Math.floor(Math.log2(tags.length));
  let offset = FONT_HEADER_SIZE + TABLE_RECORD_SIZE * tags.length;
  const records = [];
  const bodies = [];
  tags.forEach((tag) => {
    const table = tables[tag];
    const padded = Buffer.concat([table, Buffer.alloc((4 - (table.length % 4)) % 4)]);
    records.push(Buffer.concat([Buffer.from(tag), u32(sumWords(padded), offset, table.length)]));
    bodies.push(padded);
    offset += padded.length;
  });

  const font = Buffer.concat([
    u32(VERSION_1),
    u16(
      tags.length,
      searchCount * TABLE_RECORD_SIZE,
      Math.log2(searchCount),
      (tags.length - searchCount) * TABLE_RECORD_SIZE,
    ),
    ...records,
    ...bodies,
  ]);
  const headOffset = records[tags.indexOf('head')].readUInt32BE(8);
  font.writeUInt32BE((CHECKSUM_MAGIC - sumWords(font)) >>> 0, headOffset + 8);

  return font;
}

function sumWords(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 4) {
    sum = (sum + buffer.readUInt32BE(i)) >>> 0;
  }
  return sum;
}

function u16(...values) {
  return writeValues(values, 2, (buffer, value, offset) => buffer.writeUInt16BE(value, offset));
}

function i16(...values) {
  return writeValues(values, 2, (buffer, value, offset) => buffer.writeInt16BE(value, offset));
}

function u32(...values) {
  return writeValues(values, 4, (buffer, value, offset) => buffer.writeUInt32BE(value, offset));
}

function writeValues(values, size, write) {
  const buffer = Buffer.alloc(values.length * size);
  values.forEach((value, i) => write(buffer, value, i * size));
  return buffer;
}
