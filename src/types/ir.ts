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

export interface GradientStop {
  position: number; // 0.0 - 1.0 (maps to 0 - 100000 in DrawingML)
  color: string;    // 6-character uppercase Hex without '#'
  opacity?: number;
}

export interface GradientFill {
  type: 'linear' | 'radial';
  angle?: number;   // Angle in degrees (e.g. 90 = left-to-right, 180 = top-to-bottom)
  stops: GradientStop[];
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
  geometry?: string;      // OpenXML preset geometry (e.g. 'rect', 'roundRect', 'ellipse', 'line')
  flipV?: boolean;        // Vertical flip for lines / shapes
  flipH?: boolean;        // Horizontal flip for lines / shapes
  gradient?: GradientFill;// Linear or radial gradient fill
  customPath?: string;    // SVG path string (e.g. 'M10 20 L30 40 Z') for <a:custGeom>
  /**
   * Coordinate space the custom path is drawn in, in SVG user units.
   *
   * This is the element's OWN bounding box, not the <svg> viewBox. DrawingML
   * stretches a path's declared space to fill the shape frame, and the frame
   * is the element's bounding box -- so declaring the whole viewBox here
   * squashes every path into a fraction of its intended size and position.
   */
  pathViewBox?: { w: number; h: number };
  /** Top-left of that bounding box, subtracted from every point so the path starts at 0,0. */
  pathOrigin?: { x: number; y: number };
  /** SVG marker-start / marker-end, compiled to DrawingML line ends. */
  startArrow?: boolean;
  endArrow?: boolean;
  /** SVG stroke-dasharray; only presence matters, DrawingML has preset dashes. */
  dashed?: boolean;
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
  /** Spasi antar huruf dalam poin; negatif merapatkan, seperti CSS letter-spacing. */
  letterSpacing?: number;
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
 * Table cell representation for OpenXML native table (<a:tc>).
 */
export interface TableCellIR {
  content?: string;
  paragraphs?: ParagraphIR[];
  fillColor?: string;
  fillOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  colSpan?: number;
  rowSpan?: number;
  align?: TextAlign;
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

/**
 * Table row representation for OpenXML native table (<a:tr>).
 */
export interface TableRowIR {
  height: number; // Row height in inches
  cells: TableCellIR[];
}

/**
 * Native OpenXML Table structure (<a:tbl>).
 */
export interface TableIR {
  columns: { width: number }[]; // Column widths in inches
  rows: TableRowIR[];
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

  // Native table data
  table?: TableIR;

  // Single-run / flat text properties
  content?: string;
  textStyle?: TextStyle;

  // Structured multi-run rich text paragraphs
  paragraphs?: ParagraphIR[];

  /** Teksnya satu baris di browser; pembungkusan dimatikan agar tetap satu baris. */
  noWrap?: boolean;

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

