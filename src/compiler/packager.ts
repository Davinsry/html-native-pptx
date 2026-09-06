import JSZip from 'jszip';
import type { SlideIR, PresentationIR, EmbeddedFontIR } from '../types/ir.js';
import { inchesToEmu } from '../normalizer/units.js';
import {
  ROOT_RELS_XML,
  SLIDE_LAYOUT_XML,
  SLIDE_LAYOUT_RELS_XML,
  SLIDE_MASTER_XML,
  SLIDE_MASTER_RELS_XML,
  THEME_XML,
  SLIDE_RELS_XML,
  createPresentationXml,
  createPresentationRelsXml,
  createContentTypesXml,
} from './templates.js';
import { compileContainerShape } from './shapes.js';
import { compileTextShape } from './texts.js';

export interface CompileOptions {
  fonts?: EmbeddedFontIR[];
}

/**
 * Compiles a single SlideIR, an array of SlideIRs, or a PresentationIR into a valid PowerPoint (.pptx) file Buffer using OpenXML and JSZip.
 */
export async function compileSlideToPptx(
  slideOrSlidesOrPres: SlideIR | SlideIR[] | PresentationIR,
  options?: CompileOptions
): Promise<Buffer> {
  let slides: SlideIR[];
  let irFonts: EmbeddedFontIR[] = [];

  if ('slides' in slideOrSlidesOrPres) {
    slides = slideOrSlidesOrPres.slides;
    irFonts = slideOrSlidesOrPres.fonts || [];
  } else if (Array.isArray(slideOrSlidesOrPres)) {
    slides = slideOrSlidesOrPres;
    irFonts = slides.flatMap((s) => s.fonts || []);
  } else {
    slides = [slideOrSlidesOrPres];
    irFonts = slideOrSlidesOrPres.fonts || [];
  }

  if (slides.length === 0) {
    throw new Error('Cannot compile empty presentation without slides.');
  }

  // Deduplicate embedded fonts by typeface
  const fontMap = new Map<string, EmbeddedFontIR>();
  for (const f of [...irFonts, ...(options?.fonts || [])]) {
    if (f && f.typeface && f.fntData) {
      fontMap.set(f.typeface.toLowerCase(), f);
    }
  }
  const fonts = Array.from(fontMap.values());
  const hasFonts = fonts.length > 0;

  const primarySlide = slides[0];
  const widthEmu = inchesToEmu(primarySlide.width);
  const heightEmu = inchesToEmu(primarySlide.height);
  const is16_9 = Math.abs(primarySlide.width / primarySlide.height - 16 / 9) < 0.1;
  const slideCount = slides.length;

  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file('[Content_Types].xml', createContentTypesXml(slideCount, hasFonts));

  // 2. _rels/.rels
  zip.folder('_rels')?.file('.rels', ROOT_RELS_XML);

  // 3. ppt/ presentation, theme, master, and layout
  const pptFolder = zip.folder('ppt');
  pptFolder?.file(
    'presentation.xml',
    createPresentationXml(widthEmu, heightEmu, is16_9, slideCount, fonts)
  );
  pptFolder
    ?.folder('_rels')
    ?.file('presentation.xml.rels', createPresentationRelsXml(slideCount, fonts));

  // Embedded fonts
  if (hasFonts) {
    const fontsFolder = pptFolder?.folder('fonts');
    fonts.forEach((font, idx) => {
      fontsFolder?.file(`font${idx + 1}.fntdata`, font.fntData);
    });
  }

  // Theme
  pptFolder?.folder('theme')?.file('theme1.xml', THEME_XML);

  // Slide Master
  const masterFolder = pptFolder?.folder('slideMasters');
  masterFolder?.file('slideMaster1.xml', SLIDE_MASTER_XML);
  masterFolder?.folder('_rels')?.file('slideMaster1.xml.rels', SLIDE_MASTER_RELS_XML);

  // Slide Layout
  const layoutFolder = pptFolder?.folder('slideLayouts');
  layoutFolder?.file('slideLayout1.xml', SLIDE_LAYOUT_XML);
  layoutFolder?.folder('_rels')?.file('slideLayout1.xml.rels', SLIDE_LAYOUT_RELS_XML);

  // 4. Slides
  const slidesFolder = pptFolder?.folder('slides');
  const slidesRelsFolder = slidesFolder?.folder('_rels');

  slides.forEach((slide, idx) => {
    let shapeIdCounter = 2;
    const shapesXmlArray: string[] = [];

    for (const node of slide.elements) {
      if (node.type === 'container') {
        shapesXmlArray.push(compileContainerShape(node, shapeIdCounter++));
      } else if (node.type === 'text') {
        shapesXmlArray.push(compileTextShape(node, shapeIdCounter++));
      }
    }

    const shapesXml = shapesXmlArray.join('\n');

    let bgXml = '';
    if (slide.backgroundColor) {
      bgXml = `
    <p:bg>
      <p:bgPr>
        <a:solidFill>
          <a:srgbClr val="${slide.backgroundColor}"/>
        </a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>`;
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" 
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>${bgXml}
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapesXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

    slidesFolder?.file(`slide${idx + 1}.xml`, slideXml);
    slidesRelsFolder?.file(`slide${idx + 1}.xml.rels`, SLIDE_RELS_XML);
  });

  // 5. Generate PPTX buffer
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}
