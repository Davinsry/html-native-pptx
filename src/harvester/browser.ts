import * as fs from 'node:fs';
import * as path from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { SlideIR } from '../types/ir.js';
import type { ConvertOptions } from '../types/options.js';
import { extractDomToSlideIR, type HarvestOptions } from './traverser.js';
import { resolveAndEmbedFonts } from '../normalizer/fonts.js';

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
      await page.setContent(contentToRender, { waitUntil: waitUntil as any, timeout });
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
                  const styleAny = rule.style as any;
                  const srcVal = styleAny.src || rule.style.getPropertyValue('src') || '';
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

      for (let i = 0; i < slideElementsCount; i++) {
        // Activate slide i and hide others
        await page.evaluate(
          ({ sel, activeIdx }: { sel: string; activeIdx: number }) => {
            const allSlides = document.querySelectorAll(sel);
            allSlides.forEach((el, idx) => {
              const htmlEl = el as HTMLElement;
              if (idx === activeIdx) {
                htmlEl.classList.add('active');
                htmlEl.style.display = 'flex';
                htmlEl.style.visibility = 'visible';
                htmlEl.setAttribute('data-current-harvest', 'true');
              } else {
                htmlEl.classList.remove('active');
                htmlEl.style.display = 'none';
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
