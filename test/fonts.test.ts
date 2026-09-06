import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import JSZip from 'jszip';
import {
  cleanTypeface,
  isEotBuffer,
  convertTtfToEot,
  extractFontFacesFromHtml,
  compileSlideToPptx,
  createSlideIR,
  type EmbeddedFontIR,
} from '../src/index.js';

describe('Font Normalization and Embedding System', () => {
  it('should clean typeface names correctly', () => {
    expect(cleanTypeface("'Telkomsel Batik Sans', sans-serif")).toBe(
      'Telkomsel Batik Sans'
    );
    expect(cleanTypeface('"Custom Font"')).toBe('Custom Font');
    expect(cleanTypeface('Arial')).toBe('Arial');
    expect(cleanTypeface('')).toBe('');
  });

  it('should extract @font-face rules from HTML', () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: 'Telkomsel Batik Sans';
              src: url('Telkomsel-Batik-Sans-Reconstructed.ttf') format('truetype');
            }
            @font-face {
              font-family: "My Custom Serif";
              src: url("./fonts/serif.woff2");
            }
          </style>
        </head>
      </html>
    `;

    const fontFaces = extractFontFacesFromHtml(html);
    expect(fontFaces).toHaveLength(2);
    expect(fontFaces[0]).toEqual({
      typeface: 'Telkomsel Batik Sans',
      src: 'Telkomsel-Batik-Sans-Reconstructed.ttf',
    });
    expect(fontFaces[1]).toEqual({
      typeface: 'My Custom Serif',
      src: './fonts/serif.woff2',
    });
  });

  it('should convert TTF font to EOT font format with valid header', async () => {
    const ttfPath = path.join(
      __dirname,
      'fixtures',
      'curate-art',
      'Telkomsel-Batik-Sans-Reconstructed.ttf'
    );
    const ttfBuffer = await fs.readFile(ttfPath);

    expect(isEotBuffer(ttfBuffer)).toBe(false);

    const eotBuffer = convertTtfToEot(ttfBuffer);
    expect(Buffer.isBuffer(eotBuffer)).toBe(true);
    expect(eotBuffer.length).toBeGreaterThan(1000);
    expect(isEotBuffer(eotBuffer)).toBe(true);
  });

  it('should compile PPTX with embedded font structures in OpenXML package', async () => {
    const ttfPath = path.join(
      __dirname,
      'fixtures',
      'curate-art',
      'Telkomsel-Batik-Sans-Reconstructed.ttf'
    );
    const ttfBuffer = await fs.readFile(ttfPath);
    const fntData = convertTtfToEot(ttfBuffer);

    const slide = createSlideIR('16:9');
    slide.elements.push({
      type: 'text',
      box: { x: 1, y: 1, w: 8, h: 2 },
      content: 'Custom Font Heading',
      textStyle: {
        fontFamily: 'Telkomsel Batik Sans',
        fontSize: 32,
        color: '000000',
        bold: true,
      },
    });

    const fonts: EmbeddedFontIR[] = [
      {
        typeface: 'Telkomsel Batik Sans',
        fntData,
      },
    ];

    const pptxBuffer = await compileSlideToPptx(slide, { fonts });
    expect(Buffer.isBuffer(pptxBuffer)).toBe(true);

    const zip = await JSZip.loadAsync(pptxBuffer);

    // 1. Check Content Types
    const ctXml = await zip.file('[Content_Types].xml')!.async('text');
    expect(ctXml).toContain(
      '<Default Extension="fntdata" ContentType="application/x-fontdata"/>'
    );

    // 2. Check Presentation XML
    const presXml = await zip.file('ppt/presentation.xml')!.async('text');
    expect(presXml).toContain('embedTrueTypeFonts="true"');
    expect(presXml).toContain('<p:embeddedFontLst>');
    expect(presXml).toContain('<p:font typeface="Telkomsel Batik Sans"/>');
    expect(presXml).toContain('<p:regular r:id="rIdFont1"/>');

    // 3. Check Presentation Rels
    const relsXml = await zip.file('ppt/_rels/presentation.xml.rels')!.async('text');
    expect(relsXml).toContain(
      'Target="fonts/font1.fntdata"'
    );
    expect(relsXml).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"'
    );

    // 4. Check Font Binary file in ppt/fonts/
    const fontFile = zip.file('ppt/fonts/font1.fntdata');
    expect(fontFile).toBeDefined();
    const fontData = await fontFile!.async('nodebuffer');
    expect(fontData.length).toBe(fntData.length);
  });
});
