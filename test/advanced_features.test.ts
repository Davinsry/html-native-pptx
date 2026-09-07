import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  compileSlideToPptx,
  convertHtmlToPptx,
  type SlideIR,
  UNITS,
} from '../src/index.js';

describe('Advanced Features (Tables, Gradients, SVG Paths)', () => {
  it('should compile a native OpenXML table with <a:tbl>, columns, and rows', async () => {
    const slide: SlideIR = {
      width: UNITS.SLIDE_16_9_WIDTH_INCHES,
      height: UNITS.SLIDE_16_9_HEIGHT_INCHES,
      elements: [
        {
          id: 10,
          name: 'MetricsTable',
          type: 'table',
          box: { x: 1.0, y: 1.0, w: 8.0, h: 4.0 },
          table: {
            columns: [{ width: 4.0 }, { width: 4.0 }],
            rows: [
              {
                height: 1.0,
                cells: [
                  {
                    content: 'Metric Header',
                    fillColor: '071526',
                    align: 'center',
                    paragraphs: [
                      {
                        align: 'center',
                        runs: [
                          {
                            content: 'Metric Header',
                            fontSize: 14,
                            bold: true,
                            color: 'FFFFFF',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    content: 'Value Header',
                    fillColor: '071526',
                    align: 'center',
                  },
                ],
              },
              {
                height: 1.0,
                cells: [
                  {
                    content: 'Active Users',
                    fillColor: 'F8FAFC',
                    align: 'left',
                  },
                  {
                    content: '1,500,000',
                    fillColor: 'FFFFFF',
                    align: 'right',
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const buffer = await compileSlideToPptx(slide);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');

    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('<p:graphicFrame>');
    expect(slideXml).toContain('<a:tbl>');
    expect(slideXml).toContain('<a:tblGrid>');
    expect(slideXml).toContain('<a:gridCol');
    expect(slideXml).toContain('<a:tr');
    expect(slideXml).toContain('<a:tc>');
    expect(slideXml).toContain('Metric Header');
    expect(slideXml).toContain('1,500,000');
    expect(slideXml).toContain('val="071526"');
  });

  it('should compile linear-gradient into DrawingML <a:gradFill>', async () => {
    const slide: SlideIR = {
      width: UNITS.SLIDE_16_9_WIDTH_INCHES,
      height: UNITS.SLIDE_16_9_HEIGHT_INCHES,
      elements: [
        {
          id: 20,
          name: 'GradientBanner',
          type: 'container',
          box: { x: 1.0, y: 1.0, w: 6.0, h: 3.0 },
          shapeStyle: {
            gradient: {
              type: 'linear',
              angle: 135,
              stops: [
                { position: 0, color: 'E11428' },
                { position: 1, color: '071526' },
              ],
            },
          },
        },
      ],
    };

    const buffer = await compileSlideToPptx(slide);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');

    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('<a:gradFill');
    expect(slideXml).toContain('<a:gsLst>');
    expect(slideXml).toContain('<a:gs pos="0">');
    expect(slideXml).toContain('val="E11428"');
    expect(slideXml).toContain('<a:gs pos="100000">');
    expect(slideXml).toContain('val="071526"');
    expect(slideXml).toContain('<a:lin');
  });

  it('should compile SVG path into DrawingML <a:custGeom> with moveTo and lnTo', async () => {
    const slide: SlideIR = {
      width: UNITS.SLIDE_16_9_WIDTH_INCHES,
      height: UNITS.SLIDE_16_9_HEIGHT_INCHES,
      elements: [
        {
          id: 30,
          name: 'CustomPathIcon',
          type: 'container',
          box: { x: 1.0, y: 1.0, w: 2.0, h: 2.0 },
          shapeStyle: {
            customPath: 'M 10 20 L 50 80 L 90 20 Z',
            pathViewBox: { w: 100, h: 100 },
            fillColor: 'E11428',
          },
        },
      ],
    };

    const buffer = await compileSlideToPptx(slide);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');

    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('<a:custGeom>');
    expect(slideXml).toContain('<a:pathLst>');
    expect(slideXml).toContain('<a:moveTo>');
    expect(slideXml).toContain('<a:lnTo>');
    expect(slideXml).toContain('<a:close/>');
    expect(slideXml).toContain('val="E11428"');
  });

  it('should convert an HTML slide containing native table, linear-gradient, and SVG path end-to-end', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0; width:1280px; height:720px; background:#f8fafc;">
        <div style="width:400px; height:200px; background: linear-gradient(135deg, #e11428 0%, #071526 100%); border-radius:12px;">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#ffffff" stroke-width="2" fill="none" />
          </svg>
        </div>
        <table style="width:600px; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #071526; color: #ffffff;">
              <th style="padding: 8px;">Item</th>
              <th style="padding: 8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #ffffff;">
              <td style="padding: 8px;">Feature Deployment</td>
              <td style="padding: 8px;">Ready</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const buffer = await convertHtmlToPptx(html, {
      aspect: '16:9',
      viewport: { width: 1280, height: 720 },
    });

    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');

    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('<a:tbl>');
    expect(slideXml).toContain('Feature Deployment');
    expect(slideXml).toContain('<a:gradFill');
    expect(slideXml).toContain('<a:custGeom>');
  });
});
