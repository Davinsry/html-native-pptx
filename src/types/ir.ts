/**
 * Intermediate Representation (IR) AST for html-native-pptx.
 * Decouples the DOM crawler (Harvester) from the PresentationML generator (Compiler).
 */

export const UNITS = {
  DPI: 96,
  PT_PER_INCH: 72,
  EMU_PER_INCH: 914400,
  SLIDE_16_9_WIDTH_INCHES: 13.333333,
  SLIDE_16_9_HEIGHT_INCHES: 7.5,
  SLIDE_16_9_WIDTH_EMU: 12192000,
  SLIDE_16_9_HEIGHT_EMU: 6858000,
  SLIDE_4_3_WIDTH_INCHES: 10,
  SLIDE_4_3_HEIGHT_INCHES: 7.5,
  SLIDE_4_3_WIDTH_EMU: 9144000,
  SLIDE_4_3_HEIGHT_EMU: 6858000,
} as const;

export type ElementType = 'container' | 'text' | 'image' | 'table';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * Normalized bounding box in Inches.
 */
export interface BoundingBox {
  x: number; // Horizontal offset from slide top-left (Inches)
  y: number; // Vertical offset from slide top-left (Inches)
  w: number; // Width (Inches)
  h: number; // Height (Inches)
}

/**
 * Visual styling for rectangular containers and shapes.
 */
export interface ShapeStyle {
  fillColor?: string;     // 6-character uppercase Hex without '#' (e.g. '1E293B')
  fillOpacity?: number;   // 0.0 - 1.0
  borderColor?: string;   // 6-character uppercase Hex without '#'
  borderWidth?: number;   // Points (pt)
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  radius?: number;        // Border radius in pixels (converted to OpenXML adj in compiler)
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
    opacity?: number;
  };
}

/**
 * Individual formatted text run inside a paragraph (maps to OpenXML <a:r>).
 */
export interface TextRun {
  content: string;
  fontFamily?: string;
  fontSize?: number;      // Points (pt)
  color?: string;         // 6-character uppercase Hex (e.g. '0F172A')
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

/**
 * Paragraph containing one or more formatted text runs (maps to OpenXML <a:p>).
 */
export interface ParagraphIR {
  align?: TextAlign;
  lineHeight?: number;
  spaceBefore?: number;   // Points (pt)
  spaceAfter?: number;    // Points (pt)
  runs: TextRun[];
}

/**
 * Flat text style convenience interface (for simple, single-style text elements).
 */
export interface TextStyle {
  fontFamily: string;
  fontSize: number;       // Points (pt)
  color: string;          // 6-character uppercase Hex without '#'
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
}

/**
 * Primary Abstract Syntax Tree (AST) node.
 */
export interface IRNode {
  id?: string | number;
  name?: string;
  type: ElementType;
  box: BoundingBox;
  zIndex?: number;

  // Container shape properties
  shapeStyle?: ShapeStyle;

  // Single-run / flat text properties
  content?: string;
  textStyle?: TextStyle;

  // Structured multi-run rich text paragraphs
  paragraphs?: ParagraphIR[];

  // Nested elements (if grouped or container has nested AST)
  children?: IRNode[];
}

/**
 * Embedded font IR representing a portable font stream for OpenXML (.fntdata).
 */
export interface EmbeddedFontIR {
  typeface: string;
  fntData: Buffer;
}

/**
 * Complete Intermediate Representation for a single slide.
 */
export interface SlideIR {
  width: number;          // Default 13.333333 inches (16:9)
  height: number;         // Default 7.5 inches
  backgroundColor?: string;
  elements: IRNode[];
  fonts?: EmbeddedFontIR[];
}

/**
 * Multi-slide presentation IR container with global presentation metadata.
 */
export interface PresentationIR {
  slides: SlideIR[];
  fonts?: EmbeddedFontIR[];
}

