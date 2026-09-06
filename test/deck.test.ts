import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import JSZip from 'jszip';
import { convertHtmlToPptx } from '../src/index.js';

describe('Real-World Multi-Slide Presentation Test', () => {
  it(
    'should convert Biennale Curatorial HTML deck (8 slides) into a complete multi-slide PPTX',
    async () => {
      const htmlPath = path.join(
        __dirname,
        'fixtures',
        'curate-art',
        'curatorial-biennale-deck.html'
      );
      const html = await fs.readFile(htmlPath, 'utf-8');

      // Convert using multi-slide option with basePath to auto-embed fonts
      const pptxBuffer = await convertHtmlToPptx(html, {
        slideSelector: '.slide',
        aspect: '16:9',
        viewport: { width: 1920, height: 1080 },
        basePath: path.dirname(htmlPath),
      });

      expect(Buffer.isBuffer(pptxBuffer)).toBe(true);

      const zip = await JSZip.loadAsync(pptxBuffer);

      // Verify all 8 slides exist in the zip
      for (let i = 1; i <= 8; i++) {
        expect(zip.file(`ppt/slides/slide${i}.xml`)).toBeDefined();
        expect(zip.file(`ppt/slides/_rels/slide${i}.xml.rels`)).toBeDefined();
      }

      // Check presentation.xml sldId count and embedded fonts
      const presXml = await zip.file('ppt/presentation.xml')!.async('text');
      expect(presXml).toContain('id="256"');
      expect(presXml).toContain('id="263"'); // 256 + 7 = 263 (8 slides)
      expect(presXml).toContain('embedTrueTypeFonts="true"');
      expect(presXml).toContain('typeface="Telkomsel Batik Sans"');

      // Check font file exists in zip
      expect(zip.file('ppt/fonts/font1.fntdata')).toBeDefined();

      // Save complete output presentation
      const outputPath = path.join(
        __dirname,
        'fixtures',
        'curate-art',
        'Biennale-Curatorial-Deck.pptx'
      );
      await fs.writeFile(outputPath, pptxBuffer);

      const stat = await fs.stat(outputPath);
      expect(stat.size).toBeGreaterThan(10000);
    },
    60000
  );
});
