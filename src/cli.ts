#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { convertHtmlToPptx } from './index.js';

function printHelp(): void {
  console.log(`
html-native-pptx - Convert HTML/CSS layouts into native PowerPoint (.pptx) presentations

Usage:
  npx html-native-pptx <input.html> [options]

Options:
  -o, --output <path>       Output PPTX file path (default: <input-basename>.pptx)
  -a, --aspect <ratio>      Slide aspect ratio: '16:9' (default) or '4:3'
  -s, --selector <css>      CSS selector for multi-slide decks (e.g. '.slide', 'section')
  -w, --width <number>      Viewport width in pixels (default: 1280)
  -h, --height <number>     Viewport height in pixels (default: 720)
  -v, --version             Show version
  --help                    Show this help message

Examples:
  npx html-native-pptx slide.html -o presentation.pptx
  npx html-native-pptx deck.html --selector .slide --aspect 16:9
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    try {
      const pkgPath = path.resolve(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      console.log(`html-native-pptx v${pkg.version}`);
    } catch {
      console.log('html-native-pptx v0.2.0');
    }
    process.exit(0);
  }

  let inputFile = '';
  let outputFile = '';
  let aspect: '16:9' | '4:3' = '16:9';
  let selector: string | undefined;
  let viewportWidth = 1280;
  let viewportHeight = 720;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-o' || arg === '--output') {
      outputFile = args[++i];
    } else if (arg === '-a' || arg === '--aspect') {
      const val = args[++i];
      if (val === '4:3' || val === '16:9') aspect = val;
    } else if (arg === '-s' || arg === '--selector') {
      selector = args[++i];
    } else if (arg === '-w' || arg === '--width') {
      viewportWidth = parseInt(args[++i], 10) || 1280;
    } else if (arg === '-h' || arg === '--height') {
      viewportHeight = parseInt(args[++i], 10) || 720;
    } else if (!arg.startsWith('-') && !inputFile) {
      inputFile = arg;
    }
  }

  if (!inputFile) {
    console.error('Error: Please specify an input HTML file.');
    printHelp();
    process.exit(1);
  }

  const resolvedInput = path.resolve(process.cwd(), inputFile);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: Input file "${resolvedInput}" does not exist.`);
    process.exit(1);
  }

  if (!outputFile) {
    const parsed = path.parse(resolvedInput);
    outputFile = path.join(parsed.dir, `${parsed.name}.pptx`);
  }
  const resolvedOutput = path.resolve(process.cwd(), outputFile);

  console.log(`Converting "${inputFile}" to "${path.basename(resolvedOutput)}"...`);
  const startTime = Date.now();

  const html = fs.readFileSync(resolvedInput, 'utf-8');
  const buffer = await convertHtmlToPptx(html, {
    aspect,
    slideSelector: selector,
    viewport: { width: viewportWidth, height: viewportHeight },
    basePath: path.dirname(resolvedInput),
  });

  fs.writeFileSync(resolvedOutput, buffer);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const sizeKb = (buffer.length / 1024).toFixed(1);

  console.log(`Success! Saved ${sizeKb} KB to "${resolvedOutput}" in ${elapsed}s.`);
}

main().catch((err) => {
  console.error('Error during conversion:', err);
  process.exit(1);
});
