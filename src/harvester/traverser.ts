import type { IRNode, SlideIR, TextRun, ParagraphIR, TextAlign, ShapeStyle, TableIR, TableRowIR, TableCellIR, GradientFill, GradientStop } from '../types/ir.js';

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

  const nodes: IRNode[] = [];
  let nodeIdCounter = 1;

  function parseColor(
    cssColor?: string
  ): { hex: string; alpha?: number } | undefined {
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
      const hex = ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1)
        .toUpperCase();
      return { hex, alpha: a < 1 ? a : undefined };
    }

    // Parse #hex
    if (trimmed.startsWith('#')) {
      const raw = trimmed.slice(1);
      if (raw.length === 3) {
        return { hex: raw.split('').map((c) => c + c).join('').toUpperCase() };
      }
      if (raw.length >= 6) {
        return { hex: raw.slice(0, 6).toUpperCase() };
      }
    }

    return undefined;
  }

  function toHex(cssColor?: string): string | undefined {
    return parseColor(cssColor)?.hex;
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
    return [
      'SPAN',
      'B',
      'STRONG',
      'I',
      'EM',
      'U',
      'S',
      'A',
      'CODE',
      'MARK',
      'SMALL',
      'BR',
      'SUB',
      'SUP',
      'ABBR',
      'CITE',
      'TIME',
    ].includes(tagName);
  }

  function isTextBlockTag(tagName: string): boolean {
    return [
      'P',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'LI',
      'BLOCKQUOTE',
      'TEXT',
      'TSPAN',
    ].includes(tagName);
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

  // Ukuran font HARUS memakai skala yang sama dengan geometri.
  //
  // Kotak dinormalkan terhadap lebar root (`rect.width / rootW * SLIDE_W`),
  // sedangkan font sebelumnya dikonversi px->pt pada 96 DPI tetap. Pada viewport
  // 1863 px yang dipetakan ke slide 13,333 inci, kotaknya mengecil sekitar 1,46x
  // sementara teksnya tidak -- sehingga setiap teks jadi 1,46x terlalu besar
  // untuk kotaknya sendiri, membungkus ke baris baru, meluber, dan saling
  // menabrak. Itu penyebab utama hasil pptx terlihat jauh berbeda dari HTML-nya.
  //
  // Dipakai skala LEBAR, bukan tinggi: pemenggalan baris ditentukan lebar, dan
  // itu yang paling menentukan apakah tata letaknya masih menyerupai aslinya.
  const PX_TO_PT = (SLIDE_W / rootW) * 72;

  /**
   * Lingkaran dan cincin yang digambar sebagai `radial-gradient`.
   *
   * Pola `radial-gradient(circle at X% Y%, warna 0 Rpx, transparan R+2px)`
   * adalah cara paling lazim menggambar lingkaran lewat latar CSS -- bukan
   * gradasi sungguhan, melainkan satu warna pekat dengan batas tegas. Traverser
   * hanya membaca `backgroundColor`, jadi seluruh bentuk semacam ini hilang
   * tanpa jejak; pada dek uji, lingkaran kuning besar beserta cincin oranyenya
   * lenyap seluruhnya dari hasil.
   *
   * Yang dihasilkan di sini bentuk native, bukan gambar: pengguna tetap bisa
   * menggeser dan mewarnainya di PowerPoint.
   */
  function splitTopLevel(input: string, sep: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of input) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === sep && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  interface GradientCircle {
    cxPct: number;
    cyPct: number;
    radiusPx: number;
    color: string;
    opacity: number;
    strokePx?: number;
  }

  function parseRadialCircles(backgroundImage: string): GradientCircle[] {
    if (!backgroundImage || backgroundImage === 'none') return [];
    const out: GradientCircle[] = [];

    for (const layer of splitTopLevel(backgroundImage, ',')) {
      const m = layer.trim().match(/^radial-gradient\((.*)\)$/s);
      if (!m) continue;
      const inner = m[1];
      const parts = splitTopLevel(inner, ',');
      if (parts.length < 2) continue;

      const head = parts[0].trim();
      const posMatch = head.match(/circle\s+at\s+([\d.]+)%\s+([\d.]+)%/);
      if (!posMatch) continue;
      const cxPct = parseFloat(posMatch[1]);
      const cyPct = parseFloat(posMatch[2]);

      // Chrome memecah sintaks dua-posisi menjadi perhentian berposisi tunggal:
      //   `var(--sun) 0 200px`  ->  `rgb(...) 0px, rgb(...) 200px`
      // jadi bentuknya dibaca apa adanya, bukan seperti yang ditulis penulis CSS.
      const stops = parts.slice(1).map((raw) => {
        const t = raw.trim();
        const colorMatch = t.match(/^(rgba?\([^)]*\)|#[0-9a-fA-F]+|[a-zA-Z]+)/);
        const color = colorMatch ? colorMatch[1] : '';
        const posMatches = t.slice(color.length).match(/-?[\d.]+px/g) || [];
        const parsed = parseColor(color);
        // `alpha` boleh tidak ada pada warna pekat; anggap 1 supaya perhentian
        // berwarna tidak salah dikira transparan.
        const alpha = parsed ? (parsed.alpha === undefined ? 1 : parsed.alpha) : 0;
        return {
          pos: posMatches.length ? parseFloat(posMatches[0] as string) : null,
          alpha,
          hex: parsed ? parsed.hex : '',
        };
      });

      // Deretan perhentian yang tidak transparan membentuk satu bidang warna.
      // Yang dimulai dari radius 0 adalah cakram; yang dimulai di tengah adalah
      // cincin, dengan tebal garis sebesar lebar deretan itu.
      let i = 0;
      while (i < stops.length) {
        if (stops[i].alpha <= 0 || stops[i].pos === null) {
          i++;
          continue;
        }
        const mulai = stops[i].pos as number;
        const warna = stops[i].hex;
        const alpha = stops[i].alpha;
        let j = i;
        while (j + 1 < stops.length && stops[j + 1].alpha > 0 && stops[j + 1].pos !== null) {
          j++;
        }
        const selesai = stops[j].pos as number;

        if (mulai <= 0.5 && selesai > 0) {
          out.push({ cxPct, cyPct, radiusPx: selesai, color: warna, opacity: alpha });
        } else if (selesai > mulai) {
          out.push({
            cxPct,
            cyPct,
            radiusPx: (mulai + selesai) / 2,
            color: warna,
            opacity: alpha,
            strokePx: selesai - mulai,
          });
        }
        i = j + 1;
      }
    }
    return out;
  }

  function parseLinearGradient(bg?: string): GradientFill | undefined {
    if (!bg || bg === 'none') return undefined;
    for (const part of splitTopLevel(bg, ',')) {
      const m = part.trim().match(/^linear-gradient\((.*)\)$/is);
      if (!m) continue;
      const inner = m[1];
      const args = splitTopLevel(inner, ',');
      if (args.length < 2) continue;

      let angle = 180; // default top to bottom in CSS
      let startIndex = 0;

      const firstArg = args[0].trim().toLowerCase();
      if (firstArg.includes('deg')) {
        angle = parseFloat(firstArg) || 180;
        startIndex = 1;
      } else if (firstArg.startsWith('to ')) {
        const dir = firstArg.replace('to ', '').trim();
        if (dir === 'top') angle = 0;
        else if (dir === 'right') angle = 90;
        else if (dir === 'bottom') angle = 180;
        else if (dir === 'left') angle = 270;
        else if (dir === 'top right' || dir === 'right top') angle = 45;
        else if (dir === 'bottom right' || dir === 'right bottom') angle = 135;
        else if (dir === 'bottom left' || dir === 'left bottom') angle = 225;
        else if (dir === 'top left' || dir === 'left top') angle = 315;
        startIndex = 1;
      }

      const stopArgs = args.slice(startIndex);
      const stops: GradientStop[] = [];

      stopArgs.forEach((raw, idx) => {
        const t = raw.trim();
        const colorMatch = t.match(/^(rgba?\([^)]*\)|#[0-9a-fA-F]+|[a-zA-Z]+)/);
        if (!colorMatch) return;
        const colorStr = colorMatch[1];
        const rest = t.slice(colorStr.length).trim();
        const parsed = parseColor(colorStr);
        if (!parsed) return;

        let pos = idx / Math.max(1, stopArgs.length - 1);
        const pctMatch = rest.match(/([\d.]+)%/);
        if (pctMatch) {
          pos = parseFloat(pctMatch[1]) / 100;
        }

        stops.push({
          position: Math.max(0, Math.min(1, pos)),
          color: parsed.hex,
          opacity: parsed.alpha,
        });
      });

      if (stops.length > 0) {
        return {
          type: 'linear',
          angle,
          stops,
        };
      }
    }
    return undefined;
  }


  // Extract paragraphs and text runs from a text block
  function collectParagraphs(
    parentEl: HTMLElement,
    defaultAlign: TextAlign
  ): ParagraphIR[] {
    const rawParagraphs: TextRun[][] = [];
    let currentRuns: TextRun[] = [];

    function pushParagraph() {
      if (currentRuns.length > 0) {
        rawParagraphs.push(currentRuns);
        currentRuns = [];
      }
    }

    function traverseNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text && text.length > 0) {
          const parent = node.parentElement || parentEl;
          const style = window.getComputedStyle(parent);
          const isSvgParent =
            parent instanceof SVGElement ||
            parent.namespaceURI === 'http://www.w3.org/2000/svg';
          const fillVal = isSvgParent
            ? style.fill || parent.getAttribute('fill')
            : undefined;
          const fillHex =
            fillVal && fillVal !== 'none' ? toHex(fillVal) : undefined;
          const textColor = fillHex || toHex(style.color) || '000000';

          // Normalize sequences of whitespace to a single space
          const normalized = text.replace(/[\r\n\t ]+/g, ' ');
          if (normalized.length > 0) {
            currentRuns.push({
              content: normalized,
              fontFamily: cleanFontFamily(style.fontFamily),
              fontSize: parseFloat(style.fontSize) * PX_TO_PT,
              color: textColor,
              bold: isBold(style.fontWeight),
              italic: style.fontStyle === 'italic' || style.fontStyle === 'oblique',
              underline: style.textDecorationLine?.includes('underline'),
              strikethrough: style.textDecorationLine?.includes('line-through'),
              letterSpacing:
                style.letterSpacing && style.letterSpacing !== 'normal'
                  ? parseFloat(style.letterSpacing) * PX_TO_PT
                  : undefined,
            });
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toUpperCase();
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;

        // <br> starts a new paragraph
        if (tagName === 'BR') {
          pushParagraph();
          return;
        }

        // Block elements start a new paragraph
        const isBlock =
          isTextBlockTag(tagName) ||
          style.display === 'block' ||
          style.display === 'flex' ||
          style.display === 'grid';

        if (isBlock) {
          pushParagraph();
          Array.from(node.childNodes).forEach(traverseNodes);
          pushParagraph();
        } else {
          Array.from(node.childNodes).forEach(traverseNodes);
        }
      }
    }

    Array.from(parentEl.childNodes).forEach(traverseNodes);
    pushParagraph();

    // Normalize whitespace per paragraph:
    // - Trim leading whitespace on the first non-empty run
    // - Trim trailing whitespace on the last non-empty run
    // - Filter out runs that became empty
    const normalizedParagraphs: ParagraphIR[] = [];

    for (const runs of rawParagraphs) {
      for (let i = 0; i < runs.length; i++) {
        runs[i].content = runs[i].content.replace(/^\s+/, '');
        if (runs[i].content.length > 0) {
          break;
        }
      }

      for (let i = runs.length - 1; i >= 0; i--) {
        runs[i].content = runs[i].content.replace(/\s+$/, '');
        if (runs[i].content.length > 0) {
          break;
        }
      }

      const cleanRuns = runs.filter((r) => r.content.length > 0);
      if (cleanRuns.length > 0) {
        normalizedParagraphs.push({
          align: defaultAlign,
          runs: cleanRuns,
        });
      }
    }

    return normalizedParagraphs;
  }

  function collectTextRuns(parentEl: HTMLElement): TextRun[] {
    const paras = collectParagraphs(parentEl, 'left');
    return paras.flatMap((p) => p.runs);
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

    const tagName = el.tagName.toUpperCase();
    const isSvg =
      el instanceof SVGElement ||
      el.namespaceURI === 'http://www.w3.org/2000/svg';

    if (
      isSvg &&
      ['DEFS', 'STYLE', 'FILTER', 'MASK', 'CLIPPATH'].includes(tagName)
    ) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const isZeroLengthLine =
      tagName === 'LINE' && rect.width === 0 && rect.height === 0;
    if (
      isZeroLengthLine ||
      (tagName !== 'LINE' && (rect.width === 0 || rect.height === 0))
    ) {
      return;
    }

    // Normalisasi koordinat ke Inches relatif terhadap root container
    const box = {
      x: ((rect.left - rootRect.left) / rootW) * SLIDE_W,
      y: ((rect.top - rootRect.top) / rootH) * SLIDE_H,
      w: (rect.width / rootW) * SLIDE_W,
      h: (rect.height / rootH) * SLIDE_H,
    };

    const zIndex =
      style.zIndex === 'auto' || !style.zIndex ? 0 : parseInt(style.zIndex, 10) || 0;

    // Native Table handling (<table>)
    if (tagName === 'TABLE') {
      const trElements = Array.from(el.querySelectorAll('tr'));
      if (trElements.length > 0) {
        const rows: TableRowIR[] = [];
        const colWidthsPx: number[] = [];

        for (const tr of trElements) {
          const trRect = tr.getBoundingClientRect();
          const rowHInches = (trRect.height / rootH) * SLIDE_H;
          const cellEls = Array.from(tr.querySelectorAll('th, td'));

          const cells: TableCellIR[] = cellEls.map((td, colIdx) => {
            const tdStyle = window.getComputedStyle(td);
            const tdRect = td.getBoundingClientRect();
            if (!colWidthsPx[colIdx] || tdRect.width > colWidthsPx[colIdx]) {
              colWidthsPx[colIdx] = tdRect.width;
            }

            const cellBg = parseColor(tdStyle.backgroundColor);
            const cellBorder = parseColor(tdStyle.borderColor || tdStyle.borderTopColor);
            const cellBorderW = parseFloat(tdStyle.borderTopWidth) || 0;

            const tdTextAlign = tdStyle.textAlign as TextAlign;
            const tdAlign: TextAlign = ['left', 'center', 'right', 'justify'].includes(tdTextAlign) ? tdTextAlign : 'left';

            const tdVAlign = tdStyle.verticalAlign;
            let vAlign: 'top' | 'middle' | 'bottom' = 'middle';
            if (tdVAlign === 'top') vAlign = 'top';
            else if (tdVAlign === 'bottom') vAlign = 'bottom';

            const textContent = td.textContent?.trim() || '';
            const isTh = td.tagName.toUpperCase() === 'TH';
            const cellFontFamily = cleanFontFamily(tdStyle.fontFamily);
            const cellFontSize = (parseFloat(tdStyle.fontSize) || 14) * PX_TO_PT;
            const cellTextColor = toHex(tdStyle.color) || '000000';
            const cellBold = isTh || isBold(tdStyle.fontWeight);

            const paragraphs: ParagraphIR[] = textContent ? [
              {
                align: tdAlign,
                runs: [
                  {
                    content: textContent,
                    fontFamily: cellFontFamily,
                    fontSize: cellFontSize,
                    color: cellTextColor,
                    bold: cellBold,
                    italic: tdStyle.fontStyle === 'italic',
                  }
                ]
              }
            ] : [];

            return {
              content: textContent,
              paragraphs,
              fillColor: cellBg?.hex,
              fillOpacity: cellBg?.alpha,
              borderColor: cellBorder?.hex,
              borderWidth: cellBorderW * PX_TO_PT,
              align: tdAlign,
              verticalAlign: vAlign,
              colSpan: parseInt(td.getAttribute('colspan') || '1', 10) || 1,
              rowSpan: parseInt(td.getAttribute('rowspan') || '1', 10) || 1,
            };
          });

          rows.push({
            height: Math.max(0.2, rowHInches),
            cells,
          });
        }

        const totalColWidthPx = colWidthsPx.reduce((a, b) => a + (b || 1), 0) || 1;
        const columns = colWidthsPx.map((wPx) => ({
          width: ((wPx || 1) / totalColWidthPx) * box.w,
        }));

        nodes.push({
          id: nodeIdCounter++,
          name: `table-${nodeIdCounter}`,
          type: 'table',
          box,
          zIndex,
          table: {
            columns,
            rows,
          },
        });
        return;
      }
    }


    const bgParsed = parseColor(style.backgroundColor);
    const gradientParsed = parseLinearGradient(
      style.backgroundImage || (style as any).background
    );
    const hasBg = !!bgParsed || !!gradientParsed;

    // Read borders per side
    const btW = parseFloat(style.borderTopWidth) || 0;
    const brW = parseFloat(style.borderRightWidth) || 0;
    const bbW = parseFloat(style.borderBottomWidth) || 0;
    const blW = parseFloat(style.borderLeftWidth) || 0;

    const btColor = style.borderTopStyle !== 'none' && btW > 0 ? toHex(style.borderTopColor) : undefined;
    const brColor = style.borderRightStyle !== 'none' && brW > 0 ? toHex(style.borderRightColor) : undefined;
    const bbColor = style.borderBottomStyle !== 'none' && bbW > 0 ? toHex(style.borderBottomColor) : undefined;
    const blColor = style.borderLeftStyle !== 'none' && blW > 0 ? toHex(style.borderLeftColor) : undefined;

    const hasTop = btW > 0 && !!btColor;
    const hasRight = brW > 0 && !!brColor;
    const hasBottom = bbW > 0 && !!bbColor;
    const hasLeft = blW > 0 && !!blColor;

    const allBordersEqual =
      hasTop &&
      hasRight &&
      hasBottom &&
      hasLeft &&
      btW === brW &&
      brW === bbW &&
      bbW === blW &&
      btColor === brColor &&
      brColor === bbColor &&
      bbColor === blColor;

    // Radius parsing (support percentage e.g. 50%)
    let radiusPx = 0;
    const rawRadius =
      el.style.borderRadius && el.style.borderRadius.includes('%')
        ? el.style.borderRadius
        : style.borderRadius;
    if (rawRadius && rawRadius.includes('%')) {
      const pct = parseFloat(rawRadius);
      if (!isNaN(pct)) {
        radiusPx = (pct / 100) * Math.min(rect.width, rect.height);
      }
    } else {
      radiusPx = parseFloat(style.borderRadius) || parseFloat(el.style.borderRadius) || 0;
    }

    // SVG Shape handling (rect, circle, ellipse, line, path, polygon, polyline)
    if (isSvg) {
      if (tagName === 'RECT') {
        const fillRaw = style.fill || el.getAttribute('fill');
        const strokeRaw = style.stroke || el.getAttribute('stroke');
        const strokeWidthRaw =
          parseFloat(style.strokeWidth) ||
          parseFloat(el.getAttribute('stroke-width') || '0') ||
          0;

        const fillParsed =
          fillRaw && fillRaw !== 'none' ? parseColor(fillRaw) : undefined;
        const strokeParsed =
          strokeRaw && strokeRaw !== 'none' && strokeWidthRaw > 0
            ? parseColor(strokeRaw)
            : undefined;

        const rxAttr = parseFloat(el.getAttribute('rx') || '0') || 0;
        const wAttr = parseFloat(el.getAttribute('width') || '1') || 1;
        const radiusPx = rxAttr > 0 ? (rxAttr / wAttr) * rect.width : 0;

        let shadowObj: ShapeStyle['shadow'] = undefined;
        const filterAttr = el.getAttribute('filter');
        if (filterAttr) {
          const match = filterAttr.match(/url\(#([^)]+)\)/);
          if (match) {
            const filterEl = el.ownerDocument.getElementById(match[1]);
            if (filterEl) {
              const dropShadow = filterEl.querySelector('feDropShadow');
              if (dropShadow) {
                const dx = parseFloat(dropShadow.getAttribute('dx') || '0') || 0;
                const dy = parseFloat(dropShadow.getAttribute('dy') || '0') || 0;
                const stdDev =
                  parseFloat(dropShadow.getAttribute('stdDeviation') || '0') || 0;
                const floodColor =
                  dropShadow.getAttribute('flood-color') || '#000000';
                const floodOpacity = parseFloat(
                  dropShadow.getAttribute('flood-opacity') || '1'
                );
                const colorParsed = parseColor(floodColor);
                if (colorParsed) {
                  shadowObj = {
                    color: colorParsed.hex,
                    blur: stdDev * PX_TO_PT,
                    offsetX: dx * PX_TO_PT,
                    offsetY: dy * PX_TO_PT,
                    opacity: isNaN(floodOpacity) ? 1 : floodOpacity,
                  };
                }
              }
            }
          }
        }

        if (fillParsed || strokeParsed) {
          nodes.push({
            id: nodeIdCounter++,
            name: 'svg-rect',
            type: 'container',
            box,
            zIndex,
            shapeStyle: {
              fillColor: fillParsed?.hex,
              fillOpacity: fillParsed?.alpha,
              borderColor: strokeParsed?.hex,
              borderWidth: strokeParsed ? strokeWidthRaw * PX_TO_PT : 0,
              radius: radiusPx,
              shadow: shadowObj,
            },
          });
        }
        return;
      }

      if (tagName === 'CIRCLE' || tagName === 'ELLIPSE') {
        const fillRaw = style.fill || el.getAttribute('fill');
        const strokeRaw = style.stroke || el.getAttribute('stroke');
        const strokeWidthRaw =
          parseFloat(style.strokeWidth) ||
          parseFloat(el.getAttribute('stroke-width') || '0') ||
          0;

        const fillParsed =
          fillRaw && fillRaw !== 'none' ? parseColor(fillRaw) : undefined;
        const strokeParsed =
          strokeRaw && strokeRaw !== 'none' && strokeWidthRaw > 0
            ? parseColor(strokeRaw)
            : undefined;

        if (fillParsed || strokeParsed) {
          nodes.push({
            id: nodeIdCounter++,
            name: 'svg-circle',
            type: 'container',
            box,
            zIndex,
            shapeStyle: {
              geometry: 'ellipse',
              fillColor: fillParsed?.hex,
              fillOpacity: fillParsed?.alpha,
              borderColor: strokeParsed?.hex,
              borderWidth: strokeParsed ? strokeWidthRaw * PX_TO_PT : 0,
              radius: Math.min(rect.width, rect.height) / 2,
            },
          });
        }
        return;
      }

      if (tagName === 'LINE') {
        const strokeRaw =
          style.stroke || el.getAttribute('stroke') || '#000000';
        const strokeWidthRaw =
          parseFloat(style.strokeWidth) ||
          parseFloat(el.getAttribute('stroke-width') || '1') ||
          1;
        const strokeParsed =
          strokeRaw && strokeRaw !== 'none' ? parseColor(strokeRaw) : undefined;

        const x1 = parseFloat(el.getAttribute('x1') || '0');
        const y1 = parseFloat(el.getAttribute('y1') || '0');
        const x2 = parseFloat(el.getAttribute('x2') || '0');
        const y2 = parseFloat(el.getAttribute('y2') || '0');

        const isFlippedV =
          (y2 < y1 && x2 >= x1) || (y1 < y2 && x1 >= x2);

        if (strokeParsed) {
          nodes.push({
            id: nodeIdCounter++,
            name: 'svg-line',
            type: 'container',
            box: {
              x: box.x,
              y: box.y,
              w: box.w,
              h: box.h,
            },
            zIndex,
            shapeStyle: {
              geometry: 'line',
              flipV: isFlippedV,
              borderColor: strokeParsed.hex,
              borderWidth: strokeWidthRaw * PX_TO_PT,
            },
          });
        }
        return;
      }

      if (tagName === 'PATH') {
        const d = el.getAttribute('d');
        const fillRaw = style.fill || el.getAttribute('fill');
        const strokeRaw = style.stroke || el.getAttribute('stroke');
        const strokeWidthRaw =
          parseFloat(style.strokeWidth) ||
          parseFloat(el.getAttribute('stroke-width') || '0') ||
          0;

        const fillParsed =
          fillRaw && fillRaw !== 'none' ? parseColor(fillRaw) : undefined;
        const strokeParsed =
          strokeRaw && strokeRaw !== 'none' && strokeWidthRaw > 0
            ? parseColor(strokeRaw)
            : undefined;

        if (d && d.trim().length > 0 && (fillParsed || strokeParsed)) {
          const svgRoot = el.closest('svg');
          let vbW = 100;
          let vbH = 100;
          if (svgRoot) {
            const vbAttr = svgRoot.getAttribute('viewBox');
            if (vbAttr) {
              const vbParts = vbAttr.trim().split(/[\s,]+/);
              if (vbParts.length >= 4) {
                vbW = parseFloat(vbParts[2]) || 100;
                vbH = parseFloat(vbParts[3]) || 100;
              }
            } else {
              vbW = parseFloat(svgRoot.getAttribute('width') || '100') || 100;
              vbH = parseFloat(svgRoot.getAttribute('height') || '100') || 100;
            }
          }

          nodes.push({
            id: nodeIdCounter++,
            name: 'svg-path',
            type: 'container',
            box,
            zIndex,
            shapeStyle: {
              customPath: d,
              pathViewBox: { w: vbW, h: vbH },
              fillColor: fillParsed?.hex,
              fillOpacity: fillParsed?.alpha,
              borderColor: strokeParsed?.hex,
              borderWidth: strokeParsed ? strokeWidthRaw * PX_TO_PT : 0,
            },
          });
          return;
        }
      }

      if (
        tagName === 'POLYGON' ||
        tagName === 'POLYLINE'
      ) {
        const fillRaw = style.fill || el.getAttribute('fill');
        const strokeRaw = style.stroke || el.getAttribute('stroke');
        const strokeWidthRaw =
          parseFloat(style.strokeWidth) ||
          parseFloat(el.getAttribute('stroke-width') || '0') ||
          0;

        const fillParsed =
          fillRaw && fillRaw !== 'none' ? parseColor(fillRaw) : undefined;
        const strokeParsed =
          strokeRaw && strokeRaw !== 'none' && strokeWidthRaw > 0
            ? parseColor(strokeRaw)
            : undefined;

        if (fillParsed || strokeParsed) {
          nodes.push({
            id: nodeIdCounter++,
            name: `svg-${tagName.toLowerCase()}`,
            type: 'container',
            box,
            zIndex,
            shapeStyle: {
              fillColor: fillParsed?.hex,
              fillOpacity: fillParsed?.alpha,
              borderColor: strokeParsed?.hex,
              borderWidth: strokeParsed ? strokeWidthRaw * PX_TO_PT : 0,
            },
          });
        }
        return;
      }
    }

    // Lingkaran/cincin yang digambar lewat radial-gradient pada latar elemen.
    // Dikeluarkan sebelum kotaknya sendiri supaya tergambar di atasnya, sama
    // seperti urutan lapisan latar di CSS.
    for (const c of parseRadialCircles(style.backgroundImage)) {
      const cxPx = (c.cxPct / 100) * rect.width;
      const cyPx = (c.cyPct / 100) * rect.height;
      const originX = rect.left - rootRect.left;
      const originY = rect.top - rootRect.top;
      const circleBox = {
        x: ((originX + cxPx - c.radiusPx) / rootW) * SLIDE_W,
        y: ((originY + cyPx - c.radiusPx) / rootH) * SLIDE_H,
        w: ((c.radiusPx * 2) / rootW) * SLIDE_W,
        h: ((c.radiusPx * 2) / rootH) * SLIDE_H,
      };
      if (circleBox.w <= 0 || circleBox.h <= 0) continue;

      nodes.push({
        id: nodeIdCounter++,
        name: c.strokePx ? 'gradient-ring' : 'gradient-circle',
        type: 'container',
        box: circleBox,
        zIndex,
        shapeStyle: c.strokePx
          ? {
              // Cincin: tanpa isian, hanya garis setebal pita warnanya.
              borderColor: c.color,
              borderWidth: c.strokePx * PX_TO_PT,
              radius: Math.min(circleBox.w, circleBox.h) * DPI / 2,
            }
          : {
              fillColor: c.color,
              fillOpacity: c.opacity < 1 ? c.opacity : undefined,
              borderWidth: 0,
              radius: Math.min(circleBox.w, circleBox.h) * DPI / 2,
            },
      });
    }

    // 1. Jika elemen memiliki visual background atau 4 border yang sama
    if (hasBg || allBordersEqual) {
      let boxHtmlShadow: ShapeStyle['shadow'] = undefined;
      if (style.boxShadow && style.boxShadow !== 'none') {
        const m = style.boxShadow.match(
          /(rgba?\([^)]+\)|#[0-9a-fA-F]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/
        );
        if (m) {
          const c = parseColor(m[1]);
          if (c) {
            boxHtmlShadow = {
              color: c.hex,
              offsetX: parseFloat(m[2]) * PX_TO_PT,
              offsetY: parseFloat(m[3]) * PX_TO_PT,
              blur: parseFloat(m[4]) * PX_TO_PT,
              opacity: c.alpha,
            };
          }
        } else {
          const m2 = style.boxShadow.match(
            /(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+)/
          );
          if (m2) {
            const c = parseColor(m2[4]);
            if (c) {
              boxHtmlShadow = {
                color: c.hex,
                offsetX: parseFloat(m2[1]) * PX_TO_PT,
                offsetY: parseFloat(m2[2]) * PX_TO_PT,
                blur: parseFloat(m2[3]) * PX_TO_PT,
                opacity: c.alpha,
              };
            }
          }
        }
      }

      nodes.push({
        id: nodeIdCounter++,
        name: `${el.tagName.toLowerCase()}-box`,
        type: 'container',
        box,
        zIndex,
        shapeStyle: {
          fillColor: bgParsed ? bgParsed.hex : undefined,
          fillOpacity: bgParsed?.alpha,
          gradient: gradientParsed,
          borderColor: allBordersEqual ? btColor : undefined,
          borderWidth: allBordersEqual ? btW * PX_TO_PT : 0,
          radius: radiusPx,
          shadow: boxHtmlShadow,
        },
      });
    }

    // Jika border hanya ada di sebagian sisi (atau berbeda-beda), hasilkan strip container per sisi
    if (!allBordersEqual && (hasTop || hasRight || hasBottom || hasLeft)) {
      if (hasTop && btColor) {
        const hTop = (btW / rootH) * SLIDE_H;
        nodes.push({
          id: nodeIdCounter++,
          name: `${el.tagName.toLowerCase()}-border-top`,
          type: 'container',
          box: { x: box.x, y: box.y, w: box.w, h: hTop },
          zIndex,
          shapeStyle: {
            fillColor: btColor,
            borderWidth: 0,
          },
        });
      }
      if (hasBottom && bbColor) {
        const hBottom = (bbW / rootH) * SLIDE_H;
        nodes.push({
          id: nodeIdCounter++,
          name: `${el.tagName.toLowerCase()}-border-bottom`,
          type: 'container',
          box: { x: box.x, y: box.y + box.h - hBottom, w: box.w, h: hBottom },
          zIndex,
          shapeStyle: {
            fillColor: bbColor,
            borderWidth: 0,
          },
        });
      }
      if (hasLeft && blColor) {
        const wLeft = (blW / rootW) * SLIDE_W;
        nodes.push({
          id: nodeIdCounter++,
          name: `${el.tagName.toLowerCase()}-border-left`,
          type: 'container',
          box: { x: box.x, y: box.y, w: wLeft, h: box.h },
          zIndex,
          shapeStyle: {
            fillColor: blColor,
            borderWidth: 0,
          },
        });
      }
      if (hasRight && brColor) {
        const wRight = (brW / rootW) * SLIDE_W;
        nodes.push({
          id: nodeIdCounter++,
          name: `${el.tagName.toLowerCase()}-border-right`,
          type: 'container',
          box: { x: box.x + box.w - wRight, y: box.y, w: wRight, h: box.h },
          zIndex,
          shapeStyle: {
            fillColor: brColor,
            borderWidth: 0,
          },
        });
      }
    }

    // 2. Jika elemen adalah Image <img>
    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      let imgSrc = img.getAttribute('src') || img.src;

      // Filter CSS dipanggang ke dalam pikselnya.
      //
      // PowerPoint tidak punya padanan `filter`, jadi berkas gambar mentahlah
      // yang ditempel. Logo yang di HTML dihitamkan oleh
      // `filter: grayscale(100%) brightness(0)` sebenarnya berkas PNG putih
      // polos; tanpa dipanggang, hasilnya putih di atas latar terang -- ada di
      // dalam berkas tapi tidak terlihat sama sekali, dan itu terbaca sebagai
      // "logonya hilang".
      const cssFilter = style.filter;
      if (imgSrc && cssFilter && cssFilter !== 'none') {
        try {
          const w = img.naturalWidth || Math.round(rect.width);
          const h = img.naturalHeight || Math.round(rect.height);
          if (w > 0 && h > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              (ctx as any).filter = cssFilter;
              ctx.drawImage(img, 0, 0, w, h);
              imgSrc = canvas.toDataURL('image/png');
            }
          }
        } catch {
          // Kanvas ternoda (gambar lintas-asal) atau filter tidak didukung:
          // pakai berkas aslinya, lebih baik warnanya meleset daripada hilang.
        }
      }

      if (imgSrc) {
        nodes.push({
          id: nodeIdCounter++,
          name: img.getAttribute('alt') || 'image',
          type: 'image',
          box,
          zIndex,
          content: imgSrc,
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
      let textAlign: TextAlign = (style.textAlign as any) || 'left';
      if (isSvg) {
        const anchor =
          (style as any).textAnchor || el.getAttribute('text-anchor');
        if (anchor === 'middle') textAlign = 'center';
        else if (anchor === 'end') textAlign = 'right';
        else if (anchor === 'start') textAlign = 'left';
      }
      const paragraphs = collectParagraphs(el, textAlign);

      // Rasio, bukan piksel: OpenXML menyatakan jarak baris sebagai persentase
      // ukuran font, jadi nilainya tetap benar berapa pun skala slidenya.
      const fontPx = parseFloat(style.fontSize) || 0;
      const lhRaw = style.lineHeight;
      let lineRatio: number | undefined;
      if (lhRaw && lhRaw !== 'normal' && fontPx > 0) {
        const lhPx = parseFloat(lhRaw);
        if (!isNaN(lhPx) && lhPx > 0) {
          lineRatio = lhPx / fontPx;
        }
      }

      if (paragraphs.length > 0) {
        const primaryRun = paragraphs[0].runs[0];
        const content = paragraphs
          .map((p) => p.runs.map((r) => r.content).join(''))
          .join('\n');

        // Item 7: Before returning, inspect inline children with background or border
        const extractInlineHighlights = (parent: HTMLElement) => {
          Array.from(parent.children).forEach((child) => {
            const childEl = child as HTMLElement;
            const childStyle = window.getComputedStyle(childEl);
            if (childStyle.display === 'none' || childStyle.visibility === 'hidden') return;

            const childBg = parseColor(childStyle.backgroundColor);
            const childBw = parseFloat(childStyle.borderWidth) || 0;
            const childBc =
              childStyle.borderStyle !== 'none' && childBw > 0
                ? toHex(childStyle.borderColor)
                : undefined;

            if (childBg || (childBw > 0 && childBc)) {
              const childRect = childEl.getBoundingClientRect();
              if (childRect.width > 0 && childRect.height > 0) {
                const childBox = {
                  x: ((childRect.left - rootRect.left) / rootW) * SLIDE_W,
                  y: ((childRect.top - rootRect.top) / rootH) * SLIDE_H,
                  w: (childRect.width / rootW) * SLIDE_W,
                  h: (childRect.height / rootH) * SLIDE_H,
                };

                let childRadius = 0;
                const rawRadius =
                  childEl.style.borderRadius && childEl.style.borderRadius.includes('%')
                    ? childEl.style.borderRadius
                    : childStyle.borderRadius;
                if (rawRadius && rawRadius.includes('%')) {
                  const pct = parseFloat(rawRadius);
                  if (!isNaN(pct)) {
                    childRadius = (pct / 100) * Math.min(childRect.width, childRect.height);
                  }
                } else {
                  childRadius = parseFloat(rawRadius) || 0;
                }

                nodes.push({
                  id: nodeIdCounter++,
                  name: `${childEl.tagName.toLowerCase()}-highlight`,
                  type: 'container',
                  box: childBox,
                  zIndex: zIndex - 0.1, // Behind the text shape
                  shapeStyle: {
                    fillColor: childBg?.hex,
                    fillOpacity: childBg?.alpha,
                    borderColor: childBc,
                    borderWidth: childBc ? childBw * PX_TO_PT : 0,
                    radius: childRadius,
                  },
                });
              }
            }

            if (childEl.childElementCount > 0) {
              extractInlineHighlights(childEl);
            }
          });
        };

        extractInlineHighlights(el);

        // Apakah browser membungkus teks ini melebihi pemenggalan yang memang
        // ditulis penulisnya (<br> atau blok terpisah)?
        //
        // Diukur dari tinggi kotak dibagi tinggi baris, bukan dari
        // Range.getClientRects yang menghitung per potongan teks -- satu baris
        // berisi <b> di tengahnya sudah menghasilkan tiga rect dan salah dikira
        // tiga baris.
        //
        // Kalau tidak ada pembungkusan tambahan, pembungkusan dimatikan di
        // PowerPoint: kotak hasil panen persis selebar teksnya, jadi selisih
        // metrik sekecil apa pun akan memaksa baris baru yang tidak ada di HTML.
        const lineBoxPx = lineRatio && fontPx ? lineRatio * fontPx : fontPx * 1.2;
        const visualLines =
          lineBoxPx > 0 ? Math.round(rect.height / lineBoxPx) : paragraphs.length;
        // Dibatasi pada teks pendek. Paragraf panjang memang dimaksudkan
        // membungkus, dan mematikannya di sana membuat kalimat memanjang keluar
        // tepi slide -- lebih buruk daripada masalah yang sedang diperbaiki.
        // Yang benar-benar rawan adalah judul: kotaknya persis selebar teksnya.
        const noWrapped =
          visualLines <= paragraphs.length && content.replace(/\s+/g, ' ').length <= 60;

        nodes.push({
          id: nodeIdCounter++,
          name: `${el.tagName.toLowerCase()}-text`,
          type: 'text',
          box,
          zIndex,
          content,
          textStyle: {
            fontFamily: primaryRun.fontFamily || 'Arial',
            fontSize: primaryRun.fontSize || 16,
            color: primaryRun.color || '000000',
            bold: primaryRun.bold || false,
            italic: primaryRun.italic || false,
            underline: primaryRun.underline || false,
            align: textAlign,
          },
          noWrap: noWrapped || undefined,
          paragraphs: lineRatio
            ? paragraphs.map((p) => ({ ...p, lineHeight: lineRatio }))
            : paragraphs,
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
