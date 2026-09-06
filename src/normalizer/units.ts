import { UNITS } from '../types/ir.js';

/**
 * Convert pixels to inches given a DPI and optional coordinate scale factor.
 */
export function pxToInches(
  px: number,
  dpi: number = UNITS.DPI,
  scale: number = 1
): number {
  return (px / dpi) * scale;
}

/**
 * Convert inches to English Metric Units (EMU).
 * 1 inch = 914,400 EMU.
 */
export function inchesToEmu(inches: number): number {
  return Math.round(inches * UNITS.EMU_PER_INCH);
}

/**
 * Direct conversion from pixels to EMU.
 */
export function pxToEmu(
  px: number,
  dpi: number = UNITS.DPI,
  scale: number = 1
): number {
  return inchesToEmu(pxToInches(px, dpi, scale));
}

/**
 * Convert pixel font size to points (pt).
 * 1 inch = 72 pt = 96 px -> 1 px = 0.75 pt.
 */
export function pxToPt(px: number, dpi: number = UNITS.DPI): number {
  return (px * UNITS.PT_PER_INCH) / dpi;
}

/**
 * Convert points to hundredths of a point (used by OpenXML sz attribute).
 * e.g., 16pt -> 1600.
 */
export function ptToHundredthPt(pt: number): number {
  return Math.round(pt * 100);
}

/**
 * Convert CSS border-radius (in pixels) to OpenXML rounded rectangle adjustment guide value (0 - 50000).
 * In OpenXML, an adj value of 50000 represents a radius equal to half the shortest dimension.
 */
export function borderRadiusToGuide(
  radiusPx: number,
  widthPx: number,
  heightPx: number
): number {
  const minSide = Math.min(widthPx, heightPx);
  if (minSide <= 0 || radiusPx <= 0) return 0;
  const maxRadius = minSide / 2;
  const ratio = Math.min(1, Math.max(0, radiusPx / maxRadius));
  return Math.round(ratio * 50000);
}
