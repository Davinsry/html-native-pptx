import type { IRNode } from '../types/ir.js';
import { inchesToEmu } from '../normalizer/units.js';
import { UNITS } from '../types/ir.js';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Compiles a container IRNode into OpenXML <p:sp> element.
 */
export function compileContainerShape(node: IRNode, id: number): string {
  const x = inchesToEmu(node.box.x);
  const y = inchesToEmu(node.box.y);
  const cx = inchesToEmu(node.box.w);
  const cy = inchesToEmu(node.box.h);
  const name = escapeXml(node.name || `Box ${id}`);

  const shapeStyle = node.shapeStyle || {};

  // Geometry: check border-radius
  let geometry = 'rect';
  let avLst = '<a:avLst/>';

  if (shapeStyle.radius && shapeStyle.radius > 0) {
    geometry = 'roundRect';
    const minDimensionInches = Math.min(node.box.w, node.box.h);
    if (minDimensionInches > 0) {
      const radiusInches = shapeStyle.radius / UNITS.DPI;
      const maxRadiusInches = minDimensionInches / 2;
      const ratio = Math.min(1, Math.max(0, radiusInches / maxRadiusInches));
      const adj = Math.round(ratio * 50000);
      avLst = `<a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst>`;
    }
  }

  // Fill
  let fillXml = '<a:noFill/>';
  if (shapeStyle.fillColor) {
    const opacityVal =
      shapeStyle.fillOpacity !== undefined && shapeStyle.fillOpacity < 1
        ? `<a:alpha val="${Math.round(shapeStyle.fillOpacity * 100000)}"/>`
        : '';
    fillXml = `<a:solidFill><a:srgbClr val="${shapeStyle.fillColor}">${opacityVal}</a:srgbClr></a:solidFill>`;
  }

  // Border (Line)
  let borderXml = '';
  if (shapeStyle.borderColor && shapeStyle.borderWidth && shapeStyle.borderWidth > 0) {
    const borderEmu = Math.round(shapeStyle.borderWidth * 12700); // 1 pt = 12,700 EMU
    borderXml = `<a:ln w="${borderEmu}"><a:solidFill><a:srgbClr val="${shapeStyle.borderColor}"/></a:solidFill></a:ln>`;
  }

  return `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="${name}"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="${x}" y="${y}"/>
      <a:ext cx="${cx}" cy="${cy}"/>
    </a:xfrm>
    <a:prstGeom prst="${geometry}">
      ${avLst}
    </a:prstGeom>
    ${fillXml}
    ${borderXml}
  </p:spPr>
</p:sp>`.trim();
}
