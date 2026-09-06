import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import JSZip from 'jszip';
import { convertHtmlToPptx } from '../src/index.js';

describe('End-to-End Fixture Test', () => {
  it(
    'should convert modern 3-card Flexbox slide into output.pptx',
    async () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'three-cards.html');
      const html = await fs.readFile(fixturePath, 'utf-8');

      const pptxBuffer = await convertHtmlToPptx(html, {
        aspect: '16:9',
        viewport: { width: 1920, height: 1080 },
      });

      expect(Buffer.isBuffer(pptxBuffer)).toBe(true);
      expect(pptxBuffer.length).toBeGreaterThan(2000);

      // Save output.pptx so the user can open it in PowerPoint
      const outputPath = path.join(__dirname, 'fixtures', 'output.pptx');
      await fs.writeFile(outputPath, pptxBuffer);

      // Verify zip file structure
      const zip = await JSZip.loadAsync(pptxBuffer);
      const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('text');

      expect(slideXml).toContain('High-Performance Slide Generation');
      expect(slideXml).toContain('Headless Engine');
      expect(slideXml).toContain('AST IR Contract');
      expect(slideXml).toContain('OpenXML DrawingML');
      expect(slideXml).toContain('prst="roundRect"');

      // Verify file exists on disk
      const stat = await fs.stat(outputPath);
      expect(stat.size).toBeGreaterThan(0);
    },
    35000
  );
});
