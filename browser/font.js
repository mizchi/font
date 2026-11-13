// @ts-check
import * as moonbit from '../_build/js/release/build/js/js.js';

/** @typedef {import('./types.js').Rect} Rect */
/** @typedef {import('./types.js').TextBounds} TextBounds */
/** @typedef {import('./types.js').FontMeasurement} FontMeasurement */
/** @typedef {import('./types.js').MeasureOptions} MeasureOptions */

let nextFontId = 0;

/** @param {number} value @param {string} name */
function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
}

/** @param {DOMRect} rect @param {DOMRect} origin @returns {Rect} */
function relativeRect(rect, origin) {
  return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height };
}

/**
 * Load the same bytes into MoonBit and the browser. Resolves only after FontFace
 * loading, so measurements never race a web-font download. Each handle owns its
 * bytes and reactivates the raw binding synchronously before measuring.
 * @param {string | URL} url
 */
export async function loadFont(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font request failed: ${response.status} ${url}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const loaded = moonbit.loadFont(bytes);
  if (!loaded) throw new Error(`Cannot parse font: ${url}`);
  /** @type {{weight_class: number, italic: boolean, axes: {tag: string, min: number, default: number, max: number}[]}} */
  const info = JSON.parse(loaded);
  const weightAxis = info.axes.find(axis => axis.tag === 'wght');
  const opticalAxis = info.axes.find(axis => axis.tag === 'opsz');
  const widthAxis = info.axes.find(axis => axis.tag === 'wdth');
  const stretch = widthAxis ? `${widthAxis.min}% ${widthAxis.max}%` : 'normal';
  const defaultVariations = opticalAxis ? `"opsz" ${opticalAxis.default}` : 'normal';
  const faceWeight = weightAxis ? `${weightAxis.min} ${weightAxis.max}` : `${info.weight_class}`;
  const faceStyle = info.italic ? 'italic' : 'normal';
  const family = `MoonBitMeasuredFont${nextFontId++}`;
  const comparisonFamily = opticalAxis ? `${family}DefaultOpticalSize` : family;
  const faces = await Promise.all([
    new FontFace(family, buffer, { weight: faceWeight, style: faceStyle, stretch }).load(),
    new FontFace(`${family}NoLiga`, buffer, { weight: faceWeight, style: faceStyle, stretch, variationSettings: defaultVariations, featureSettings: '"liga" 0, "clig" 0' }).load(),
    ...(opticalAxis ? [new FontFace(comparisonFamily, buffer, { weight: faceWeight, style: faceStyle, variationSettings: defaultVariations }).load()] : []),
  ]);
  for (const face of faces) document.fonts.add(face);
  let disposed = false;
  /** @type {Map<string, Promise<string>>} */
  const instances = new Map();

  /**
   * Canvas and MoonBit measure one unwrapped run; DOM additionally supports
   * wrapping. DOM ranges describe graphemes, not font glyphs or shaped clusters.
   * @param {string} text
   * @param {number} fontSize
   * @param {MeasureOptions} [options]
   * @param {string} [instanceFamily]
   * @param {Record<string, number>} [axisValues]
   * @returns {FontMeasurement}
   */
  function measure(text, fontSize, options = {}, instanceFamily, axisValues = {}) {
    if (disposed) throw new Error('Font handle has been disposed');
    positive(fontSize, 'fontSize');
    const lineHeight = options.lineHeight ?? fontSize * 1.4;
    positive(lineHeight, 'lineHeight');
    if (options.maxWidth !== undefined) positive(options.maxWidth, 'maxWidth');
    const fontWeight = options.fontWeight ?? weightAxis?.default ?? info.weight_class;
    if (!Number.isFinite(fontWeight) || fontWeight < 1 || fontWeight > 1000) throw new RangeError('fontWeight must be between 1 and 1000');
    if (!moonbit.loadFont(bytes)) throw new Error('Cannot activate font');
    /** @type {import('./types.js').ShapeResult} */
    const shaped = JSON.parse(moonbit.shapeTextWithAxes(text, fontSize, options.direction ?? 'auto',
      options.language ?? 'und', options.kerning ?? true, options.ligatures ?? true, fontWeight, JSON.stringify(axisValues)));
    if (!shaped.ok) throw new Error(`${shaped.error.code}: ${shaped.error.message}`);
    const shaping = shaped.result;
    const bounds = shaping.bounds;
    const measuredFamily = instanceFamily ?? (options.ligatures === false ? `${family}NoLiga` : comparisonFamily);

    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.canvas.lang = options.language ?? 'und';
    ctx.font = `${faceStyle} ${fontWeight} ${fontSize}px "${measuredFamily}"`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.direction = shaping.direction;
    ctx.fontKerning = options.kerning === false ? 'none' : 'normal';
    // Compare unhinted design advances across platforms. Linux's default
    // hinting can round each glyph's advance to whole pixels.
    ctx.textRendering = 'geometricPrecision';
    const metrics = ctx.measureText(text);

    const element = document.createElement('div');
    Object.assign(element.style, {
      position: 'absolute', left: '0', top: '0', margin: '0', padding: '0', border: '0',
      font: `${faceStyle} ${fontWeight} ${fontSize}px "${measuredFamily}"`, lineHeight: `${lineHeight}px`,
      fontOpticalSizing: 'none', fontSynthesis: 'none',
      textRendering: 'geometricPrecision',
      fontVariationSettings: Object.entries(axisValues).map(([tag, value]) => `"${tag}" ${value}`).join(', ') || 'normal',
      fontKerning: options.kerning === false ? 'none' : 'normal',
      fontVariantLigatures: options.ligatures === false ? 'no-common-ligatures' : 'normal',
      letterSpacing: '0', wordSpacing: '0', direction: shaping.direction,
      whiteSpace: options.maxWidth === undefined ? 'pre' : 'pre-wrap',
      overflowWrap: 'anywhere',
      width: options.maxWidth === undefined ? 'max-content' : `${options.maxWidth}px`,
      visibility: 'hidden',
    });
    element.lang = options.language ?? 'und';
    const node = document.createTextNode(text);
    element.append(node);
    document.body.append(element);
    try {
      const origin = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const textBounds = relativeRect(range.getBoundingClientRect(), origin);
      // Range returns text fragments, including bidi fragments on a single line.
      const lineRects = Array.from(range.getClientRects(), rect => relativeRect(rect, origin));
      const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
      const graphemes = Array.from(segmenter.segment(text), ({ segment, index }) => {
        range.setStart(node, index);
        range.setEnd(node, index + segment.length);
        return {
          text: segment, start: index, end: index + segment.length,
          rects: Array.from(range.getClientRects(), rect => relativeRect(rect, origin)),
        };
      });
      return {
        text, fontSize, moonbit: bounds, shaping,
        options: {
          textRendering: 'geometricPrecision',
          direction: options.direction ?? 'auto', language: options.language ?? 'und',
          kerning: options.kerning ?? true, ligatures: options.ligatures ?? true,
          fontWeight,
        },
        canvas: {
          advanceWidth: metrics.width,
          inkBounds: {
            x: -metrics.actualBoundingBoxLeft, y: -metrics.actualBoundingBoxAscent,
            width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
            height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
          },
          fontAscent: metrics.fontBoundingBoxAscent,
          fontDescent: metrics.fontBoundingBoxDescent,
        },
        dom: {
          bounds: relativeRect(origin, origin), textBounds, lineRects, graphemes,
          lineHeight, maxWidth: options.maxWidth ?? null,
        },
        missingCodepoints: shaping.missing_codepoints,
        widthDelta: bounds.advance_width - metrics.width,
      };
    } finally {
      element.remove();
    }
  }

  return {
    family,
    info,
    /** @param {string} text @param {number} fontSize @param {MeasureOptions} [options] */
    measure(text, fontSize, options = {}) { return measure(text, fontSize, options); },
    /** Load an explicit variation instance before making synchronous measurements.
     * Automatic optical sizing remains a native-DOM fit concern.
     * @param {string} text @param {number} fontSize @param {import('./types.js').AxisMeasureOptions} [options]
     * @returns {Promise<FontMeasurement>}
     */
    async measureWithAxes(text, fontSize, options = {}) {
      if (disposed) throw new Error('Font handle has been disposed');
      positive(fontSize, 'fontSize');
      /** @type {Record<string, number>} */
      const axes = { ...(opticalAxis ? { opsz: opticalAxis.default } : {}), ...options.axisValues };
      if (options.fontStretch !== undefined) {
        positive(options.fontStretch, 'fontStretch');
        axes.wdth ??= options.fontStretch;
      }
      for (const [tag, value] of Object.entries(axes)) {
        const axis = info.axes.find(axis => axis.tag === tag);
        if (!axis || !Number.isFinite(value)) throw new RangeError(`Unsupported or non-finite variation axis: ${tag}`);
        axes[tag] = Math.max(axis.min, Math.min(axis.max, value));
      }
      const settings = Object.entries(axes).sort(([left], [right]) => left.localeCompare(right)).map(([tag, value]) => `"${tag}" ${value}`).join(', ') || 'normal';
      const key = `${settings};${options.ligatures !== false}`;
      if (!instances.has(key)) {
        const name = `${family}Instance${instances.size}`;
        instances.set(key, (async () => {
          const face = await new FontFace(name, buffer, { weight: faceWeight, style: faceStyle,
            variationSettings: settings, featureSettings: options.ligatures === false ? '"liga" 0, "clig" 0' : 'normal' }).load();
          if (disposed) throw new Error('Font handle has been disposed');
          document.fonts.add(face); faces.push(face);
          return name;
        })());
      }
      const instanceFamily = await instances.get(key);
      return measure(text, fontSize, options, instanceFamily, axes);
    },
    dispose() {
      for (const face of faces) document.fonts.delete(face);
      disposed = true;
    },
  };
}
