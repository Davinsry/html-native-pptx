import { describe, it, expect } from 'vitest';
import {
  UNITS,
  createSlideIR,
  convertHtmlToPptx,
  type IRNode,
  type SlideIR,
} from '../src/index.js';

describe('html-native-pptx: Phase 1 Foundations & Types', () => {
  it('should define accurate coordinate conversion constants', () => {
    expect(UNITS.DPI).toBe(96);
    expect(UNITS.PT_PER_INCH).toBe(72);
    expect(UNITS.EMU_PER_INCH).toBe(914400);

    // 13.333333 in * 914400 EMU/in ≈ 12192000 EMU
    expect(Math.round(UNITS.SLIDE_16_9_WIDTH_INCHES * UNITS.EMU_PER_INCH)).toBe(
      UNITS.SLIDE_16_9_WIDTH_EMU
    );
    expect(Math.round(UNITS.SLIDE_16_9_HEIGHT_INCHES * UNITS.EMU_PER_INCH)).toBe(
      UNITS.SLIDE_16_9_HEIGHT_EMU
    );
  });

  it('should construct standard SlideIR instances for 16:9 and 4:3', () => {
    const slide169 = createSlideIR('16:9');
    expect(slide169.width).toBeCloseTo(13.333333, 4);
    expect(slide169.height).toBe(7.5);
    expect(slide169.elements).toEqual([]);

    const slide43 = createSlideIR('4:3');
    expect(slide43.width).toBe(10);
    expect(slide43.height).toBe(7.5);
  });

  it('should validate AST node construction for containers and text', () => {
    const containerNode: IRNode = {
      id: 1,
      name: 'Card Container',
      type: 'container',
      box: { x: 1.0, y: 1.5, w: 4.0, h: 3.0 },
      shapeStyle: {
        fillColor: '1E293B',
        borderColor: '38BDF8',
        borderWidth: 2,
        radius: 12,
      },
    };

    const textNode: IRNode = {
      id: 2,
      name: 'Heading',
      type: 'text',
      box: { x: 1.2, y: 1.7, w: 3.6, h: 0.8 },
      content: 'Hello World',
      textStyle: {
        fontFamily: 'Arial',
        fontSize: 24,
        color: 'FFFFFF',
        bold: true,
        align: 'left',
      },
      paragraphs: [
        {
          align: 'left',
          runs: [
            {
              content: 'Hello ',
              bold: true,
              fontSize: 24,
              color: 'FFFFFF',
            },
            {
              content: 'World',
              bold: true,
              italic: true,
              fontSize: 24,
              color: '38BDF8',
            },
          ],
        },
      ],
    };

    const slide: SlideIR = {
      width: UNITS.SLIDE_16_9_WIDTH_INCHES,
      height: UNITS.SLIDE_16_9_HEIGHT_INCHES,
      backgroundColor: '0F172A',
      elements: [containerNode, textNode],
    };

    expect(slide.elements).toHaveLength(2);
    expect(slide.elements[0].type).toBe('container');
    expect(slide.elements[1].paragraphs?.[0].runs).toHaveLength(2);
  });

  it('should validate inputs in convertHtmlToPptx stub', async () => {
    await expect(convertHtmlToPptx('')).rejects.toThrow(
      'Input HTML string or URL cannot be empty.'
    );
  });
});
