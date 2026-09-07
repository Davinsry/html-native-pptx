# html-native-pptx

Convert HTML/CSS layouts into native, fully-editable PowerPoint (`.pptx`) presentations via OpenXML DrawingML.

## Overview

Unlike screenshot-based or wrapper libraries, `html-native-pptx` leverages headless Chromium to resolve modern CSS (Flexbox, CSS Grid, custom fonts, rounded corners), constructs a strongly-typed Abstract Syntax Tree (IR), and compiles directly into clean OpenXML PresentationML.

- **Fully Editable:** Texts remain real PowerPoint text runs, shapes remain vector shapes, and tables remain native editable PowerPoint tables.
- **Accurate CSS:** Flexbox, Grid, absolute positions, padding, borders, and CSS gradients are resolved natively by the browser engine.
- **Vector Graphics:** SVG `<path>`, `<circle>`, `<rect>`, and `<line>` elements compile directly to native DrawingML geometry.
- **Zero Office Dependencies:** Generates compliant OpenXML `.pptx` files directly using pure Node.js and JSZip. No LibreOffice or MS Office required.

## Key Features

- **Native Editable Tables:** Compiles standard HTML `<table>` elements into native PowerPoint `<a:tbl>` graphic frames with column widths, borders, and cell backgrounds.
- **Linear & Radial CSS Gradients:** Compiles CSS `linear-gradient(...)` into DrawingML `<a:gradFill>` with exact color stops and angle conversion.
- **Complex SVG Paths:** Parses SVG `<path d="...">` commands (`M`, `L`, `H`, `V`, `C`, `S`, `Q`, `Z`) into native PowerPoint custom vector shapes (`<a:custGeom>`).
- **Portable Custom Font Embedding:** Automatically parses `@font-face` rules, converts TTF/OTF fonts to Microsoft EOT (`.fntdata`), and embeds them inside the `.pptx` container for identical rendering on any device without local font installation.
- **Multi-Slide Harvesting:** Split presentation decks across multiple slides seamlessly via `slideSelector` (e.g. `.slide`).
- **CLI Utility:** Quick command-line interface to convert files on the fly via `npx html-native-pptx`.
- **AI Slide Generation Cookbook:** Includes system prompts, architectural rules, and component presets for Claude, GPT-4o, and Gemini. See [docs/AI_SLIDE_GENERATION.md](docs/AI_SLIDE_GENERATION.md).

## Installation

```bash
npm install html-native-pptx
```

## CLI Usage

You can use `html-native-pptx` directly from your terminal:

```bash
# Convert a single slide
npx html-native-pptx slide.html -o presentation.pptx

# Convert a multi-slide deck with 16:9 widescreen
npx html-native-pptx deck.html --selector .slide --aspect 16:9 -o deck.pptx
```

### CLI Options

| Option | Shorthand | Description | Default |
|---|---|---|---|
| `--output <path>` | `-o` | Output PPTX file path | `<input-basename>.pptx` |
| `--aspect <ratio>` | `-a` | Slide aspect ratio (`16:9` or `4:3`) | `16:9` |
| `--selector <css>` | `-s` | CSS selector for multi-slide decks | none (single slide) |
| `--width <number>` | `-w` | Viewport width in pixels | `1280` |
| `--height <number>`| `-h` | Viewport height in pixels | `720` |
| `--version` | `-v` | Show version | |
| `--help` | | Show help message | |

## Programmatic API

### 1. Basic HTML to PPTX Conversion

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

### 2. Native Editable Tables

HTML `<table>` elements automatically convert into native PowerPoint tables:

```html
<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background-color: #f1f5f9;">
      <th style="padding: 12px; border-bottom: 2px solid #cbd5e1;">Metric</th>
      <th style="padding: 12px; border-bottom: 2px solid #cbd5e1;">2025</th>
      <th style="padding: 12px; border-bottom: 2px solid #cbd5e1;">2026</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">Revenue</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">$12.4M</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #2563eb;">$24.8M</td>
    </tr>
  </tbody>
</table>
```

### 3. Multi-Slide Presentation Deck with Embedded Custom Fonts

```ts
import * as fs from 'node:fs/promises';
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

### 4. Explicit Font Embedding

```ts
const pptxBuffer = await convertHtmlToPptx(html, {
  slideSelector: '.slide',
  fonts: [
    {
      typeface: 'Custom Sans',
      src: './fonts/CustomSans-Regular.ttf',
    },
  ],
});
```

## AI Slide Generation

Looking to generate presentation decks dynamically using LLMs (GPT-4o, Claude 3.7, Gemini)? Check out the [AI Slide Generation Cookbook & Presets](docs/AI_SLIDE_GENERATION.md) for battle-tested system prompts, 16:9 canvas rules, and responsive slide templates.

## Pipeline Architecture

```
[ HTML / CSS String or URL ]
             │
             ▼
   Phase 1: Headless DOM Harvester (Puppeteer)
   - Evaluates computed styles, bounding rects, tables, gradients, and @font-face rules
             │
             ▼
   Phase 2: Intermediate Representation (IR Normalizer)
   - Normalizes coordinates into Inches/EMU, parses typography, tables, and SVG paths
             │
             ▼
   Phase 3: OpenXML PresentationML Compiler (JSZip)
   - Injects embedded fonts (.fntdata), tables (<a:tbl>), gradients (<a:gradFill>), custom geometry (<a:custGeom>), and DrawingML trees
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

# Build dual ESM / CJS bundle and CLI
npm run build
```

## License

MIT © Davin Surya
