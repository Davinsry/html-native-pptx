import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { SlideIR } from '../types/ir.js';
import type { ConvertOptions } from '../types/options.js';
import { extractDomToSlideIR, type HarvestOptions } from './traverser.js';
import { resolveAndEmbedFonts } from '../normalizer/fonts.js';


const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
};

/**
 * Ganti src gambar lokal dengan data URI-nya.
 *
 * Hanya menyentuh path relatif yang benar-benar ada di bawah `basePath`; URL
 * http(s), data URI, dan path yang tidak ditemukan dibiarkan apa adanya supaya
 * kegagalan resolusi tidak pernah mengubah dokumen.
 */
function inlineLocalImages(html: string, basePath: string): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (whole, prefix: string, quote: string, src: string) => {
      const trimmed = src.trim();
      if (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('file://') ||
        trimmed.startsWith('//')
      ) {
        return whole;
      }
      try {
        const resolved = path.resolve(basePath, trimmed);
        if (!fs.existsSync(resolved)) return whole;
        const mime = IMAGE_MIME[path.extname(resolved).toLowerCase()];
        if (!mime) return whole;
        const data = fs.readFileSync(resolved).toString('base64');
        return `${prefix}${quote}data:${mime};base64,${data}${quote}`;
      } catch {
        return whole;
      }
    }
  );
}

export async function harvestHtmlToIR(
  htmlOrUrl: string,
  options: ConvertOptions = {}
): Promise<SlideIR | SlideIR[]> {
  const is16_9 = options.aspect !== '4:3';
  const defaultViewport = is16_9
    ? { width: 1920, height: 1080, deviceScaleFactor: 1 }
    : { width: 1024, height: 768, deviceScaleFactor: 1 };

  const viewport = {
    ...defaultViewport,
    ...(options.viewport || {}),
  };

  let effectiveBasePath = options.basePath;
  let contentToRender = htmlOrUrl;

  try {
    if (
      !htmlOrUrl.startsWith('http://') &&
      !htmlOrUrl.startsWith('https://') &&
      !htmlOrUrl.startsWith('file://') &&
      !htmlOrUrl.trim().startsWith('<') &&
      fs.existsSync(htmlOrUrl) &&
      fs.statSync(htmlOrUrl).isFile()
    ) {
      if (!effectiveBasePath) {
        effectiveBasePath = path.dirname(path.resolve(htmlOrUrl));
      }
      contentToRender = await fs.promises.readFile(htmlOrUrl, 'utf-8');
    }
  } catch {
    // Proceed with original input
  }

  let browser: Browser | null = null;
  let shouldCloseBrowser = false;

  try {
    if (options.browser) {
      browser = options.browser;
    } else if (options.browserWSEndpoint) {
      browser = await puppeteer.connect({
        browserWSEndpoint: options.browserWSEndpoint,
      });
      shouldCloseBrowser = true;
    } else {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          // Tanpa ini, gambar file:// menodai kanvas sehingga filter CSS tidak
          // bisa dipanggang ke pikselnya dan logo berakhir tanpa warna aslinya.
          '--allow-file-access-from-files',
        ],
      });
      shouldCloseBrowser = true;
    }

    const page: Page = await browser.newPage();
    await page.setViewport(viewport);

    const isUrl =
      contentToRender.startsWith('http://') ||
      contentToRender.startsWith('https://') ||
      contentToRender.startsWith('file://');

    const waitUntil = options.waitUntil || 'load';
    const timeout = options.timeout || 30000;

    if (isUrl) {
      await page.goto(contentToRender, { waitUntil: waitUntil as any, timeout });
    } else {
      // Gambar lokal disisipkan sebagai data URI sebelum halaman dibuat.
      //
      // Halaman hasil `setContent` bukan dokumen file://, dan Chromium menolak
      // memuat subresource file:// dari sana -- `<base href="file://...">` pun
      // tidak menolong: src-nya benar tapi gambarnya berakhir dalam keadaan
      // "broken" dengan naturalWidth 0. Akibatnya apa pun yang butuh piksel
      // aslinya di dalam halaman tidak bisa dikerjakan, termasuk memanggang
      // filter CSS seperti `filter: brightness(0)` yang menghitamkan logo.
      // Sebagai data URI, gambarnya sama-asal dengan dokumennya sehingga termuat
      // penuh dan kanvasnya pun tidak ternoda.
      const contentReady = effectiveBasePath
        ? inlineLocalImages(contentToRender, effectiveBasePath)
        : contentToRender;
      await page.setContent(contentReady, { waitUntil: waitUntil as any, timeout });
    }

    // Ensure esbuild helper __name is defined in browser context
    await page.evaluate(() => {
      (window as any).__name = (t: any) => t;
      (globalThis as any).__name = (t: any) => t;
    });

    // Check if multi-slide mode is active or auto-detectable
    const slideSelector = options.slideSelector;
    let slideElementsCount = 0;

    if (slideSelector) {
      slideElementsCount = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, slideSelector);
    }

    // Discover @font-face rules from page stylesheets
    let discoveredFonts: Array<{ typeface: string; src: string }> = [];
    if (options.autoEmbedFonts !== false) {
      try {
        discoveredFonts = await page.evaluate(() => {
          const results: Array<{ typeface: string; src: string }> = [];
          for (const sheet of Array.from(document.styleSheets)) {
            try {
              for (const rule of Array.from(sheet.cssRules || [])) {
                if (rule instanceof CSSFontFaceRule) {
                  const family = rule.style.fontFamily.replace(/^['"]+|['"]+$/g, '');
                  const srcVal = rule.style.getPropertyValue('src') || '';
                  const srcMatch = srcVal.match(/url\((['"]?)(.*?)\1\)/);
                  if (srcMatch && srcMatch[2]) {
                    results.push({ typeface: family, src: srcMatch[2] });
                  }
                }
              }
            } catch {
              // Ignore CORS errors on external sheets
            }
          }
          return results;
        });
      } catch {
        // Ignore evaluation errors
      }
    }

    const embeddedFonts = await resolveAndEmbedFonts({
      html: isUrl ? undefined : contentToRender,
      userFonts: options.fonts,
      autoEmbedFonts: options.autoEmbedFonts,
      basePath: effectiveBasePath,
      discoveredFonts,
    });

    if (slideSelector && slideElementsCount > 1) {
      const slides: SlideIR[] = [];

      // Save original inline styles for all slides
      await page.evaluate((sel: string) => {
        const allSlides = document.querySelectorAll(sel);
        allSlides.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.setAttribute('data-orig-display', htmlEl.style.display);
          htmlEl.setAttribute('data-orig-visibility', htmlEl.style.visibility);
          htmlEl.setAttribute('data-orig-position', htmlEl.style.position);
          htmlEl.setAttribute('data-orig-left', htmlEl.style.left);
          htmlEl.setAttribute('data-orig-top', htmlEl.style.top);
        });
      }, slideSelector);

      for (let i = 0; i < slideElementsCount; i++) {
        // Activate slide i and hide others without overriding active slide's display
        await page.evaluate(
          ({ sel, activeIdx }: { sel: string; activeIdx: number }) => {
            const allSlides = document.querySelectorAll(sel);
            allSlides.forEach((el, idx) => {
              const htmlEl = el as HTMLElement;
              if (idx === activeIdx) {
                htmlEl.classList.add('active');
                // Clear or restore inline display so stylesheet rules apply
                htmlEl.style.display = htmlEl.getAttribute('data-orig-display') || '';
                htmlEl.style.visibility = 'visible';
                htmlEl.style.position = htmlEl.getAttribute('data-orig-position') || '';
                htmlEl.style.left = htmlEl.getAttribute('data-orig-left') || '';
                htmlEl.style.top = htmlEl.getAttribute('data-orig-top') || '';
                htmlEl.setAttribute('data-current-harvest', 'true');
              } else {
                htmlEl.classList.remove('active');
                // Hide offscreen without overriding display
                htmlEl.style.visibility = 'hidden';
                htmlEl.style.position = 'absolute';
                htmlEl.style.left = '-99999px';
                htmlEl.style.top = '-99999px';
                htmlEl.removeAttribute('data-current-harvest');
              }
            });
          },
          { sel: slideSelector, activeIdx: i }
        );

        const harvestOptions: HarvestOptions = {
          selector: `${slideSelector}[data-current-harvest="true"]`,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          aspect: options.aspect || '16:9',
        };

        const slideIR = await page.evaluate(extractDomToSlideIR, harvestOptions);
        slides.push(slideIR);
      }

      // Restore all original inline styles
      await page.evaluate((sel: string) => {
        const allSlides = document.querySelectorAll(sel);
        allSlides.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const origDisplay = htmlEl.getAttribute('data-orig-display');
          const origVisibility = htmlEl.getAttribute('data-orig-visibility');
          const origPosition = htmlEl.getAttribute('data-orig-position');
          const origLeft = htmlEl.getAttribute('data-orig-left');
          const origTop = htmlEl.getAttribute('data-orig-top');

          htmlEl.style.display = origDisplay ?? '';
          htmlEl.style.visibility = origVisibility ?? '';
          htmlEl.style.position = origPosition ?? '';
          htmlEl.style.left = origLeft ?? '';
          htmlEl.style.top = origTop ?? '';

          htmlEl.removeAttribute('data-orig-display');
          htmlEl.removeAttribute('data-orig-visibility');
          htmlEl.removeAttribute('data-orig-position');
          htmlEl.removeAttribute('data-orig-left');
          htmlEl.removeAttribute('data-orig-top');
          htmlEl.removeAttribute('data-current-harvest');
        });
      }, slideSelector);

      if (slides.length > 0) {
        slides[0].fonts = embeddedFonts;
      }

      await page.close();
      return slides;
    }

    // Single-slide mode
    const harvestOptions: HarvestOptions = {
      selector: options.selector || 'body',
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      aspect: options.aspect || '16:9',
    };

    const singleSlideIR = await page.evaluate(extractDomToSlideIR, harvestOptions);
    singleSlideIR.fonts = embeddedFonts;

    await page.close();
    return singleSlideIR;
  } finally {
    if (shouldCloseBrowser && browser) {
      await browser.close().catch(() => {});
    }
  }
}
