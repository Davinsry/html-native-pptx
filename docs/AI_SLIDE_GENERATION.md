# AI Slide Generation Cookbook & Presets

This guide provides system prompts, architectural rules, and copy-paste component templates for generating presentation decks with Large Language Models (Claude, GPT-4o, Gemini) using `html-native-pptx`.

---

## Why HTML/CSS as the AI Presentation Target?

Large Language Models excel at generating HTML and CSS:
1. **Massive Pretraining Corpus**: LLMs have ingested millions of web pages, Tailwind layouts, and responsive components. They understand CSS Flexbox, Grid, and typography far better than arbitrary proprietary JSON schemas or Python-pptx DSLs.
2. **Direct Visual Feedback**: Any generated slide can be immediately previewed in any browser or iframe without compilation.
3. **Lossless OpenXML Compilation**: `html-native-pptx` converts the browser's rendered DOM layout directly into native DrawingML shapes, text runs, editable tables, and vector curves.

---

## 1. Master System Prompt for LLMs

Use the following system prompt when prompting an AI to generate presentation slides:

```markdown
You are an expert presentation designer and frontend developer.
Your task is to generate clean, modern, single-slide or multi-slide presentation decks in standard HTML and CSS, designed for compilation into native Microsoft PowerPoint (.pptx) via `html-native-pptx`.

### Canvas Constraints:
- Slide Dimensions: Fixed 1280px width by 720px height (16:9 widescreen aspect ratio).
- Multi-Slide Container: Wrap each slide in `<section class="slide">` with `width: 1280px; height: 720px; position: relative; overflow: hidden; page-break-after: always; box-sizing: border-box;`.
- Use standard CSS Flexbox or CSS Grid for layouts. Avoid float or absolute positioning where flex/grid works.

### Design Standards:
1. Palette: Choose a cohesive 3-4 color palette:
   - 1 Dark / Canvas background (e.g. #0F172A, #FFFFFF, #F8FAFC)
   - 1 Primary brand accent (e.g. #2563EB, #6366F1, #059669)
   - 1 Neutral surface / card fill (e.g. #1E293B or #FFFFFF with subtle border #E2E8F0)
   - High-contrast text: #0F172A / #FFFFFF for headings, #64748B / #94A3B8 for body.
2. Typography:
   - Primary: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
   - Slide Title: 36px - 44px, bold (font-weight: 700)
   - Section Headings: 20px - 28px, font-weight: 600
   - Body & Metrics: 14px - 18px for body; 36px - 56px for key statistics/numbers.
3. Native Elements:
   - Tables: Use standard <table>, <thead>, <tbody>, <tr>, <th>, <td>. They will be compiled into real editable PowerPoint tables!
   - Gradients: Use `background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)`.
   - Vectors/Icons: Use inline `<svg viewBox="0 0 24 24"><path d="..." fill="..."/></svg>`. They will convert into native PowerPoint vector shapes.
4. Output Format:
   - Return only self-contained valid HTML inside a ```html block.
```

---

## 2. Production Component Presets

Here are ready-to-use HTML slide patterns that compile cleanly into native PowerPoint elements.

### Preset A: Executive KPI Metrics Grid

Ideal for executive summaries, quarterly business reviews (QBRs), and pitch decks.

```html
<section class="slide" style="width: 1280px; height: 720px; background: #0b0f19; color: #ffffff; padding: 60px 80px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
  <!-- Header -->
  <div>
    <span style="color: #6366f1; font-size: 14px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Executive Performance</span>
    <h1 style="font-size: 40px; font-weight: 700; margin: 8px 0 0 0;">Q3 2026 Key Metrics & Growth</h1>
  </div>

  <!-- 4-Card KPI Grid -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;">
    <!-- Metric 1 -->
    <div style="background: #151c2e; border: 1px solid #24304f; border-radius: 12px; padding: 28px;">
      <p style="margin: 0; font-size: 14px; color: #94a3b8; font-weight: 500;">Annual Recurring Revenue</p>
      <h2 style="margin: 14px 0 10px 0; font-size: 48px; font-weight: 800; color: #ffffff;">$42.8M</h2>
      <div style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
        +38.4% YoY
      </div>
    </div>

    <!-- Metric 2 -->
    <div style="background: #151c2e; border: 1px solid #24304f; border-radius: 12px; padding: 28px;">
      <p style="margin: 0; font-size: 14px; color: #94a3b8; font-weight: 500;">Net Revenue Retention</p>
      <h2 style="margin: 14px 0 10px 0; font-size: 48px; font-weight: 800; color: #ffffff;">124%</h2>
      <div style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
        +4.2% QoQ
      </div>
    </div>

    <!-- Metric 3 -->
    <div style="background: #151c2e; border: 1px solid #24304f; border-radius: 12px; padding: 28px;">
      <p style="margin: 0; font-size: 14px; color: #94a3b8; font-weight: 500;">Active Enterprise Logos</p>
      <h2 style="margin: 14px 0 10px 0; font-size: 48px; font-weight: 800; color: #ffffff;">1,420</h2>
      <div style="display: inline-block; background: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
        +112 New Logos
      </div>
    </div>

    <!-- Metric 4 -->
    <div style="background: #151c2e; border: 1px solid #24304f; border-radius: 12px; padding: 28px;">
      <p style="margin: 0; font-size: 14px; color: #94a3b8; font-weight: 500;">Gross Margin</p>
      <h2 style="margin: 14px 0 10px 0; font-size: 48px; font-weight: 800; color: #ffffff;">81.5%</h2>
      <div style="display: inline-block; background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
        Industry Leading
      </div>
    </div>
  </div>

  <!-- Footer Insight -->
  <div style="background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%); border-left: 4px solid #6366f1; padding: 16px 24px; border-radius: 8px;">
    <p style="margin: 0; font-size: 15px; color: #cbd5e1;">
      <strong>Strategic Highlight:</strong> Accelerated enterprise pipeline conversion in EMEA drove outsized ARR outperformance in Q3.
    </p>
  </div>
</section>
```

---

### Preset B: Native Editable Comparison Table

Demonstrates native PowerPoint table compilation (`<a:tbl>`) with custom cell fills, padding, borders, and column widths.

```html
<section class="slide" style="width: 1280px; height: 720px; background: #ffffff; color: #0f172a; padding: 60px 80px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box;">
  <h1 style="font-size: 36px; font-weight: 700; margin: 0 0 8px 0;">Tier Comparison Matrix</h1>
  <p style="font-size: 16px; color: #64748b; margin: 0 0 32px 0;">Feature availability and enterprise SLA across plans</p>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
    <thead>
      <tr style="background-color: #f1f5f9; color: #0f172a;">
        <th style="padding: 16px 20px; font-weight: 700; border-bottom: 2px solid #cbd5e1; width: 34%;">Feature / Capability</th>
        <th style="padding: 16px 20px; font-weight: 700; border-bottom: 2px solid #cbd5e1; width: 22%;">Starter</th>
        <th style="padding: 16px 20px; font-weight: 700; border-bottom: 2px solid #cbd5e1; width: 22%;">Professional</th>
        <th style="padding: 16px 20px; font-weight: 700; border-bottom: 2px solid #2563eb; background-color: #eff6ff; color: #1d4ed8; width: 22%;">Enterprise</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Monthly Active Users</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Up to 5,000</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">Up to 50,000</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 700; color: #2563eb;">Unlimited</td>
      </tr>
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">OpenXML Native PPTX Export</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Basic Shapes</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">Full Vector + Fonts</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 700; color: #2563eb;">Full Vector + Custom EOT</td>
      </tr>
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">SSO & SAML Authentication</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #94a3b8;">—</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">Google & Okta</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 700; color: #2563eb;">Custom SAML 2.0 / SCIM</td>
      </tr>
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Uptime Guarantee & SLA</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #64748b;">99.0% Best Effort</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">99.9% Standard</td>
        <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; font-weight: 700; color: #2563eb;">99.99% Dedicated</td>
      </tr>
    </tbody>
  </table>
</section>
```

---

### Preset C: 3-Pillar Architecture / Product Cards with Gradients & Vectors

Showcases linear gradients (`<a:gradFill>`) and SVG vector paths (`<a:custGeom>`).

```html
<section class="slide" style="width: 1280px; height: 720px; background: #0f172a; color: #ffffff; padding: 60px 80px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
  <div>
    <span style="color: #38bdf8; font-size: 14px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Core Engine</span>
    <h1 style="font-size: 38px; font-weight: 700; margin: 8px 0 0 0;">Architectural Highlights</h1>
  </div>

  <!-- 3 Pillar Cards -->
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px;">
    <!-- Pillar 1 -->
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; display: flex; flex-direction: column;">
      <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%); display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#ffffff" stroke-width="2" fill="none"/>
        </svg>
      </div>
      <h3 style="font-size: 20px; font-weight: 700; margin: 0 0 10px 0;">Chromium Layout</h3>
      <p style="font-size: 15px; color: #94a3b8; line-height: 1.5; margin: 0;">
        Uses headless Puppeteer to resolve CSS Flexbox, Grid, nested padding, and fonts with pixel perfection.
      </p>
    </div>

    <!-- Pillar 2 -->
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; display: flex; flex-direction: column;">
      <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M9 9l6 6 M15 9l-6 6" stroke="#ffffff" stroke-width="2" fill="none"/>
        </svg>
      </div>
      <h3 style="font-size: 20px; font-weight: 700; margin: 0 0 10px 0;">DrawingML AST</h3>
      <p style="font-size: 15px; color: #94a3b8; line-height: 1.5; margin: 0;">
        Transforms DOM bounding boxes into pure OpenXML presentation shapes, gradients, and typography runs.
      </p>
    </div>

    <!-- Pillar 3 -->
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; display: flex; flex-direction: column;">
      <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#ffffff" stroke-width="2" fill="none"/>
        </svg>
      </div>
      <h3 style="font-size: 20px; font-weight: 700; margin: 0 0 10px 0;">Embedded EOT Fonts</h3>
      <p style="font-size: 15px; color: #94a3b8; line-height: 1.5; margin: 0;">
        Converts `@font-face` TTF/OTF fonts directly into `.fntdata` streams embedded inside `.pptx` for zero-install viewing.
      </p>
    </div>
  </div>

  <div style="color: #64748b; font-size: 13px; text-align: center;">
    Designed for automated pipeline execution • Zero Microsoft Office server dependencies
  </div>
</section>
```

---

## 3. End-to-End Node.js Pipeline with AI (OpenAI / Anthropic)

Here is a complete, production-ready script that asks an LLM to design a slide and compiles it directly to `.pptx`:

```ts
import { OpenAI } from 'openai';
import { convertHtmlToPptx } from 'html-native-pptx';
import * as fs from 'node:fs/promises';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateSlideDeck(topic: string, outputPath: string) {
  console.log(`Generating presentation for topic: "${topic}"...`);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `You are an elite slide designer. Output ONLY valid, self-contained HTML for an executive 16:9 presentation slide (1280x720px). Use inline CSS styling with Flexbox/Grid, rich typography, and subtle container borders. Wrap in <section class="slide">. Do not output markdown fences or commentary, just the raw HTML.`
      },
      {
        role: 'user',
        content: `Create a professional presentation slide on the topic: ${topic}`
      }
    ]
  });

  const rawHtml = response.choices[0].message.content?.trim() || '';
  const cleanHtml = rawHtml.replace(/^```html\s*/i, '').replace(/```$/i, '');

  console.log('Compiling HTML into native PowerPoint presentation...');
  const pptxBuffer = await convertHtmlToPptx(cleanHtml, {
    aspect: '16:9',
    slideSelector: '.slide',
    viewport: { width: 1280, height: 720 },
  });

  await fs.writeFile(outputPath, pptxBuffer);
  console.log(`Successfully generated ${outputPath}!`);
}

// Run
await generateSlideDeck('Series B Pitch Deck: AI Cloud Infrastructure', 'pitch.pptx');
```

---

## 4. Best Practices Checklist for AI Prompts

- [x] **Always enforce `box-sizing: border-box`**: Ensures padding does not push elements outside the 1280x720 viewport.
- [x] **Prefer CSS Grid & Flexbox**: Clean nested flexbox trees translate into perfectly aligned PowerPoint text and shapes.
- [x] **Set Explicit Backgrounds**: Set an explicit `background-color` or `background: linear-gradient(...)` on container cards.
- [x] **Tables for Relational Data**: Instruct the LLM to use HTML `<table>` for any grid or comparison; it compiles directly into native editable PowerPoint tables.
- [x] **Keep Font Declarations Clean**: Use universally supported system font stacks (Inter, Segoe UI, Arial) or provide custom fonts with `fonts: [...]` config for automatic EOT embedding.
