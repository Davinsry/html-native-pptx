import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import JSZip from 'jszip';
import {
  compileImageShape,
  loadImageData,
  compileSlideToPptx,
  createSlideIR,
} from '../src/index.js';

describe('Image Embedding and Compilation Module', () => {
  it('should compile an image node into valid <p:pic> OpenXML DrawingML', () => {
    const xml = compileImageShape(
      {
        type: 'image',
        name: 'test-logo',
        box: { x: 1, y: 1.5, w: 2, h: 1 },
        content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
      5,
      'rIdImg1'
    );

    expect(xml).toContain('<p:pic>');
    expect(xml).toContain('<p:cNvPr id="5" name="test-logo"/>');
    expect(xml).toContain('<a:blip r:embed="rIdImg1"/>');
    expect(xml).toContain('</p:pic>');
  });

  it('should load image binary from data URI and local file path', async () => {
    const dataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const loadedDataUri = await loadImageData(dataUri);
    expect(loadedDataUri).not.toBeNull();
    expect(loadedDataUri?.extension).toBe('png');
    expect(loadedDataUri?.data.length).toBeGreaterThan(0);

    const localImgPath = path.join(
      __dirname,
      'fixtures',
      'curate-art',
      'icon_Telkomsel.png'
    );
    const loadedLocal = await loadImageData(localImgPath);
    expect(loadedLocal).not.toBeNull();
    expect(loadedLocal?.extension).toBe('png');
    expect(loadedLocal?.data.length).toBeGreaterThan(100);
  });

  it('should package slide with image into ppt/media, slide rels, and [Content_Types].xml', async () => {
    const slide = createSlideIR('16:9');
    const localImg = path.join(
      __dirname,
      'fixtures',
      'curate-art',
      'icon_Telkomsel.png'
    );

    slide.elements.push({
      type: 'image',
      name: 'telkomsel-logo',
      box: { x: 0.5, y: 0.5, w: 1.5, h: 0.5 },
      content: localImg,
    });

    const pptxBuffer = await compileSlideToPptx(slide);
    expect(Buffer.isBuffer(pptxBuffer)).toBe(true);

    const zip = await JSZip.loadAsync(pptxBuffer);

    // 1. Check media file in ZIP
    const mediaFile = zip.file('ppt/media/image1.png');
    expect(mediaFile).toBeDefined();

    // 2. Check slide rels
    const relsXml = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('text');
    expect(relsXml).toContain('Target="../media/image1.png"');
    expect(relsXml).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"'
    );

    // 3. Check [Content_Types].xml
    const ctXml = await zip.file('[Content_Types].xml')!.async('text');
    expect(ctXml).toContain('Extension="png"');

    // 4. Check slide1.xml contains <p:pic>
    const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('text');
    expect(slideXml).toContain('<p:pic>');
    expect(slideXml).toContain('telkomsel-logo');
  });

  it('should record warning and not crash when an image fails to load', async () => {
    const slide = createSlideIR('16:9');
    slide.elements.push({
      type: 'image',
      name: 'missing-image',
      box: { x: 0.5, y: 0.5, w: 1, h: 1 },
      content: 'non_existent_image_12345.png',
    });

    const warnings: string[] = [];
    const pptxBuffer = await compileSlideToPptx(slide, { warnings });

    expect(Buffer.isBuffer(pptxBuffer)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('could not be loaded');
  });
});
