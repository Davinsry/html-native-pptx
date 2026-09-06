export * from './types/ir.js';
export * from './types/options.js';
export * from './normalizer/units.js';
export * from './normalizer/styles.js';
export * from './normalizer/fonts.js';
export { harvestHtmlToIR } from './harvester/browser.js';
export { extractDomToSlideIR } from './harvester/traverser.js';
export { compileSlideToPptx } from './compiler/packager.js';
export { compileContainerShape } from './compiler/shapes.js';
export { compileTextShape } from './compiler/texts.js';
export { compileImageShape, loadImageData } from './compiler/images.js';

import type { SlideIR } from './types/ir.js';
import type { ConvertOptions } from './types/options.js';
import { harvestHtmlToIR } from './harvester/browser.js';
import { compileSlideToPptx } from './compiler/packager.js';

/**
 * Main conversion API: Converts an HTML string or URL into a native, editable PowerPoint (.pptx) buffer.
 *
 * @param html - Raw HTML string or valid http(s) URL.
 * @param options - Configuration options for viewport, aspect ratio, or browser instance.
 * @returns Promise resolving to a Node.js Buffer representing the .pptx file.
 */
export async function convertHtmlToPptx(
  html: string,
  options?: ConvertOptions
): Promise<Buffer> {
  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    throw new Error('Input HTML string or URL cannot be empty.');
  }

  // 1. Harvest DOM to SlideIR via Headless Chromium
  const slideIR = await harvestHtmlToIR(html, options);

  // 2. Compile SlideIR to OpenXML DrawingML presentation archive
  const pptxBuffer = await compileSlideToPptx(slideIR, {
    basePath: options?.basePath,
    autofit: options?.autofit,
  });

  return pptxBuffer;
}

/**
 * Helper to construct a blank SlideIR with standard 16:9 or 4:3 dimensions.
 */
export function createSlideIR(aspect: '16:9' | '4:3' = '16:9'): SlideIR {
  const is16_9 = aspect === '16:9';
  return {
    width: is16_9 ? 13.333333 : 10,
    height: 7.5,
    elements: [],
  };
}
