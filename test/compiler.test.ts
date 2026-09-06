import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  compileSlideToPptx,
  convertHtmlToPptx,
  type SlideIR,
  UNITS,
} from '../src/index.js';

describe('Compiler Module (OpenXML & JSZip)', () => {
  it('should compile SlideIR into a valid PPTX zip buffer with all required parts', async () => {
    const slide: SlideIR = {
      width: UNITS.SLIDE_16_9_WIDTH_INCHES,
      height: UNITS.SLIDE_16_9_HEIGHT_INCHES,
      backgroundColor: '0F172A',
      elements: [
        {
          id: 2,
          name: 'HeroCard',
          type: 'container',
          box: { x: 1.0, y: 1.0, w: 5.0, h: 3.0 },
          shapeStyle: {
            fillColor: '1E293B',
            borderColor: '38BDF8',
            borderWidth: 2,
            radius: 16,
          },
        },
        {
          id: 3,
          name: 'TitleText',
          type: 'text',
          box: { x: 1.2, y: 1.2, w: 4.6, h: 0.8 },
          paragraphs: [
            {
              align: 'left',
              runs: [
                {
                  content: 'Native OpenXML PPTX',
                  fontFamily: 'Arial',
                  fontSize: 24,
                  bold: true,
                  color: 'FFFFFF',
                },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await compileSlideToPptx(slide);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    // ZIP magic header check: 0x50, 0x4B, 0x03, 0x04 ("PK\x03\x04")
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);

    // Inspect zip contents
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file('[Content_Types].xml')).toBeDefined();
    expect(zip.file('_rels/.rels')).toBeDefined();
    expect(zip.file('ppt/presentation.xml')).toBeDefined();
    expect(zip.file('ppt/_rels/presentation.xml.rels')).toBeDefined();
    expect(zip.file('ppt/slides/slide1.xml')).toBeDefined();
    expect(zip.file('ppt/slides/_rels/slide1.xml.rels')).toBeDefined();
    expect(zip.file('ppt/slideMasters/slideMaster1.xml')).toBeDefined();
    expect(zip.file('ppt/slideLayouts/slideLayout1.xml')).toBeDefined();
    expect(zip.file('ppt/theme/theme1.xml')).toBeDefined();

    // Verify slide1.xml contains shape elements and slide background
    const slide1Content = await zip.file('ppt/slides/slide1.xml')!.async('text');
    expect(slide1Content).toContain('<p:bg>');
    expect(slide1Content).toContain('val="0F172A"');
    expect(slide1Content).toContain('HeroCard');
    expect(slide1Content).toContain('prst="roundRect"');
    expect(slide1Content).toContain('val="1E293B"');
    expect(slide1Content).toContain('val="38BDF8"');
    expect(slide1Content).toContain('Native OpenXML PPTX');
    expect(slide1Content).toContain('sz="2400"'); // 24pt -> 2400
    expect(slide1Content).toContain('lIns="0" tIns="0" rIns="0" bIns="0"'); // zero margin
  });

  it(
    'should convert HTML string directly to PPTX buffer end-to-end',
    async () => {
      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 40px; background: #111827; }
            .box { background: #1f2937; border: 1px solid #4f46e5; border-radius: 8px; padding: 20px; }
            h2 { color: #f9fafb; font-family: 'Helvetica'; margin: 0; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>End-to-End Test Passed</h2>
          </div>
        </body>
      </html>
    `;

      const buffer = await convertHtmlToPptx(html);
      expect(Buffer.isBuffer(buffer)).toBe(true);

      const zip = await JSZip.loadAsync(buffer);
      const slideContent = await zip.file('ppt/slides/slide1.xml')!.async('text');
      expect(slideContent).toContain('End-to-End Test Passed');
    },
    30000
  );
});
