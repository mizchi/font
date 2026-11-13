export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidthLimits {
  minWidth?: number;
  maxWidth?: number;
  tolerance?: number;
}

export interface WidthCheck {
  status: 'underflow' | 'fits' | 'overflow';
  width: number;
  minWidth: number;
  maxWidth: number;
  tolerance: number;
  underflowBy: number;
  overflowBy: number;
}

export interface FitOptions extends WidthLimits {
  /** Registered web-font families that must load successfully. */
  requiredFonts?: string[];
  /** Accept deliberate ellipsis/line clamp; layout.status still reports overflow. */
  allowTruncation?: boolean;
}

export interface FontDiagnostics {
  status: 'ready' | 'error';
  /** Standard DOM APIs do not expose the font used for each rendered glyph. */
  glyphCoverage: 'unverified';
  faces: { family: string; weight: string; style: string; status: FontFaceLoadStatus }[];
  issues: { family: string; reason: 'unregistered' | 'load-failed' | 'not-requested' }[];
}

export type FitStatus = WidthCheck['status'] | 'unmeasurable' | 'unsupported' | 'font-error';

export interface OverflowDistances { left: number; right: number; top: number; bottom: number }

export interface PlacementInspection {
  /** Parent flex/grid allocation, separate from text overflow inside the box. */
  status: 'fits' | 'overflow' | 'unconstrained';
  container: Rect | null;
  overflow: OverflowDistances | null;
}

export interface PresentationInspection {
  status: 'full' | 'truncated' | 'clipped' | 'scrollable' | 'overflow' | 'unknown';
  clippedBy: { element: string; kind: 'clip' | 'scroll'; rect: Rect; overflow: OverflowDistances }[];
}

export interface TextFitOptions extends FitOptions {
  /** Available content-box width, in CSS pixels. */
  maxWidth: number;
  /** Fixed content-box height. Omit for an unconstrained auto-height box. */
  maxHeight?: number;
  language?: string;
  /** CSS declarations using camelCase or kebab-case property names. */
  style?: Record<string, string>;
}

export interface FitInspection {
  measurable: boolean;
  /** Physical layout geometry, not painted ink, shadows or decorations. */
  basis: 'layout';
  /** Viewport coordinates divided by the inspected element's total scale.
   * Lengths and fit limits remain unscaled CSS pixels. Multiply x/width by
   * scaleX and y/height by scaleY to recover viewport CSS coordinates. */
  coordinates: { space: 'normalized-viewport'; scaleX: number; scaleY: number };
  fonts: FontDiagnostics;
  placement: PlacementInspection;
  presentation: PresentationInspection;
  /** Wrapped-layout acceptance under font and truncation policies; null if unknown. */
  accepted: boolean | null;
  control: { kind: 'input' | 'textarea'; source: 'value' | 'placeholder' | 'empty'; textLength: number } | null;
  intrinsic: { minContentWidth: number | null; maxContentWidth: number | null };
  unwrapped: Omit<WidthCheck, 'width' | 'status'> & {
    width: number | null;
    status: FitStatus;
  };
  layout: {
    status: FitStatus;
    overflowX: boolean | null;
    overflowY: boolean | null;
    clipped: boolean | null;
    requiredHeight: number | null;
    contentBox: Rect | null;
    textBounds: Rect | null;
    fragments: Rect[];
    overflow: OverflowDistances | null;
  };
  /** Computed typography used for measurement, including the actual CSS weight. */
  style: Record<string, string>;
  reasons: string[];
}

export interface GlyphBounds {
  codepoint: number;
  glyph_id: number;
  /** Half-open UTF-16 cluster range. Several glyphs can share the same range. */
  text_start: number;
  text_end: number;
  x: number;
  y: number;
  advance_width: number;
  ink_bounds: Rect | null;
}

export interface TextBounds {
  advance_width: number;
  ascent: number;
  descent: number;
  line_gap: number;
  logical_bounds: Rect;
  ink_bounds: Rect | null;
  glyphs: GlyphBounds[];
}

export interface MeasureOptions {
  fontWeight?: number;
  direction?: 'auto' | 'ltr' | 'rtl';
  language?: string;
  kerning?: boolean;
  ligatures?: boolean;
  /** CSS pixels. Omit to measure without wrapping. */
  maxWidth?: number;
  /** CSS pixels. Defaults to 1.4 * fontSize. */
  lineHeight?: number;
}

export interface AxisMeasureOptions extends MeasureOptions {
  axisValues?: Record<string, number>;
  /** Width percentage; mapped to wdth unless explicitly supplied in axisValues. */
  fontStretch?: number;
}

export interface ShapedText {
  direction: 'ltr' | 'rtl';
  bounds: TextBounds;
  runs: {
    text_start: number;
    text_end: number;
    glyph_start: number;
    glyph_end: number;
    level: number;
    direction: 'ltr' | 'rtl';
    script: string;
    x: number;
    advance_width: number;
  }[];
  missing_codepoints: number[];
  variations: Record<string, number>;
}

export type ShapeResult = { ok: true; result: ShapedText } |
  { ok: false; error: { code: string; message: string } };

export interface FontMeasurement {
  text: string;
  fontSize: number;
  options: Required<Pick<MeasureOptions, 'direction' | 'language' | 'kerning' | 'ligatures' | 'fontWeight'>>;
  /** GSUB/GPOS/BiDi layout in visual order, without font fallback. */
  moonbit: TextBounds;
  shaping: ShapedText;
  /** Unwrapped, fully browser-shaped text. Coordinates are baseline-relative. */
  canvas: {
    advanceWidth: number;
    inkBounds: Rect;
    fontAscent: number;
    fontDescent: number;
  };
  /** CSS layout; coordinates relative to the element's top-left. */
  dom: {
    bounds: Rect;
    textBounds: Rect;
    lineRects: Rect[];
    graphemes: { text: string; start: number; end: number; rects: Rect[] }[];
    lineHeight: number;
    maxWidth: number | null;
  };
  /** Code points absent from the selected font; browser fallback may differ. */
  missingCodepoints: number[];
  widthDelta: number;
}
