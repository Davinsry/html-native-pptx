import type { Browser } from 'puppeteer';

export type SlideAspect = '16:9' | '4:3';

export interface ViewportOptions {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface EmbeddedFontOption {
  /**
   * Font family / typeface name (e.g. "Telkomsel Batik Sans").
   */
  typeface: string;

  /**
   * Source font file path (.ttf, .otf, .eot, .fntdata), HTTP(S) URL, data URI, or raw Buffer.
   */
  src: string | Buffer;
}

export interface ConvertOptions {
  /**
   * Presentation aspect ratio. Defaults to '16:9'.
   */
  aspect?: SlideAspect;

  /**
   * Browser viewport dimensions for headless layout resolution.
   * Defaults to 1920x1080 for 16:9, or 1024x768 for 4:3.
   */
  viewport?: ViewportOptions;

  /**
   * CSS selector for the root container element to capture as slide.
   * Defaults to 'body'.
   */
  selector?: string;

  /**
   * Optional CSS selector to detect and extract multi-slide presentations.
   * e.g., '.slide' or 'section.slide'. If matching elements are found,
   * every slide will be extracted into a separate slide in the presentation.
   */
  slideSelector?: string;

  /**
   * Timeout in milliseconds for rendering/waiting.
   * Defaults to 30000ms (30s).
   */
  timeout?: number;

  /**
   * Wait until specific condition before harvesting DOM.
   * 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
   */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';

  /**
   * Optional pre-existing Puppeteer browser instance.
   * If supplied, html-native-pptx will reuse it rather than launching a new Chromium process.
   */
  browser?: Browser;

  /**
   * Optional WebSocket endpoint to connect to a remote Chromium (e.g. Browserless.io).
   */
  browserWSEndpoint?: string;

  /**
   * Optional list of custom fonts to embed into the PowerPoint presentation.
   */
  fonts?: EmbeddedFontOption[];

  /**
   * Whether to automatically detect @font-face rules in HTML/CSS and embed them.
   * Defaults to true.
   */
  autoEmbedFonts?: boolean;

  /**
   * Base directory path used to resolve relative font paths and asset URLs.
   * Defaults to process.cwd().
   */
  basePath?: string;

  /**
   * Text autofit behavior in PowerPoint.
   * 'none' (default) generates <a:noAutofit/>
   * 'shape' generates <a:spAutoFit/>
   * 'text' generates <a:normAutofit/>
   */
  autofit?: 'none' | 'shape' | 'text';
}
