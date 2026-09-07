import type { IRNode, TableIR, TableCellIR, ParagraphIR, TextAlign } from '../types/ir.js';
import { inchesToEmu } from '../normalizer/units.js';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function mapAlign(align?: TextAlign): string {
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

function compileCellTxBody(cell: TableCellIR): string {
  const pPrAlign = cell.align ? ` algn="${mapAlign(cell.align)}"` : '';

  if (cell.paragraphs && cell.paragraphs.length > 0) {
    const paragraphsXml = cell.paragraphs
      .map((p) => {
        const alignAttr = p.align ? ` algn="${mapAlign(p.align)}"` : pPrAlign;
        const runsXml = (p.runs || [])
          .map((r) => {
            const szAttr = r.fontSize ? ` sz="${Math.round(r.fontSize * 100)}"` : ' sz="1200"';
            const bAttr = r.bold ? ' b="1"' : ' b="0"';
            const iAttr = r.italic ? ' i="1"' : ' i="0"';
            const uAttr = r.underline ? ' u="sng"' : '';
            const colorVal = r.color || '000000';
            const fontAttr = r.fontFamily ? `<a:latin typeface="${escapeXml(r.fontFamily)}"/>` : '';

            return `<a:r><a:rPr${szAttr}${bAttr}${iAttr}${uAttr}><a:solidFill><a:srgbClr val="${colorVal}"/></a:solidFill>${fontAttr}</a:rPr><a:t>${escapeXml(r.content)}</a:t></a:r>`;
          })
          .join('');

        return `<a:p><a:pPr${alignAttr}/>${runsXml || '<a:endParaRPr/>'}</a:p>`;
      })
      .join('');

    return `<a:txBody><a:bodyPr/><a:lstStyle/>${paragraphsXml}</a:txBody>`;
  }

  const textContent = cell.content ? escapeXml(cell.content) : '';
  const textRun = textContent
    ? `<a:r><a:rPr sz="1200" b="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:rPr><a:t>${textContent}</a:t></a:r>`
    : '<a:endParaRPr/>';

  return `<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr${pPrAlign}/>${textRun}</a:p></a:txBody>`;
}

function compileCell(cell: TableCellIR): string {
  const txBody = compileCellTxBody(cell);

  let anchor = 'ctr';
  if (cell.verticalAlign === 'top') anchor = 't';
  else if (cell.verticalAlign === 'bottom') anchor = 'b';

  let fillXml = '<a:noFill/>';
  if (cell.fillColor) {
    const opacityVal =
      cell.fillOpacity !== undefined && cell.fillOpacity < 1
        ? `<a:alpha val="${Math.round(cell.fillOpacity * 100000)}"/>`
        : '';
    fillXml = `<a:solidFill><a:srgbClr val="${cell.fillColor}">${opacityVal}</a:srgbClr></a:solidFill>`;
  }

  let borderXml = '';
  if (cell.borderColor && cell.borderWidth && cell.borderWidth > 0) {
    const borderEmu = Math.round(cell.borderWidth * 12700);
    const ln = `<a:ln w="${borderEmu}"><a:solidFill><a:srgbClr val="${cell.borderColor}"/></a:solidFill></a:ln>`;
    borderXml = `<a:lnL>${ln}</a:lnL><a:lnR>${ln}</a:lnR><a:lnT>${ln}</a:lnT><a:lnB>${ln}</a:lnB>`;
  }

  const gridSpan = cell.colSpan && cell.colSpan > 1 ? ` gridSpan="${cell.colSpan}"` : '';
  const rowSpan = cell.rowSpan && cell.rowSpan > 1 ? ` rowSpan="${cell.rowSpan}"` : '';

  return `
<a:tc${gridSpan}${rowSpan}>
  ${txBody}
  <a:tcPr anchor="${anchor}" marL="72000" marR="72000" marT="54000" marB="54000">
    ${fillXml}
    ${borderXml}
  </a:tcPr>
</a:tc>`.trim();
}

export function compileTableGraphicFrame(node: IRNode, id: number): string {
  const table = node.table;
  if (!table || !table.rows || table.rows.length === 0) {
    return '';
  }

  const x = inchesToEmu(node.box.x);
  const y = inchesToEmu(node.box.y);
  const cx = inchesToEmu(node.box.w);
  const cy = inchesToEmu(node.box.h);
  const name = escapeXml(node.name || `Table ${id}`);

  const gridColsXml = table.columns
    .map((col) => `<a:gridCol w="${inchesToEmu(col.width)}"/>`)
    .join('');

  const rowsXml = table.rows
    .map((row) => {
      const rowHeightEmu = inchesToEmu(row.height);
      const cellsXml = row.cells.map(compileCell).join('\n');
      return `<a:tr h="${rowHeightEmu}">\n${cellsXml}\n</a:tr>`;
    })
    .join('\n');

  return `
<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:cNvPr id="${id}" name="${name}"/>
    <p:cNvGraphicFramePr>
      <a:graphicFrameLocks noGrp="1"/>
    </p:cNvGraphicFramePr>
    <p:nvPr/>
  </p:nvGraphicFramePr>
  <p:xfrm>
    <a:off x="${x}" y="${y}"/>
    <a:ext cx="${cx}" cy="${cy}"/>
  </p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblPr firstRow="1" bandRow="1">
          <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
        </a:tblPr>
        <a:tblGrid>
          ${gridColsXml}
        </a:tblGrid>
        ${rowsXml}
      </a:tbl>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`.trim();
}
