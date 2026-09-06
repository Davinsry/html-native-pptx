import { describe, it, expect } from 'vitest';
import { compileContainerShape } from '../src/compiler/shapes.js';
import type { IRNode } from '../src/types/ir.js';

describe('Advanced Styles, Radius, Alpha, and Border Compilation', () => {
  it('should compile circular container (radius >= half shortest side) as prstGeom="ellipse"', () => {
    // 120px / 96 = 1.25 inches
    const circleNode: IRNode = {
      type: 'container',
      name: 'avatar-circle',
      box: { x: 1, y: 1, w: 1.25, h: 1.25 },
      shapeStyle: {
        fillColor: '3B82F6',
        radius: 60, // 50% of 120px
      },
    };

    const xml = compileContainerShape(circleNode, 10);
    expect(xml).toContain('prst="ellipse"');
    expect(xml).not.toContain('prst="roundRect"');
  });

  it('should compile rounded rectangle with proper adj guide for moderate radius', () => {
    const roundedNode: IRNode = {
      type: 'container',
      name: 'card',
      box: { x: 1, y: 1, w: 2, h: 1 },
      shapeStyle: {
        fillColor: 'FFFFFF',
        radius: 12,
      },
    };

    const xml = compileContainerShape(roundedNode, 11);
    expect(xml).toContain('prst="roundRect"');
    expect(xml).toContain('<a:gd name="adj"');
  });

  it('should compile semi-transparent fill using <a:alpha>', () => {
    const transparentNode: IRNode = {
      type: 'container',
      name: 'overlay',
      box: { x: 0, y: 0, w: 10, h: 5 },
      shapeStyle: {
        fillColor: '000000',
        fillOpacity: 0.35,
      },
    };

    const xml = compileContainerShape(transparentNode, 12);
    expect(xml).toContain('<a:srgbClr val="000000">');
    expect(xml).toContain('<a:alpha val="35000"/>');
  });
});
