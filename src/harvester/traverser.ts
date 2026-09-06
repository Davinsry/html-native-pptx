import type { IRNode, SlideIR, TextRun, ParagraphIR } from '../types/ir.js';

export interface HarvestOptions {
  selector?: string;
  viewportWidth: number;
  viewportHeight: number;
  aspect?: '16:9' | '4:3';
}

/**
 * In-browser evaluation function to harvest DOM tree and compile it to SlideIR.
 * Designed to execute inside Puppeteer's page.evaluate().
 */
export function extractDomToSlideIR(options: HarvestOptions): SlideIR {
  const DPI = 96;
  const is16_9 = options.aspect !== '4:3';
  const SLIDE_W = is16_9 ? 13.333333 : 10;
  const SLIDE_H = 7.5;

  const SCALE_X = SLIDE_W / (options.viewportWidth / DPI);
  const SCALE_Y = SLIDE_H / (options.viewportHeight / DPI);

  const nodes: IRNode[] = [];
  let nodeIdCounter = 1;

  function toHex(cssColor?: string): string | undefined {
    if (!cssColor) return undefined;
    const trimmed = cssColor.trim().toLowerCase();
    if (trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)' || trimmed === 'none') {
      return undefined;
    }

    // Parse rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = trimmed.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/
    );
    if (rgbMatch) {
      const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
      if (a <= 0) return undefined;
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      return ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1)
        .toUpperCase();
    }

    // Parse #hex
    if (trimmed.startsWith('#')) {
      const raw = trimmed.slice(1);
      if (raw.length === 3) {
        return raw.split('').map((c) => c + c).join('').toUpperCase();
      }
      if (raw.length >= 6) {
        return raw.slice(0, 6).toUpperCase();
      }
    }

    return undefined;
  }

  function cleanFontFamily(fontFamily: string): string {
    const first = fontFamily.split(',')[0].trim();
    return first.replace(/^['"]+|['"]+$/g, '') || 'Arial';
  }

  function isBold(weight: string): boolean {
    if (weight === 'bold' || weight === 'bolder') return true;
    const num = parseInt(weight, 10);
    return !isNaN(num) && num >= 600;
  }

  function isInlineFormattingTag(tagName: string): boolean {
    return ['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'CODE', 'MARK', 'SMALL'].includes(
      tagName
    );
  }

  function isTextBlockTag(tagName: string): boolean {
    return ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'].includes(
      tagName
    );
  }

  // Root selector
  const root =
    (options.selector ? document.querySelector(options.selector) : null) ||
    document.body;

  const rootStyle = window.getComputedStyle(root);
  const slideBg = toHex(rootStyle.backgroundColor);

  const rootRect = root.getBoundingClientRect();
  const rootW = rootRect.width > 0 ? rootRect.width : options.viewportWidth;
  const rootH = rootRect.height > 0 ? rootRect.height : options.viewportHeight;

  // Extract text runs from a text block
  function collectTextRuns(parentEl: HTMLElement): TextRun[] {
    const runs: TextRun[] = [];

    function traverseNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text && text.length > 0) {
          const parent = node.parentElement || parentEl;
          const style = window.getComputedStyle(parent);
          runs.push({
            content: text,
            fontFamily: cleanFontFamily(style.fontFamily),
            fontSize: (parseFloat(style.fontSize) * 72) / DPI,
            color: toHex(style.color) || '000000',
            bold: isBold(style.fontWeight),
            italic: style.fontStyle === 'italic' || style.fontStyle === 'oblique',
            underline: style.textDecorationLine?.includes('underline'),
            strikethrough: style.textDecorationLine?.includes('line-through'),
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        Array.from(node.childNodes).forEach(traverseNodes);
      }
    }

    Array.from(parentEl.childNodes).forEach(traverseNodes);
    return runs;
  }

  function walk(el: HTMLElement) {
    if (el === root) {
      Array.from(el.children).forEach((child) => walk(child as HTMLElement));
      return;
    }

    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Normalisasi koordinat ke Inches relatif terhadap root container
    const box = {
      x: ((rect.left - rootRect.left) / rootW) * SLIDE_W,
      y: ((rect.top - rootRect.top) / rootH) * SLIDE_H,
      w: (rect.width / rootW) * SLIDE_W,
      h: (rect.height / rootH) * SLIDE_H,
    };

    const hasBg =
      style.backgroundColor &&
      style.backgroundColor !== 'transparent' &&
      style.backgroundColor !== 'rgba(0, 0, 0, 0)';

    const hasBorder =
      parseFloat(style.borderWidth) > 0 && style.borderStyle !== 'none';

    // 1. Jika elemen memiliki visual background atau border -> Petakan sebagai Container
    if (hasBg || hasBorder) {
      nodes.push({
        id: nodeIdCounter++,
        name: `${el.tagName.toLowerCase()}-box`,
        type: 'container',
        box,
        shapeStyle: {
          fillColor: hasBg ? toHex(style.backgroundColor) : undefined,
          borderColor: hasBorder ? toHex(style.borderColor) : undefined,
          borderWidth: hasBorder ? (parseFloat(style.borderWidth) * 72) / DPI : 0,
          radius: parseFloat(style.borderRadius) || 0,
        },
      });
    }

    // 2. Jika elemen adalah Image <img>
    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      if (img.src) {
        nodes.push({
          id: nodeIdCounter++,
          name: 'image',
          type: 'image',
          box,
          content: img.src,
        });
        return; // Leaf image
      }
    }

    // 3. Deteksi apakah elemen ini adalah Text Block
    const hasText = (el.textContent || '').trim().length > 0;
    const isExplicitTextBlock = isTextBlockTag(el.tagName);
    const hasOnlyInlineChildren =
      el.childElementCount > 0 &&
      Array.from(el.children).every((c) => isInlineFormattingTag(c.tagName));
    const isLeafText = el.childElementCount === 0 && hasText;

    if (hasText && (isExplicitTextBlock || isLeafText || hasOnlyInlineChildren)) {
      const runs = collectTextRuns(el);
      if (runs.length > 0) {
        const primaryRun = runs[0];
        const textAlign = (style.textAlign as any) || 'left';

        nodes.push({
          id: nodeIdCounter++,
          name: `${el.tagName.toLowerCase()}-text`,
          type: 'text',
          box,
          content: el.textContent?.trim() || '',
          textStyle: {
            fontFamily: primaryRun.fontFamily || 'Arial',
            fontSize: primaryRun.fontSize || 16,
            color: primaryRun.color || '000000',
            bold: primaryRun.bold || false,
            italic: primaryRun.italic || false,
            underline: primaryRun.underline || false,
            align: textAlign,
          },
          paragraphs: [
            {
              align: textAlign,
              runs,
            },
          ],
        });
        return; // Text block selesai diproses
      }
    }

    // Rekursif ke anak elemen
    Array.from(el.children).forEach((child) => walk(child as HTMLElement));
  }

  if (root) {
    walk(root as HTMLElement);
  }

  return {
    width: SLIDE_W,
    height: SLIDE_H,
    backgroundColor: slideBg,
    elements: nodes,
  };
}
