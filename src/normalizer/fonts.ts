import * as fs from 'node:fs';
import * as path from 'node:path';
import _ttf2eot from 'ttf2eot';
import type { EmbeddedFontIR } from '../types/ir.js';
import type { EmbeddedFontOption } from '../types/options.js';

// Resolve CJS/ESM interop for ttf2eot
const ttf2eot = (_ttf2eot as any).default || _ttf2eot;

/**
 * Normalizes a typeface name by stripping quotes and taking the primary family.
 */
export function cleanTypeface(name: string): string {
  if (!name) return '';
  const first = name.split(',')[0].trim();
  return first.replace(/^['"]+|['"]+$/g, '').trim();
}

/**
 * Checks if a buffer contains Microsoft Embedded OpenType (EOT) binary data.
 */
export function isEotBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 36) return false;
  // Offset 34: MagicNumber should be 0x504C ('LP')
  const magic = buf.readUInt16LE(34);
  return magic === 0x504c;
}

/**
 * Converts TrueType (TTF) or OpenType (OTF) font buffer into Microsoft EOT format.
 */
export function convertTtfToEot(buf: Buffer): Buffer {
  if (isEotBuffer(buf)) {
    return buf;
  }
  try {
    const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const result = ttf2eot(uint8);
    return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  } catch (err) {
    // If conversion fails, return original buffer as fallback
    return buf;
  }
}

/**
 * Loads font data from a buffer, data URI, web URL, or local file path.
 */
export async function loadFontBuffer(
  src: string | Buffer,
  basePath?: string
): Promise<Buffer | null> {
  if (Buffer.isBuffer(src)) {
    return src;
  }

  if (typeof src !== 'string' || src.trim().length === 0) {
    return null;
  }

  const trimmed = src.trim();

  // 1. Data URI (data:font/...;base64,...)
  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx !== -1) {
      return Buffer.from(trimmed.slice(commaIdx + 1), 'base64');
    }
    return null;
  }

  // 2. HTTP / HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch {
      return null;
    }
  }

  // 3. File path on disk
  try {
    // Strip URL query/hash if present (e.g. font.ttf?v=1.0#iefix)
    const cleanPath = trimmed.split('?')[0].split('#')[0];
    const candidatePaths = [
      path.isAbsolute(cleanPath)
        ? cleanPath
        : path.resolve(basePath || process.cwd(), cleanPath),
      basePath ? path.resolve(basePath, path.basename(cleanPath)) : null,
      path.resolve(process.cwd(), cleanPath),
    ].filter(Boolean) as string[];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return await fs.promises.readFile(p);
      }
    }
  } catch {
    // Failed to read file
  }

  return null;
}

/**
 * Extracts @font-face rules from raw HTML string or CSS text.
 */
export function extractFontFacesFromHtml(
  html: string
): Array<{ typeface: string; src: string }> {
  const results: Array<{ typeface: string; src: string }> = [];
  if (!html) return results;

  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi;
  let match: RegExpExecArray | null;

  while ((match = fontFaceRegex.exec(html)) !== null) {
    const block = match[1];
    const familyMatch = block.match(/font-family\s*:\s*['"]?([^'";\n\r]+)['"]?/i);
    const srcMatch = block.match(/src\s*:\s*[^;]*url\((['"]?)(.*?)\1\)/i);

    if (familyMatch && srcMatch) {
      const typeface = cleanTypeface(familyMatch[1]);
      const src = srcMatch[2].trim();
      if (typeface && src) {
        results.push({ typeface, src });
      }
    }
  }

  return results;
}

/**
 * Resolves, deduplicates, and converts font options and discovered @font-face rules into EmbeddedFontIR items.
 */
export async function resolveAndEmbedFonts(options: {
  html?: string;
  userFonts?: EmbeddedFontOption[];
  autoEmbedFonts?: boolean;
  basePath?: string;
  discoveredFonts?: Array<{ typeface: string; src: string }>;
}): Promise<EmbeddedFontIR[]> {
  const fontMap = new Map<string, EmbeddedFontOption>();

  // 1. If autoEmbedFonts is enabled (default true), harvest from HTML and discovered CSS rules
  if (options.autoEmbedFonts !== false) {
    if (options.html) {
      const fromHtml = extractFontFacesFromHtml(options.html);
      for (const item of fromHtml) {
        fontMap.set(item.typeface.toLowerCase(), item);
      }
    }

    if (options.discoveredFonts) {
      for (const item of options.discoveredFonts) {
        const cleaned = cleanTypeface(item.typeface);
        if (cleaned && item.src) {
          fontMap.set(cleaned.toLowerCase(), { typeface: cleaned, src: item.src });
        }
      }
    }
  }

  // 2. User-provided fonts have highest priority (override auto-discovered)
  if (options.userFonts) {
    for (const f of options.userFonts) {
      const cleaned = cleanTypeface(f.typeface);
      if (cleaned) {
        fontMap.set(cleaned.toLowerCase(), { typeface: cleaned, src: f.src });
      }
    }
  }

  const results: EmbeddedFontIR[] = [];

  for (const fontOpt of fontMap.values()) {
    try {
      const buf = await loadFontBuffer(fontOpt.src, options.basePath);
      if (!buf || buf.length === 0) continue;

      const fntData = convertTtfToEot(buf);
      results.push({
        typeface: fontOpt.typeface,
        fntData,
      });
    } catch {
      // Gracefully continue on font resolution error
    }
  }

  return results;
}
