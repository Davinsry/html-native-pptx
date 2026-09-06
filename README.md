# html-native-pptx

Convert HTML/CSS layouts into native, fully-editable PowerPoint (`.pptx`) presentations via OpenXML DrawingML.

## Overview

Unlike screenshot-based or wrapper libraries, `html-native-pptx` leverages headless Chromium to resolve modern CSS (Flexbox, CSS Grid, custom fonts, rounded corners), constructs a strongly-typed Abstract Syntax Tree (IR), and compiles directly into clean OpenXML PresentationML.

- **Fully Editable:** Texts remain real PowerPoint text runs, shapes remain vector shapes.
- **Accurate CSS:** Flexbox, Grid, absolute positions, padding, and borders are resolved natively by the browser engine.
- **High Performance:** Lightweight, zero external PowerPoint runtime dependencies (no LibreOffice required).

## Key Features

- **Fully Editable & Native:** Output contains real PowerPoint shapes and text runs with authentic typography, alignments, and colors—never rasterized screenshots.
- **Accurate CSS Engine:** Headless Chromium accurately evaluates Flexbox, CSS Grid, absolute positioning, borders, and rounded corners.
- **Multi-Slide Harvesting:** Split presentation decks across multiple slides seamlessly via `slideSelector` (e.g. `.slide`).
- **Portable Custom Font Embedding:** Automatically parses `@font-face` rules or accepts custom `.ttf`/`.otf` files, converts them to Microsoft EOT (`.fntdata`), and embeds them directly inside the `.pptx` container so custom fonts render identically across all computers without requiring local OS installation!
- **Pure Node.js & Zero Office Dependencies:** Generates compliant OpenXML PresentationML archives directly with JSZip. No LibreOffice or MS Office installation required on the server.

## Installation

```bash
npm install html-native-pptx
```

## Quick Start

### Basic HTML to PPTX Conversion

```ts
import * as fs from 'node:fs/promises';
import { convertHtmlToPptx } from 'html-native-pptx';

const html = `
  <div style="width: 100vw; height: 100vh; background: #0f172a; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: sans-serif;">
    <h1 style="font-size: 48px; margin-bottom: 16px;">Hello from HTML</h1>
    <p style="font-size: 24px; color: #94a3b8;">Rendered as native vector OpenXML PowerPoint shapes!</p>
  </div>
`;

const pptxBuffer = await convertHtmlToPptx(html, {
  aspect: '16:9',
  viewport: { width: 1920, height: 1080 },
});

await fs.writeFile('presentation.pptx', pptxBuffer);
```

### Multi-Slide Presentation Deck with Embedded Custom Fonts

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { convertHtmlToPptx } from 'html-native-pptx';

const html = await fs.readFile('curatorial-deck.html', 'utf-8');

const pptxBuffer = await convertHtmlToPptx(html, {
  slideSelector: '.slide',        // Target each slide container
  aspect: '16:9',
  basePath: './fonts',           // Auto-resolve @font-face local font files
  autoEmbedFonts: true,          // Automatically embed custom fonts into PPTX
});

await fs.writeFile('curatorial-deck.pptx', pptxBuffer);
```

### Explicit Font Embedding

You can also pass font files or buffers directly:

```ts
const pptxBuffer = await convertHtmlToPptx(html, {
  slideSelector: '.slide',
  fonts: [
    {
      typeface: 'Telkomsel Batik Sans',
      src: './fonts/Telkomsel-Batik-Sans-Reconstructed.ttf',
    },
  ],
});
```

## Pipeline Architecture

```
[ HTML / CSS String or URL ]
             │
             ▼
   Phase 1: Headless DOM Harvester (Puppeteer)
   - Evaluates computed styles, bounding rects, and @font-face rules
             │
             ▼
   Phase 2: Intermediate Representation (IR Normalizer)
   - Normalizes coordinates into Inches/EMU and parses typography
             │
             ▼
   Phase 3: OpenXML PresentationML Compiler (JSZip)
   - Injects embedded fonts (.fntdata), layouts, themes, and DrawingML trees
             │
             ▼
      [ Output .pptx Buffer ]
```

## Development

```bash
# Install dependencies
npm install

# Typecheck
npm run typecheck

# Run test suites
npm test

# Build dual ESM / CJS bundle
npm run build
```

## License

MIT © Davin Surya
