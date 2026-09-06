import { describe, it, expect } from 'vitest';
import { harvestHtmlToIR, type SlideIR } from '../src/index.js';

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

  it(
    'should harvest single-side borders, percentage radius, alpha opacity, br, and inline highlights',
    async () => {
      const advancedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; background: #ffffff; }
            .circle {
              width: 120px;
              height: 120px;
              border-radius: 50%;
              background-color: rgba(0, 0, 0, 0.35);
              position: absolute;
              top: 20px;
              left: 20px;
              z-index: 10;
            }
            .border-bottom-box {
              width: 200px;
              height: 100px;
              border-bottom: 6px solid #ED0226;
              position: absolute;
              top: 200px;
              left: 20px;
            }
            .multiline {
              position: absolute;
              top: 350px;
              left: 20px;
              width: 300px;
              z-index: 5;
            }
          </style>
        </head>
        <body>
          <div class="circle"></div>
          <div class="border-bottom-box"></div>
          <div class="multiline">
            Baris pertama<br>Baris kedua <span style="background-color: #FFFF00;">disorot</span>
          </div>
        </body>
      </html>
      `;

      const slide = (await harvestHtmlToIR(advancedHtml, {
        aspect: '16:9',
        viewport: { width: 1920, height: 1080 },
      })) as SlideIR;

      // 1. Percentage border-radius (50% of 120px = 60px) & alpha (0.35) & zIndex (10)
      const circleNode = slide.elements.find(
        (el) => el.type === 'container' && el.shapeStyle?.radius === 60
      );
      expect(circleNode).toBeDefined();
      expect(circleNode?.shapeStyle?.fillColor).toBe('000000');
      expect(circleNode?.shapeStyle?.fillOpacity).toBeCloseTo(0.35, 2);
      expect(circleNode?.zIndex).toBe(10);

      // 2. Single-side border (border-bottom 6px solid #ED0226)
      const bottomBorderStrip = slide.elements.find(
        (el) => el.type === 'container' && el.shapeStyle?.fillColor === 'ED0226'
      );
      expect(bottomBorderStrip).toBeDefined();

      // 3. Multi-line with <br> and normalized content
      const textNode = slide.elements.find(
        (el) => el.type === 'text' && el.content?.includes('Baris pertama')
      );
      expect(textNode).toBeDefined();
      expect(textNode?.content).toContain('Baris pertama\nBaris kedua disorot');
      expect(textNode?.paragraphs?.length).toBe(2);
      expect(textNode?.paragraphs?.[0].runs[0].content).toBe('Baris pertama');
      expect(textNode?.zIndex).toBe(5);

      // 4. Inline highlight background container behind text
      const highlightNode = slide.elements.find(
        (el) => el.type === 'container' && el.shapeStyle?.fillColor === 'FFFF00'
      );
      expect(highlightNode).toBeDefined();
      expect(highlightNode?.zIndex).toBeLessThan(textNode?.zIndex ?? 0);
    },
    30000
  );
});
