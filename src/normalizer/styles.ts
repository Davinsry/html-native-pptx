import type { TextAlign } from '../types/ir.js';

const NAMED_COLORS: Record<string, string> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  cyan: '00FFFF',
  magenta: 'FF00FF',
  silver: 'C0C0C0',
  gray: '808080',
  grey: '808080',
  maroon: '800000',
  olive: '808000',
  purple: '800080',
  teal: '008080',
  navy: '000080',
  orange: 'FFA500',
  pink: 'FFC0CB',
};

export interface ColorResult {
  hex: string;
  opacity?: number;
}

/**
 * Normalizes any CSS color string (rgb, rgba, hex, named) into a 6-character uppercase hex string.
 * Returns undefined if transparent or invalid.
 */
export function normalizeHexColor(cssColor?: string): ColorResult | undefined {
  if (!cssColor) return undefined;
  const trimmed = cssColor.trim().toLowerCase();

  if (trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)' || trimmed === 'none') {
    return undefined;
  }

  // 1. Check named colors
  if (NAMED_COLORS[trimmed]) {
    return { hex: NAMED_COLORS[trimmed], opacity: 1 };
  }

  // 2. Parse rgba(r, g, b, a) or rgb(r, g, b)
  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;

    if (a <= 0) return undefined;

    const hex = [r, g, b]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    return { hex, opacity: a };
  }

  // 3. Parse hex (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)
  if (trimmed.startsWith('#')) {
    const raw = trimmed.slice(1);
    if (raw.length === 3) {
      // #RGB
      const hex = raw
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase();
      return { hex, opacity: 1 };
    }
    if (raw.length === 4) {
      // #RGBA
      const hex = raw
        .slice(0, 3)
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase();
      const alphaHex = raw[3] + raw[3];
      const opacity = parseInt(alphaHex, 16) / 255;
      return opacity <= 0 ? undefined : { hex, opacity };
    }
    if (raw.length === 6) {
      // #RRGGBB
      return { hex: raw.toUpperCase(), opacity: 1 };
    }
    if (raw.length === 8) {
      // #RRGGBBAA
      const hex = raw.slice(0, 6).toUpperCase();
      const opacity = parseInt(raw.slice(6, 8), 16) / 255;
      return opacity <= 0 ? undefined : { hex, opacity };
    }
  }

  return undefined;
}

/**
 * Normalizes CSS font-weight into a boolean representing bold.
 */
export function normalizeFontWeight(fontWeight?: string | number): boolean {
  if (!fontWeight) return false;
  if (typeof fontWeight === 'number') return fontWeight >= 600;
  const lower = fontWeight.trim().toLowerCase();
  if (lower === 'bold' || lower === 'bolder') return true;
  const num = parseInt(lower, 10);
  return !isNaN(num) && num >= 600;
}

/**
 * Normalizes CSS font-style into a boolean representing italic.
 */
export function normalizeFontStyle(fontStyle?: string): boolean {
  if (!fontStyle) return false;
  const lower = fontStyle.trim().toLowerCase();
  return lower === 'italic' || lower === 'oblique';
}

/**
 * Normalizes CSS font-family string by extracting the primary font family without quotes.
 */
export function normalizeFontFamily(fontFamily?: string): string {
  if (!fontFamily) return 'Arial';
  const first = fontFamily.split(',')[0].trim();
  const cleaned = first.replace(/^['"]+|['"]+$/g, '');
  return cleaned || 'Arial';
}

/**
 * Normalizes CSS text-align to IR TextAlign.
 */
export function normalizeTextAlign(textAlign?: string): TextAlign {
  if (!textAlign) return 'left';
  const lower = textAlign.trim().toLowerCase();
  if (lower === 'center') return 'center';
  if (lower === 'right') return 'right';
  if (lower === 'justify') return 'justify';
  return 'left';
}

/**
 * Normalizes CSS border-style to supported IR border types.
 */
export function normalizeBorderStyle(
  borderStyle?: string
): 'solid' | 'dashed' | 'dotted' {
  if (!borderStyle) return 'solid';
  const lower = borderStyle.trim().toLowerCase();
  if (lower === 'dashed') return 'dashed';
  if (lower === 'dotted') return 'dotted';
  return 'solid';
}
