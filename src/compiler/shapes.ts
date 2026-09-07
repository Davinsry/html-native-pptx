import type { IRNode, GradientStop, GradientFill } from '../types/ir.js';
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
 * Parses an SVG path data string (M... L... C... Q... Z) into OpenXML DrawingML <a:custGeom>.
 */
export function parseSvgPathToDrawingMl(
  d: string,
  vbW = 100,
  vbH = 100,
  originX = 0,
  originY = 0
): string {
  const commandRegex = /([a-df-z])|([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)/gi;
  let match: RegExpExecArray | null;
  const tokens: string[] = [];
  while ((match = commandRegex.exec(d)) !== null) {
    tokens.push(match[0]);
  }

  let i = 0;
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let currentCommand = '';
  const pathElements: string[] = [];

  // Points arrive in the SVG's own user units; the path space declared below is
  // the element's bounding box. Shifting by that box's origin is what makes the
  // two agree -- without it every path is drawn relative to the whole canvas
  // and lands squashed into a corner of its own shape.
  const round = (n: number) => Math.round(n * 100);
  const rx = (n: number) => round(n - originX);
  const ry = (n: number) => round(n - originY);

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-df-z]$/i.test(token)) {
      currentCommand = token;
      i++;
    }

    const isRelative = currentCommand === currentCommand.toLowerCase();
    const cmd = currentCommand.toUpperCase();

    if (cmd === 'M') {
      let x = parseFloat(tokens[i++]);
      let y = parseFloat(tokens[i++]);
      if (isRelative) {
        x += currentX;
        y += currentY;
      }
      currentX = x;
      currentY = y;
      startX = x;
      startY = y;
      pathElements.push(`<a:moveTo><a:pt x="${rx(x)}" y="${ry(y)}"/></a:moveTo>`);
      currentCommand = isRelative ? 'l' : 'L';
    } else if (cmd === 'L') {
      let x = parseFloat(tokens[i++]);
      let y = parseFloat(tokens[i++]);
      if (isRelative) {
        x += currentX;
        y += currentY;
      }
      currentX = x;
      currentY = y;
      pathElements.push(`<a:lnTo><a:pt x="${rx(x)}" y="${ry(y)}"/></a:lnTo>`);
    } else if (cmd === 'H') {
      let x = parseFloat(tokens[i++]);
      if (isRelative) x += currentX;
      currentX = x;
      pathElements.push(`<a:lnTo><a:pt x="${rx(currentX)}" y="${ry(currentY)}"/></a:lnTo>`);
    } else if (cmd === 'V') {
      let y = parseFloat(tokens[i++]);
      if (isRelative) y += currentY;
      currentY = y;
      pathElements.push(`<a:lnTo><a:pt x="${rx(currentX)}" y="${ry(currentY)}"/></a:lnTo>`);
    } else if (cmd === 'C') {
      let x1 = parseFloat(tokens[i++]);
      let y1 = parseFloat(tokens[i++]);
      let x2 = parseFloat(tokens[i++]);
      let y2 = parseFloat(tokens[i++]);
      let x = parseFloat(tokens[i++]);
      let y = parseFloat(tokens[i++]);
      if (isRelative) {
        x1 += currentX; y1 += currentY;
        x2 += currentX; y2 += currentY;
        x += currentX; y += currentY;
      }
      currentX = x;
      currentY = y;
      pathElements.push(`<a:cubicBezTo><a:pt x="${rx(x1)}" y="${ry(y1)}"/><a:pt x="${rx(x2)}" y="${ry(y2)}"/><a:pt x="${rx(x)}" y="${ry(y)}"/></a:cubicBezTo>`);
    } else if (cmd === 'S') {
      let x2 = parseFloat(tokens[i++]);
      let y2 = parseFloat(tokens[i++]);
      let x = parseFloat(tokens[i++]);
      let y = parseFloat(tokens[i++]);
      if (isRelative) {
        x2 += currentX; y2 += currentY;
        x += currentX; y += currentY;
      }
      const x1 = currentX;
      const y1 = currentY;
      currentX = x;
      currentY = y;
      pathElements.push(`<a:cubicBezTo><a:pt x="${rx(x1)}" y="${ry(y1)}"/><a:pt x="${rx(x2)}" y="${ry(y2)}"/><a:pt x="${rx(x)}" y="${ry(y)}"/></a:cubicBezTo>`);
    } else if (cmd === 'Q') {
      let x1 = parseFloat(tokens[i++]);
      let y1 = parseFloat(tokens[i++]);
      let x = parseFloat(tokens[i++]);
      let y = parseFloat(tokens[i++]);
      if (isRelative) {
        x1 += currentX; y1 += currentY;
        x += currentX; y += currentY;
      }
      currentX = x;
      currentY = y;
      pathElements.push(`<a:quadBezTo><a:pt x="${rx(x1)}" y="${ry(y1)}"/><a:pt x="${rx(x)}" y="${ry(y)}"/></a:quadBezTo>`);
    } else if (cmd === 'Z') {
      currentX = startX;
      currentY = startY;
      pathElements.push('<a:close/>');
      if (i < tokens.length && /^[z]$/i.test(tokens[i])) i++;
    } else {
      i++;
    }
  }

  const w = round(vbW || 100);
  const h = round(vbH || 100);

  return `
<a:custGeom>
  <a:avLst/>
  <a:gdLst/>
  <a:ahLst/>
  <a:cxnLst/>
  <a:rect l="0" t="0" r="r" b="b"/>
  <a:pathLst>
    <a:path w="${w}" h="${h}">
      ${pathElements.join('\n      ')}
    </a:path>
  </a:pathLst>
</a:custGeom>`.trim();
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

  // Geometry: check customPath, explicit geometry, or border-radius
  let geometryXml = '';
  if (shapeStyle.customPath) {
    const vbW = shapeStyle.pathViewBox?.w || 100;
    const vbH = shapeStyle.pathViewBox?.h || 100;
    geometryXml = parseSvgPathToDrawingMl(
      shapeStyle.customPath,
      vbW,
      vbH,
      shapeStyle.pathOrigin?.x || 0,
      shapeStyle.pathOrigin?.y || 0
    );
  } else {
    let geometry = shapeStyle.geometry || 'rect';
    let avLst = '<a:avLst/>';

    if (!shapeStyle.geometry && shapeStyle.radius && shapeStyle.radius > 0) {
      const wPx = node.box.w * UNITS.DPI;
      const hPx = node.box.h * UNITS.DPI;
      const minDimensionPx = Math.min(wPx, hPx);

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

    geometryXml = `<a:prstGeom prst="${geometry}">
      ${avLst}
    </a:prstGeom>`;
  }

  // Fill: check gradient or solid
  let fillXml = '<a:noFill/>';
  if (shapeStyle.geometry !== 'line') {
    if (shapeStyle.gradient && shapeStyle.gradient.stops.length > 0) {
      const stopsXml = shapeStyle.gradient.stops
        .map((s) => {
          const posVal = Math.round(Math.min(1, Math.max(0, s.position)) * 100000);
          const alphaVal =
            s.opacity !== undefined && s.opacity < 1
              ? `<a:alpha val="${Math.round(s.opacity * 100000)}"/>`
              : '';
          return `<a:gs pos="${posVal}"><a:srgbClr val="${s.color}">${alphaVal}</a:srgbClr></a:gs>`;
        })
        .join('');

      if (shapeStyle.gradient.type === 'radial') {
        fillXml = `<a:gradFill flip="none" rotWithShape="1"><a:gsLst>${stopsXml}</a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>`;
      } else {
        const cssAngle = shapeStyle.gradient.angle !== undefined ? shapeStyle.gradient.angle : 180;
        const dmlDeg = ((cssAngle - 90) % 360 + 360) % 360;
        const angVal = Math.round(dmlDeg * 60000);
        fillXml = `<a:gradFill flip="none" rotWithShape="1"><a:gsLst>${stopsXml}</a:gsLst><a:lin ang="${angVal}" scaled="1"/></a:gradFill>`;
      }
    } else if (shapeStyle.fillColor) {
      const opacityVal =
        shapeStyle.fillOpacity !== undefined && shapeStyle.fillOpacity < 1
          ? `<a:alpha val="${Math.round(shapeStyle.fillOpacity * 100000)}"/>`
          : '';
      fillXml = `<a:solidFill><a:srgbClr val="${shapeStyle.fillColor}">${opacityVal}</a:srgbClr></a:solidFill>`;
    }
  }

  // Border (Line)
  let borderXml = '';
  if (shapeStyle.borderColor && shapeStyle.borderWidth && shapeStyle.borderWidth > 0) {
    const borderEmu = Math.round(shapeStyle.borderWidth * 12700); // 1 pt = 12,700 EMU
    const capAttr = shapeStyle.geometry === 'line' ? ' cap="rnd"' : '';
    // A connector without its arrowhead reads as a plain rule, and a rejection
    // loop without its dashes reads as the happy path -- in a flowchart both
    // change the meaning of the diagram, not just its looks. DrawingML carries
    // them as line properties, so they survive as editable shape attributes.
    const dashXml = shapeStyle.dashed ? '<a:prstDash val="dash"/>' : '';
    const headXml = shapeStyle.startArrow
      ? '<a:headEnd type="triangle" w="med" len="med"/>'
      : '';
    const tailXml = shapeStyle.endArrow
      ? '<a:tailEnd type="triangle" w="med" len="med"/>'
      : '';
    borderXml =
      `<a:ln w="${borderEmu}"${capAttr}>` +
      `<a:solidFill><a:srgbClr val="${shapeStyle.borderColor}"/></a:solidFill>` +
      `${dashXml}${headXml}${tailXml}</a:ln>`;
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
    ${geometryXml}
    ${fillXml}
    ${borderXml}
    ${effectXml}
  </p:spPr>
</p:sp>`.trim();
}
