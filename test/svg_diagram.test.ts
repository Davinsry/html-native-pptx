import { describe, it, expect } from 'vitest';
import { convertHtmlToPptx } from '../src/index.js';
import JSZip from 'jszip';

/**
 * A flowchart is the case where "roughly right" is wrong: a diamond drawn as a
 * rectangle, a connector without its arrowhead, or a rejection loop without its
 * dashes all change what the diagram MEANS. These assertions pin the four
 * things that were silently lost before.
 */
const html = `<!doctype html><html><body style="margin:0">
<div style="width:1280px;height:720px;position:relative;background:#ffffff">
  <svg viewBox="0 0 900 400" style="position:absolute;left:40px;top:40px;width:1200px;height:533px">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b"/>
      </marker>
    </defs>
    <rect x="20" y="40" width="180" height="100" rx="10" fill="#eef2f8" stroke="#cbd5e1" stroke-width="1.2"/>
    <path d="M 200 90 L 290 90" fill="none" stroke="#64748b" stroke-width="1.6" marker-end="url(#arrow)"/>
    <polygon points="380,25 470,90 380,155 290,90" fill="#e11428"/>
    <path d="M 380 155 L 380 230 L 110 230 L 110 145" fill="none" stroke="#e11428"
          stroke-width="1.6" stroke-dasharray="4,4" marker-end="url(#arrow)"/>
  </svg>
</div></body></html>`;

describe('SVG diagram shapes', () => {
  it('emits native editable shapes for polygon, connectors, arrowheads and dashes', async () => {
    const buf = await convertHtmlToPptx(html, { viewport: { width: 1280, height: 720 } });
    const xml = await (await JSZip.loadAsync(buf)).file('ppt/slides/slide1.xml')!.async('string');

    // The diamond must be a real diamond, not the rectangle a missing custom
    // path used to leave behind.
    expect(xml).toContain('name="svg-polygon"');

    // Both connectors survive. A horizontal path has zero bounding-box height,
    // which the zero-size guard used to treat as "nothing to draw".
    expect((xml.match(/name="svg-path"/g) || []).length).toBe(2);

    // Arrowhead and dash live on the line, so they stay editable in PowerPoint.
    expect(xml).toContain('<a:tailEnd type="triangle"');
    expect(xml).toContain('<a:prstDash val="dash"/>');

    // Nothing was rasterised or embedded as a picture.
    expect(xml).not.toContain('<p:pic>');
  }, 60000);
});
