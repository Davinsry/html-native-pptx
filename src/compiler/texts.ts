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
  // `spc` dalam perseratus poin, boleh negatif untuk merapatkan huruf.
  const spc =
    run.letterSpacing !== undefined && Math.round(run.letterSpacing * 100) !== 0
      ? ` spc="${Math.round(run.letterSpacing * 100)}"`
      : '';
  const strike = run.strikethrough ? ' strike="sngStrike"' : '';
  const text = escapeXml(run.content);

  return `
      <a:r>
        <a:rPr${b}${i}${u}${strike}${spc} sz="${sz}">
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

  // Jarak baris ditulis sebagai persentase (1,0 -> 100000). Tanpa ini PowerPoint
  // memakai bawaannya sendiri (sekitar 1,2) dan teks bertata-letak ketat meluber
  // keluar dari kotak yang tingginya sudah dihitung persis dari browser.
  const lnSpc =
    para.lineHeight && para.lineHeight > 0
      ? `<a:lnSpc><a:spcPct val="${Math.round(para.lineHeight * 100000)}"/></a:lnSpc>`
      : '';
  const runsXml = para.runs
    .map((run) => compileRun(run, fallbackFont, fallbackColor, fallbackSize))
    .join('\n');

  return `
    <a:p>
      <a:pPr algn="${algn}">${lnSpc}</a:pPr>
      ${runsXml}
    </a:p>`.trim();
}

/**
 * Compiles a text IRNode into an OpenXML <p:sp> textbox element with zero internal margins.
 */
export function compileTextShape(
  node: IRNode,
  id: number,
  autofit: 'none' | 'shape' | 'text' = 'none'
): string {
  // Teks yang di browser muat satu baris dulu dipaksa `wrap="none"` supaya
  // selisih metrik sekecil apa pun tidak membungkusnya. Akibatnya baru
  // terlihat setelah dirender: `wrap="none"` juga berarti teks TIDAK PERNAH
  // dibatasi kotaknya, jadi begitu font PowerPoint sedikit lebih lebar,
  // kalimatnya memanjang keluar dari kartu yang menaunginya. Diukur pada satu
  // dek nyata, kotak judul memang sudah berakhir 2 px di luar kartunya sejak
  // di browser -- selisih 2 px itu yang berubah jadi luberan puluhan piksel.
  //
  // Sekarang pembungkusan dibiarkan hidup, dengan kelonggaran lebar secukupnya
  // untuk menyerap selisih metrik. Judul yang tetap tidak muat akan membungkus
  // ke baris kedua DI DALAM kartunya -- kurang rapi, tapi terkurung. Teks yang
  // meluber keluar kartu selalu lebih buruk daripada teks yang membungkus.
  const wrapMode = 'square';
  const x = inchesToEmu(node.box.x);
  const y = inchesToEmu(node.box.y);
  const METRIC_SLACK = 1.06;
  const cx = inchesToEmu(node.noWrap ? node.box.w * METRIC_SLACK : node.box.w);
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

  let autofitXml = '<a:noAutofit/>';
  if (autofit === 'shape') {
    autofitXml = '<a:spAutoFit/>';
  } else if (autofit === 'text') {
    autofitXml = '<a:normAutofit/>';
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
    <a:bodyPr wrap="${wrapMode}" rtlCol="0" lIns="0" tIns="0" rIns="0" bIns="0">
      ${autofitXml}
    </a:bodyPr>
    <a:lstStyle/>
    ${paragraphsXml}
  </p:txBody>
</p:sp>`.trim();
}
