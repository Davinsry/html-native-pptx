import type { IRNode, ParagraphIR, TextRun } from '../types/ir.js';
import { inchesToEmu, ptToHundredthPt } from '../normalizer/units.js';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapAlign(align?: string): string {
  switch (align) {
    case 'center':
      return 'ctr';
    case 'right':
      return 'r';
    case 'justify':
      return 'just';
    case 'left':
    default:
      return 'l';
  }
}

function compileRun(run: TextRun, fallbackFont: string, fallbackColor: string, fallbackSize: number): string {
  const font = escapeXml(run.fontFamily || fallbackFont);
  const color = run.color || fallbackColor;
  const sz = ptToHundredthPt(run.fontSize || fallbackSize);
  const b = run.bold ? ' b="1"' : ' b="0"';
  const i = run.italic ? ' i="1"' : ' i="0"';
  const u = run.underline ? ' u="sng"' : '';
  const strike = run.strikethrough ? ' strike="sngStrike"' : '';
  const text = escapeXml(run.content);

  return `
      <a:r>
        <a:rPr${b}${i}${u}${strike} sz="${sz}">
          <a:solidFill>
            <a:srgbClr val="${color}"/>
          </a:solidFill>
          <a:latin typeface="${font}"/>
        </a:rPr>
        <a:t>${text}</a:t>
      </a:r>`.trim();
}

function compileParagraph(
  para: ParagraphIR,
  fallbackFont: string,
  fallbackColor: string,
  fallbackSize: number
): string {
  const algn = mapAlign(para.align);
  const runsXml = para.runs
    .map((run) => compileRun(run, fallbackFont, fallbackColor, fallbackSize))
    .join('\n');

  return `
    <a:p>
      <a:pPr algn="${algn}"/>
      ${runsXml}
    </a:p>`.trim();
}

/**
 * Compiles a text IRNode into an OpenXML <p:sp> textbox element with zero internal margins.
 */
export function compileTextShape(node: IRNode, id: number): string {
  const x = inchesToEmu(node.box.x);
  const y = inchesToEmu(node.box.y);
  const cx = inchesToEmu(node.box.w);
  const cy = inchesToEmu(node.box.h);
  const name = escapeXml(node.name || `Text ${id}`);

  const defaultFont = node.textStyle?.fontFamily || 'Arial';
  const defaultColor = node.textStyle?.color || '000000';
  const defaultSize = node.textStyle?.fontSize || 16;
  const defaultAlign = node.textStyle?.align || 'left';

  let paragraphsXml = '';

  if (node.paragraphs && node.paragraphs.length > 0) {
    paragraphsXml = node.paragraphs
      .map((p) => compileParagraph(p, defaultFont, defaultColor, defaultSize))
      .join('\n');
  } else {
    // Fallback if only flat content / textStyle is provided
    const singleRun: TextRun = {
      content: node.content || '',
      fontFamily: defaultFont,
      fontSize: defaultSize,
      color: defaultColor,
      bold: node.textStyle?.bold,
      italic: node.textStyle?.italic,
      underline: node.textStyle?.underline,
    };
    paragraphsXml = compileParagraph(
      { align: defaultAlign, runs: [singleRun] },
      defaultFont,
      defaultColor,
      defaultSize
    );
  }

  return `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="${name}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="${x}" y="${y}"/>
      <a:ext cx="${cx}" cy="${cy}"/>
    </a:xfrm>
    <a:prstGeom prst="rect">
      <a:avLst/>
    </a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0" lIns="0" tIns="0" rIns="0" bIns="0">
      <a:spAutoFit/>
    </a:bodyPr>
    <a:lstStyle/>
    ${paragraphsXml}
  </p:txBody>
</p:sp>`.trim();
}
