import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IRNode } from '../types/ir.js';
import { inchesToEmu } from '../normalizer/units.js';

export interface LoadedImage {
  data: Buffer;
  extension: string;
  contentType: string;
}

export function compileImageShape(
  node: IRNode,
  shapeId: number,
  relId: string
): string {
  const x = inchesToEmu(node.box.x);
  const y = inchesToEmu(node.box.y);
  const cx = inchesToEmu(node.box.w);
  const cy = inchesToEmu(node.box.h);
  const name = node.name || `Picture ${shapeId}`;

  return `
    <p:pic>
      <p:nvPicPr>
        <p:cNvPr id="${shapeId}" name="${name}"/>
        <p:cNvPicPr>
          <a:picLocks noChangeAspect="1"/>
        </p:cNvPicPr>
        <p:nvPr/>
      </p:nvPicPr>
      <p:blipFill>
        <a:blip r:embed="${relId}"/>
        <a:stretch>
          <a:fillRect/>
        </a:stretch>
      </p:blipFill>
      <p:spPr>
        <a:xfrm>
          <a:off x="${x}" y="${y}"/>
          <a:ext cx="${cx}" cy="${cy}"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </p:spPr>
    </p:pic>`.trim();
}

/**
 * Loads image binary from data URI, web URL, or local file path.
 */
export async function loadImageData(
  src: string,
  basePath?: string
): Promise<LoadedImage | null> {
  if (!src || typeof src !== 'string' || src.trim().length === 0) {
    return null;
  }

  const trimmed = src.trim();

  // 1. Data URI (data:image/...;base64,...)
  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (match) {
      let ext = match[1].toLowerCase();
      if (ext === 'svg+xml') ext = 'svg';
      if (ext === 'jpg') ext = 'jpeg';
      const contentType = `image/${match[1]}`;
      const data = Buffer.from(match[2], 'base64');
      return { data, extension: ext, contentType };
    }
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx !== -1) {
      const data = Buffer.from(trimmed.slice(commaIdx + 1), 'base64');
      return { data, extension: 'png', contentType: 'image/png' };
    }
    return null;
  }

  // 2. HTTP / HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) {
        console.warn(`[html-native-pptx] Failed to fetch image from ${trimmed}: HTTP ${res.status}`);
        return null;
      }
      const data = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get('content-type') || 'image/png';
      let ext = 'png';
      if (ct.includes('jpeg') || ct.includes('jpg')) ext = 'jpeg';
      else if (ct.includes('gif')) ext = 'gif';
      else if (ct.includes('svg')) ext = 'svg';
      else if (ct.includes('webp')) ext = 'webp';
      return { data, extension: ext, contentType: ct };
    } catch (err) {
      console.warn(`[html-native-pptx] Network error fetching image ${trimmed}:`, err);
      return null;
    }
  }

  // 3. Local file path or file:// URI
  try {
    let cleanPath = trimmed;
    if (cleanPath.startsWith('file://')) {
      cleanPath = cleanPath.slice(7);
      if (process.platform === 'win32' && cleanPath.startsWith('/')) {
        cleanPath = cleanPath.slice(1);
      }
    }
    cleanPath = cleanPath.split('?')[0].split('#')[0];

    const candidates = [
      path.isAbsolute(cleanPath)
        ? cleanPath
        : path.resolve(basePath || process.cwd(), cleanPath),
      basePath ? path.resolve(basePath, path.basename(cleanPath)) : null,
      path.resolve(process.cwd(), cleanPath),
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const data = await fs.promises.readFile(p);
        const extName = path.extname(p).slice(1).toLowerCase() || 'png';
        const ext = extName === 'jpg' ? 'jpeg' : extName;
        return { data, extension: ext, contentType: `image/${ext === 'svg' ? 'svg+xml' : ext}` };
      }
    }
  } catch (err) {
    console.warn(`[html-native-pptx] Error reading local image file ${trimmed}:`, err);
  }

  return null;
}
