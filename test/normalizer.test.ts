import { describe, it, expect } from 'vitest';
import {
  pxToInches,
  inchesToEmu,
  pxToEmu,
  pxToPt,
  ptToHundredthPt,
  borderRadiusToGuide,
  normalizeHexColor,
  normalizeFontWeight,
  normalizeFontStyle,
  normalizeFontFamily,
  normalizeTextAlign,
} from '../src/index.js';

describe('Normalizer Modules', () => {
  describe('Units Conversion', () => {
    it('should convert pixels to inches correctly', () => {
      expect(pxToInches(96)).toBe(1);
      expect(pxToInches(192)).toBe(2);
    });

    it('should convert inches to EMU correctly', () => {
      expect(inchesToEmu(1)).toBe(914400);
      expect(inchesToEmu(2)).toBe(1828800);
    });

    it('should convert px directly to EMU', () => {
      expect(pxToEmu(96)).toBe(914400);
    });

    it('should convert px font size to pt', () => {
      // 16px * 72 / 96 = 12pt
      expect(pxToPt(16)).toBe(12);
      expect(pxToPt(24)).toBe(18);
    });

    it('should convert points to hundredths of points', () => {
      expect(ptToHundredthPt(16)).toBe(1600);
      expect(ptToHundredthPt(18.5)).toBe(1850);
    });

    it('should convert border radius to OpenXML guide value (0-50000)', () => {
      // Full circle on a 100x100 box with 50px radius -> 50000
      expect(borderRadiusToGuide(50, 100, 100)).toBe(50000);
      // Half radius (25px on 100x100) -> 25000
      expect(borderRadiusToGuide(25, 100, 100)).toBe(25000);
      // 0 radius -> 0
      expect(borderRadiusToGuide(0, 100, 100)).toBe(0);
    });
  });

  describe('Styles Normalization', () => {
    it('should parse RGB and RGBA colors', () => {
      expect(normalizeHexColor('rgb(255, 0, 0)')).toEqual({ hex: 'FF0000', opacity: 1 });
      expect(normalizeHexColor('rgba(30, 41, 59, 0.8)')).toEqual({ hex: '1E293B', opacity: 0.8 });
      expect(normalizeHexColor('rgba(0, 0, 0, 0)')).toBeUndefined();
      expect(normalizeHexColor('transparent')).toBeUndefined();
    });

    it('should parse Hex color variations', () => {
      expect(normalizeHexColor('#fff')).toEqual({ hex: 'FFFFFF', opacity: 1 });
      expect(normalizeHexColor('#1E293B')).toEqual({ hex: '1E293B', opacity: 1 });
      expect(normalizeHexColor('#1E293BFF')).toEqual({ hex: '1E293B', opacity: 1 });
    });

    it('should parse named colors', () => {
      expect(normalizeHexColor('white')).toEqual({ hex: 'FFFFFF', opacity: 1 });
      expect(normalizeHexColor('black')).toEqual({ hex: '000000', opacity: 1 });
      expect(normalizeHexColor('navy')).toEqual({ hex: '000080', opacity: 1 });
    });

    it('should normalize font weights', () => {
      expect(normalizeFontWeight('bold')).toBe(true);
      expect(normalizeFontWeight('700')).toBe(true);
      expect(normalizeFontWeight(600)).toBe(true);
      expect(normalizeFontWeight('normal')).toBe(false);
      expect(normalizeFontWeight('400')).toBe(false);
    });

    it('should normalize font styles', () => {
      expect(normalizeFontStyle('italic')).toBe(true);
      expect(normalizeFontStyle('oblique')).toBe(true);
      expect(normalizeFontStyle('normal')).toBe(false);
    });

    it('should normalize font families', () => {
      expect(normalizeFontFamily('"Segoe UI", sans-serif')).toBe('Segoe UI');
      expect(normalizeFontFamily('Arial, Helvetica')).toBe('Arial');
      expect(normalizeFontFamily("'Courier New', monospace")).toBe('Courier New');
    });

    it('should normalize text alignment', () => {
      expect(normalizeTextAlign('center')).toBe('center');
      expect(normalizeTextAlign('right')).toBe('right');
      expect(normalizeTextAlign('justify')).toBe('justify');
      expect(normalizeTextAlign('start')).toBe('left');
    });
  });
});
