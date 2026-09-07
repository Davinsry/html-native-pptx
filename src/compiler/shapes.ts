import type { IRNode } from '../types/ir.js';
import { inchesToEmu, borderRadiusToGuide } from '../normalizer/units.js';
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

  // Geometry: check explicit geometry or border-radius
  let geometry = shapeStyle.geometry || 'rect';
  let avLst = '<a:avLst/>';

  if (!shapeStyle.geometry && shapeStyle.radius && shapeStyle.radius > 0) {
    const wPx = node.box.w * UNITS.DPI;
    const hPx = node.box.h * UNITS.DPI;
    const minDimensionPx = Math.min(wPx, hPx);

    // Pakai ellipse HANYA jika bentuknya bujur sangkar / lingkaran penuh (w == h).
    // Untuk tombol/badge kapsul (pill shape), gunakan roundRect dengan adj guide penuh.
    const isSquare = Math.abs(wPx - hPx) <= 2;
    if (isSquare && minDimensionPx > 0 && shapeStyle.radius >= (minDimensionPx / 2) - 0.5) {
      geometry = 'ellipse';
      avLst = '<a:avLst/>';
    } else {
      geometry = 'roundRect';
      const adj = borderRadiusToGuide(shapeStyle.radius, wPx, hPx);
      avLst = `<a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst>`;
    }
  }

  // Fill
  let fillXml = '<a:noFill/>';
  if (geometry !== 'line' && shapeStyle.fillColor) {
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
    const capAttr = geometry === 'line' ? ' cap="rnd"' : '';
    borderXml = `<a:ln w="${borderEmu}"${capAttr}><a:solidFill><a:srgbClr val="${shapeStyle.borderColor}"/></a:solidFill></a:ln>`;
  }

  // Shadow (Effect)
  let effectXml = '';
  if (shapeStyle.shadow) {
    const blurRad = Math.round((shapeStyle.shadow.blur || 0) * 12700);
    const offX = shapeStyle.shadow.offsetX || 0;
    const offY = shapeStyle.shadow.offsetY || 0;
    const dist = Math.round(Math.hypot(offX, offY) * 12700);
    const angleDeg = (Math.atan2(offY, offX) * 180) / Math.PI;
    const dir = Math.round((((angleDeg % 360) + 360) % 360) * 60000);
    const opacityVal =
      shapeStyle.shadow.opacity !== undefined && shapeStyle.shadow.opacity < 1
        ? `<a:alpha val="${Math.round(shapeStyle.shadow.opacity * 100000)}"/>`
        : '';
    effectXml = `<a:effectLst><a:outerShdw blurRad="${blurRad}" dist="${dist}" dir="${dir}"><a:srgbClr val="${shapeStyle.shadow.color}">${opacityVal}</a:srgbClr></a:outerShdw></a:effectLst>`;
  }

  const flips = [
    shapeStyle.flipH ? 'flipH="1"' : '',
    shapeStyle.flipV ? 'flipV="1"' : '',
  ].filter(Boolean).join(' ');
  const xfrmFlips = flips ? ` ${flips}` : '';

  return `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="${name}"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm${xfrmFlips}>
      <a:off x="${x}" y="${y}"/>
      <a:ext cx="${cx}" cy="${cy}"/>
    </a:xfrm>
    <a:prstGeom prst="${geometry}">
      ${avLst}
    </a:prstGeom>
    ${fillXml}
    ${borderXml}
    ${effectXml}
  </p:spPr>
</p:sp>`.trim();
}
