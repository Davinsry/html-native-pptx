import { describe, it, expect } from 'vitest';
import { harvestHtmlToIR } from '../src/index.js';

describe('Harvester Module (Puppeteer)', () => {
  it(
    'should harvest HTML card with inline rich text and container styling',
    async () => {
      const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 40px;
              background-color: #0f172a;
              font-family: Arial, sans-serif;
            }
            .card {
              background-color: #1e293b;
              border: 2px solid #38bdf8;
              border-radius: 12px;
              padding: 24px;
              width: 400px;
            }
            h1 {
              color: #ffffff;
              font-size: 24px;
              margin: 0 0 12px 0;
            }
            p {
              color: #94a3b8;
              font-size: 16px;
              margin: 0;
            }
            .highlight {
              color: #38bdf8;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Architecture Title</h1>
            <p>Welcome to <span class="highlight">Native PPTX</span> generation!</p>
          </div>
        </body>
      </html>
    `;

      const slide = (await harvestHtmlToIR(sampleHtml, {
        aspect: '16:9',
        viewport: { width: 1920, height: 1080 },
      })) as SlideIR;

      expect(slide.width).toBeCloseTo(13.333333, 4);
      expect(slide.height).toBe(7.5);
      expect(slide.backgroundColor).toBe('0F172A');

      // Elements should include container card and text blocks
      const container = slide.elements.find((el) => el.type === 'container');
      expect(container).toBeDefined();
      expect(container?.shapeStyle?.fillColor).toBe('1E293B');
      expect(container?.shapeStyle?.borderColor).toBe('38BDF8');
      expect(container?.shapeStyle?.radius).toBe(12);

      // Text elements
      const heading = slide.elements.find(
        (el) => el.type === 'text' && el.content?.includes('Architecture Title')
      );
      expect(heading).toBeDefined();
      expect(heading?.textStyle?.color).toBe('FFFFFF');
      expect(heading?.textStyle?.bold).toBe(true);

      // Paragraph with inline rich text runs
      const paragraph = slide.elements.find(
        (el) => el.type === 'text' && el.content?.includes('Welcome to')
      );
      expect(paragraph).toBeDefined();
      expect(paragraph?.paragraphs?.[0].runs.length).toBeGreaterThanOrEqual(2);

      const highlightedRun = paragraph?.paragraphs?.[0].runs.find(
        (r) => r.content === 'Native PPTX'
      );
      expect(highlightedRun).toBeDefined();
      expect(highlightedRun?.color).toBe('38BDF8');
      expect(highlightedRun?.bold).toBe(true);
    },
    30000
  );
});
