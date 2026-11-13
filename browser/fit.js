// @ts-check
/** @typedef {import('./types.js').Rect} Rect */
/** @typedef {import('./types.js').WidthLimits} WidthLimits */
/** @typedef {import('./types.js').WidthCheck} WidthCheck */
/** @typedef {import('./types.js').FitInspection} FitInspection */
/** @typedef {{x: number, y: number, valid: boolean}} Scale */

/** Inclusive width interval. Values and tolerance are CSS pixels.
 * @param {number} width @param {WidthLimits & {maxWidth: number}} limits
 * @returns {WidthCheck}
 */
export function checkWidth(width, { minWidth = 0, maxWidth, tolerance = 0.01 }) {
  if (![width, minWidth, maxWidth, tolerance].every(Number.isFinite) ||
    width < 0 || minWidth < 0 || maxWidth < minWidth || tolerance < 0) {
    throw new RangeError('Widths and tolerance must be finite, nonnegative and minWidth <= maxWidth');
  }
  return {
    status: width < minWidth - tolerance ? 'underflow' : width > maxWidth + tolerance ? 'overflow' : 'fits',
    width, minWidth, maxWidth, tolerance,
    underflowBy: Math.max(0, minWidth - width), overflowBy: Math.max(0, width - maxWidth),
  };
}

const typography = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch',
  'font-kerning', 'font-feature-settings', 'font-variation-settings', 'font-optical-sizing',
  'font-synthesis', 'font-variant', 'font-variant-ligatures', 'font-variant-caps',
  'font-variant-numeric', 'font-variant-east-asian', 'font-size-adjust',
  'letter-spacing', 'word-spacing', 'line-height', 'white-space', 'word-break',
  'overflow-wrap', 'line-break', 'text-wrap', 'hyphens', 'direction', 'unicode-bidi', 'writing-mode',
  'text-align', 'text-align-last', 'text-justify', 'text-autospace', 'text-spacing-trim',
  'text-orientation', 'text-transform', 'text-indent', 'text-rendering', 'tab-size',
];

const inlineBox = [
  'display', 'vertical-align', 'box-sizing',
  ...['top', 'right', 'bottom', 'left'].flatMap(side => [
    `margin-${side}`, `padding-${side}`, `border-${side}-width`, `border-${side}-style`,
  ]),
];

const boxLayout = ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'flex', 'flex-direction', 'flex-wrap', 'align-items', 'align-self', 'justify-content',
  'gap', 'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows'];

/** @param {CSSStyleDeclaration} css @returns {string | null} */
function pseudoText(css) {
  if (['none', 'normal', ''].includes(css.content)) return '';
  const quoted = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g;
  if (css.content.replace(quoted, '').trim()) return null;
  return [...css.content.matchAll(quoted)].map(match => (match[1] ?? match[2]).replace(
    /\\([\da-fA-F]{1,6})(?:\r\n|[ \t\r\n\f])?|\\([^\r\n])/g,
    (_escape, hex, character) => hex ? String.fromCodePoint(Math.min(0x10ffff, Number.parseInt(hex, 16)) || 0xfffd) : character,
  )).join('');
}

/** @param {HTMLElement} target @param {CSSStyleDeclaration} css */
function copyStyle(target, css) {
  for (const property of [...typography, ...inlineBox, ...boxLayout]) target.style.setProperty(property, css.getPropertyValue(property), 'important');
}

/** Render a text-only box at the requested constraints and inspect both its
 * natural width and its actual wrapped layout. Fonts may be registered with
 * loadFont() or loaded by the host page. The temporary element is always removed.
 * @param {string} text @param {import('./types.js').TextFitOptions} options
 * @returns {Promise<FitInspection>}
 */
export async function checkTextFit(text, options) {
  checkWidth(0, options);
  if (options.maxHeight !== undefined && (!Number.isFinite(options.maxHeight) || options.maxHeight < 0)) {
    throw new RangeError('maxHeight must be finite and nonnegative');
  }
  const element = document.createElement('div');
  Object.assign(element.style, {
    position: 'absolute', left: '-100000px', top: '0', visibility: 'hidden',
    font: '16px sans-serif', lineHeight: '1.4', whiteSpace: 'normal',
    margin: '0', padding: '0', border: '0',
  });
  for (const [property, value] of Object.entries(options.style ?? {})) {
    const name = property.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
    if (!CSS.supports(name, value)) throw new RangeError(`Unsupported CSS declaration: ${name}: ${value}`);
    element.style.setProperty(name, value);
  }
  Object.assign(element.style, {
    width: `${options.maxWidth}px`, minWidth: '0', maxWidth: 'none',
    height: options.maxHeight === undefined ? 'auto' : `${options.maxHeight}px`,
    minHeight: '0', maxHeight: 'none', boxSizing: 'content-box',
  });
  element.lang = options.language ?? 'und';
  element.textContent = text;
  document.body.append(element);
  try { return await inspectFit(element, options, false); }
  finally { element.remove(); }
}

/** @param {DOMRect} rect @param {Scale} [scale] @returns {Rect} */
function rectData(rect, scale = { x: 1, y: 1, valid: true }) {
  return { x: rect.x / scale.x, y: rect.y / scale.y, width: rect.width / scale.x, height: rect.height / scale.y };
}

/** @param {Element} node @param {Window & typeof globalThis} win @returns {Element | null} */
function geometryParent(node, win) {
  const root = node.getRootNode();
  return node.parentElement ?? (root instanceof win.ShadowRoot ? root.host : null);
}

/** Positive axis-aligned transforms only. Translation is read from native
 * rectangles; scale/zoom are factored out for comparison with CSS lengths.
 * @param {Element} element @param {Window & typeof globalThis} win @returns {Scale} */
function effectiveScale(element, win) {
  let x = 1, y = 1;
  for (let node = /** @type {Element | null} */ (element); node; node = geometryParent(node, win)) {
    const css = win.getComputedStyle(node);
    if (css.perspective !== 'none' || !['none', '0deg'].includes(css.rotate || 'none')) return { x, y, valid: false };
    if (css.transform !== 'none') {
      const matrix = new win.DOMMatrixReadOnly(css.transform);
      if (!matrix.is2D || Math.abs(matrix.b) > 1e-9 || Math.abs(matrix.c) > 1e-9 || matrix.a <= 0 || matrix.d <= 0) return { x, y, valid: false };
      x *= matrix.a; y *= matrix.d;
    }
    if (css.scale && css.scale !== 'none') {
      const values = css.scale.split(/\s+/).map(value => value.endsWith('%') ? Number.parseFloat(value) / 100 : Number(value));
      if (values.length > 2 || values.some(value => !Number.isFinite(value) || value <= 0)) return { x, y, valid: false };
      x *= values[0]; y *= values[1] ?? values[0];
    }
    if (css.translate && css.translate !== 'none' && css.translate.split(/\s+/).length > 2) return { x, y, valid: false };
    const zoom = Number.parseFloat(css.zoom) || 1;
    x *= zoom; y *= zoom;
  }
  return { x, y, valid: Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 };
}

/** @param {Element} element @param {Window & typeof globalThis} win */
function effectiveZoom(element, win) {
  let zoom = 1;
  for (let node = /** @type {Element | null} */ (element); node; node = geometryParent(node, win)) zoom *= Number.parseFloat(win.getComputedStyle(node).zoom) || 1;
  return zoom;
}

/** Isolate generated nodes from host selectors. Computed styles have already
 * been copied explicitly; page div::before rules must not decorate them again.
 * @param {HTMLElement} probe @param {HTMLElement} source @param {Window & typeof globalThis} win */
function mountProbe(probe, source, win) {
  const host = source.ownerDocument.createElement('div');
  for (const [name, value] of Object.entries({ all: 'initial', display: 'block', position: 'absolute', left: '0', top: '0',
    width: '0', height: '0', visibility: 'hidden', zoom: `${effectiveZoom(source, win) / effectiveZoom(source.ownerDocument.body, win)}` })) {
    host.style.setProperty(name, value, 'important');
  }
  probe.style.setProperty('zoom', '1', 'important');
  host.attachShadow({ mode: 'closed' }).append(probe);
  source.ownerDocument.body.append(host);
  return host;
}

/** Measure used border widths in zoomed contexts. Engines differ in snapping
 * and in whether getComputedStyle exposes the snapped or declared width.
 * Four inert boxes let the target engine supply each edge without guessing
 * its device-pixel rounding rule or touching the inspected element.
 * @param {HTMLElement} element @param {Window & typeof globalThis} win */
function usedEdges(element, win) {
  const css = win.getComputedStyle(element);
  const sides = /** @type {const} */ (['left', 'right', 'top', 'bottom']);
  const edges = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const side of sides) edges[side] = Number.parseFloat(css.getPropertyValue(`border-${side}-width`)) || 0;
  const zoom = effectiveZoom(element, win);
  if (zoom === 1 || !Object.values(edges).some(value => value > 0)) return edges;
  const holder = element.ownerDocument.createElement('div');
  for (const [name, value] of Object.entries({ all: 'initial', position: 'absolute', left: '-100000px', top: '0', visibility: 'hidden',
    width: '0', height: '0', zoom: `${zoom / effectiveZoom(element.ownerDocument.body, win)}` })) holder.style.setProperty(name, value, 'important');
  const boxes = sides.map(side => {
    const box = element.ownerDocument.createElement('div');
    for (const [name, value] of Object.entries({ all: 'initial', display: 'block', position: 'absolute', 'box-sizing': 'content-box', width: '0', height: '0', padding: '0', margin: '0', border: '0 solid',
      [`border-${side}-width`]: `${edges[side]}px` })) box.style.setProperty(name, value, 'important');
    holder.append(box); return box;
  });
  const host = mountProbe(holder, element, win);
  try {
    const scale = effectiveScale(holder, win);
    for (let i = 0; i < sides.length; i++) {
      const rect = rectData(boxes[i].getBoundingClientRect(), scale);
      edges[sides[i]] = i < 2 ? rect.width : rect.height;
    }
  } finally { host.remove(); }
  return edges;
}

/** @param {HTMLElement} element @param {Window & typeof globalThis} win @param {Scale} scale @returns {Rect} */
function contentRect(element, win, scale) {
  const own = effectiveScale(element, win);
  const rect = rectData(element.getBoundingClientRect(), scale);
  const css = win.getComputedStyle(element);
  const edges = usedEdges(element, win);
  const px = (/** @type {string} */ name) => {
    const side = /^border-(left|right|top|bottom)-width$/.exec(name)?.[1];
    return side ? edges[/** @type {keyof typeof edges} */ (side)] : Number.parseFloat(css.getPropertyValue(name)) || 0;
  };
  const sx = own.x / scale.x, sy = own.y / scale.y;
  const scrollbarCandidate = element.offsetWidth - element.clientWidth - px('border-left-width') - px('border-right-width');
  const scrollbar = ['auto', 'scroll'].includes(css.overflowY) && scrollbarCandidate > 1 ? scrollbarCandidate : 0;
  return { x: rect.x + (px('border-left-width') + px('padding-left')) * sx, y: rect.y + (px('border-top-width') + px('padding-top')) * sy,
    width: Math.max(0, rect.width - (px('border-left-width') + px('border-right-width') + px('padding-left') + px('padding-right') +
      scrollbar) * sx),
    height: Math.max(0, rect.height - (px('border-top-width') + px('border-bottom-width') + px('padding-top') + px('padding-bottom')) * sy) };
}

/** @param {Rect} inner @param {Rect} outer @returns {import('./types.js').OverflowDistances} */
function outside(inner, outer) {
  return { left: Math.max(0, outer.x - inner.x), right: Math.max(0, inner.x + inner.width - outer.x - outer.width),
    top: Math.max(0, outer.y - inner.y), bottom: Math.max(0, inner.y + inner.height - outer.y - outer.height) };
}

/** @param {HTMLElement} element @param {Window & typeof globalThis} win @param {number} tolerance @param {Scale} scale
 * @returns {import('./types.js').PlacementInspection} */
function inspectPlacement(element, win, tolerance, scale) {
  const parent = element.parentElement;
  if (!parent || ['absolute', 'fixed'].includes(win.getComputedStyle(element).position) || !['flex', 'inline-flex', 'grid', 'inline-grid'].includes(win.getComputedStyle(parent).display)) {
    return { status: 'unconstrained', container: null, overflow: null };
  }
  const container = contentRect(parent, win, scale);
  const overflow = { left: 0, right: 0, top: 0, bottom: 0 };
  // Include siblings: an unshrinkable label can push the adjacent icon outside
  // the container even when the label itself is still inside it.
  for (const child of parent.children) {
    if (['absolute', 'fixed'].includes(win.getComputedStyle(child).position)) continue;
    const part = outside(rectData(child.getBoundingClientRect(), scale), container);
    for (const side of /** @type {const} */ (['left', 'right', 'top', 'bottom'])) overflow[side] = Math.max(overflow[side], part[side]);
  }
  return { status: Object.values(overflow).some(value => value > tolerance) ? 'overflow' : 'fits', container, overflow };
}

/** @param {Element} node @param {HTMLElement} root @param {Window & typeof globalThis} win */
function insideAtomicFlow(node, root, win) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (['inline-block', 'inline-flex', 'inline-grid', 'flex', 'grid'].includes(win.getComputedStyle(parent).display)) return true;
    if (parent === root) break;
  }
  return false;
}

/** @param {HTMLElement} element @param {FitInspection} report
 * @param {Window & typeof globalThis} win @param {boolean} allowTruncation @param {boolean} includeAncestors */
function inspectPresentation(element, report, win, allowTruncation, includeAncestors) {
  const { layout } = report;
  if (!layout.contentBox || !layout.textBounds || layout.requiredHeight === null) return;
  const css = win.getComputedStyle(element);
  const scale = { x: report.coordinates.scaleX, y: report.coordinates.scaleY, valid: true };
  const tolerance = report.unwrapped.tolerance;
  /** @type {Rect} */
  const flow = { x: layout.textBounds.x, width: layout.textBounds.width,
    y: layout.contentBox.y, height: layout.requiredHeight };
  const ellipsis = !!layout.overflowX && css.textOverflow.includes('ellipsis') && ['hidden', 'clip'].includes(css.overflowX);
  const clamp = !!layout.overflowY && Number.parseInt(css.webkitLineClamp) > 0;
  let ancestorClip = false, clipped = false, scrollable = false;
  for (let node = /** @type {HTMLElement | null} */ (element); node; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    const rect = rectData(node.getBoundingClientRect(), scale);
    const own = effectiveScale(node, win);
    const sx = own.x / scale.x, sy = own.y / scale.y;
    const edges = usedEdges(node, win);
    const px = (/** @type {'left' | 'right' | 'top' | 'bottom'} */ side) => edges[side];
    const boundary = { x: rect.x + px('left') * sx, y: rect.y + px('top') * sy,
      width: rect.width - (px('left') + px('right')) * sx,
      height: rect.height - (px('top') + px('bottom')) * sy };
    const overflow = outside(flow, boundary);
    const affectedX = overflow.left > tolerance || overflow.right > tolerance;
    const affectedY = overflow.top > tolerance || overflow.bottom > tolerance;
    const controlClipped = node === element && report.control?.source === 'placeholder' && (!!layout.overflowX || !!layout.overflowY);
    const cuts = controlClipped || (affectedX && ['hidden', 'clip'].includes(style.overflowX)) || (affectedY && ['hidden', 'clip'].includes(style.overflowY)) || (node === element && clamp);
    const scrolls = (node === element && !!report.control && !controlClipped && (!!layout.overflowX || !!layout.overflowY)) ||
      (affectedX && ['auto', 'scroll'].includes(style.overflowX)) || (affectedY && ['auto', 'scroll'].includes(style.overflowY));
    if (cuts || scrolls) {
      report.presentation.clippedBy.push({ element: node.tagName.toLowerCase() + (node.id ? `#${node.id}` : ''),
        kind: cuts ? 'clip' : 'scroll', rect: boundary, overflow });
      clipped ||= cuts; scrollable ||= scrolls; ancestorClip ||= cuts && node !== element;
    }
    if (!includeAncestors) break;
  }
  const deliberatelyTruncated = (ellipsis || clamp) && (!layout.overflowX || ellipsis) && (!layout.overflowY || clamp);
  report.presentation.status = ancestorClip ? 'clipped' : deliberatelyTruncated ? 'truncated' : clipped ? 'clipped' : scrollable ? 'scrollable' :
    layout.status === 'overflow' ? 'overflow' : 'full';
  report.accepted = (layout.status === 'fits' && report.presentation.status === 'full') ||
    (allowTruncation && report.presentation.status === 'truncated' && report.placement.status !== 'overflow' &&
      checkWidth(Math.min(layout.contentBox.width, layout.textBounds.width), report.unwrapped).status === 'fits');
}

/** Build a text-only measurement tree; no scripts, URLs, IDs or event handlers
 * are cloned. Computed typography preserves inline spans and inherited styles.
 * @param {Element} source @param {Window & typeof globalThis} win
 * @returns {HTMLElement}
 */
function textClone(source, win) {
  const clone = source.ownerDocument.createElement('div');
  const style = win.getComputedStyle(source);
  copyStyle(clone, style);
  if (source instanceof win.HTMLInputElement || source instanceof win.HTMLTextAreaElement) {
    const text = source.value || source.placeholder;
    if (!source.value && source.placeholder) {
      const placeholder = win.getComputedStyle(source, '::placeholder');
      for (const property of typography) clone.style.setProperty(property, placeholder.getPropertyValue(property), 'important');
    }
    clone.style.setProperty('white-space', source instanceof win.HTMLInputElement ? 'pre' : style.whiteSpace, 'important');
    clone.textContent = text + ((!text || text.endsWith('\n')) ? '\u200b' : '');
    return clone;
  }
  if (source.matches('img,svg')) {
    const rect = rectData(source.getBoundingClientRect(), effectiveScale(source, win));
    for (const [property, value] of Object.entries({ display: 'inline-block', boxSizing: 'border-box', width: `${rect.width}px`, height: `${rect.height}px` })) {
      clone.style.setProperty(property.replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`), value, 'important');
    }
    return clone; // An inert box: never duplicate src, href, SVG use or image URLs.
  }
  // Preserve unitless line-height when available. Serializing 1.4 to 22.4px
  // can round differently in Blink and falsely add 1/64px on every line.
  const typed = /** @type {HTMLElement & {computedStyleMap?: () => {get: (name: string) => {toString(): string} | undefined}}} */ (source).computedStyleMap?.().get('line-height');
  if (typed) clone.style.setProperty('line-height', typed.toString(), 'important');
  else if (source instanceof win.HTMLElement && /^[\d.]+$/.test(source.style.lineHeight)) clone.style.setProperty('line-height', source.style.lineHeight, 'important');
  if (!['inline-block', 'inline-flex', 'inline-grid'].includes(style.display)) {
    clone.style.setProperty('width', 'auto', 'important');
    clone.style.setProperty('height', 'auto', 'important');
  }
  clone.lang = source.closest('[lang]')?.getAttribute('lang') ?? source.ownerDocument.documentElement.lang;
  const appendPseudo = (/** @type {string} */ pseudo) => {
    const css = win.getComputedStyle(source, pseudo);
    if (['none', 'normal', ''].includes(css.content) || css.display === 'none') return;
    const span = source.ownerDocument.createElement('span');
    copyStyle(span, css); span.textContent = pseudoText(css);
    span.dataset.fontFitGenerated = 'true'; clone.append(span);
  };
  appendPseudo('::before');
  for (const node of source.childNodes) {
    if (node.nodeType === 3) clone.append(source.ownerDocument.createTextNode(node.textContent ?? ''));
    else if (node instanceof win.Element) {
      if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(node.tagName)) continue;
      if (node.tagName === 'BR' || node.tagName === 'WBR') clone.append(source.ownerDocument.createElement(node.tagName));
      else clone.append(textClone(node, win));
    }
  }
  appendPseudo('::after');
  return clone;
}

/** @param {string} value */
function familyName(value) { return value.trim().replace(/^(['"])(.*)\1$/, '$2').toLowerCase(); }

/** @param {Element} node @param {Window & typeof globalThis} win */
function fontSample(node, win) {
  if (node instanceof win.HTMLInputElement) return node.type === 'password' ? ' ' : node.value || node.placeholder || ' ';
  if (node instanceof win.HTMLTextAreaElement) return node.value || node.placeholder || ' ';
  return node.textContent || ' ';
}

/** @param {string} value */
function families(value) { return (value.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,]+/g) ?? []).map(familyName); }

/** Registration/loading diagnostics, never an assertion of per-glyph coverage.
 * @param {HTMLElement} element @param {string[]} required
 * @returns {Promise<import('./types.js').FontDiagnostics>}
 */
async function inspectFonts(element, required) {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('Element has no browsing context');
  /** @type {import('./types.js').FontDiagnostics} */
  const result = { status: 'ready', glyphCoverage: 'unverified', faces: [], issues: [] };
  const requested = new Set();
  const requests = new Map();
  for (const node of [element, ...element.querySelectorAll('*')]) {
    const css = win.getComputedStyle(node);
    if (css.display === 'none') continue;
    const names = families(css.fontFamily);
    for (const family of names) requested.add(family);
    const font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    requests.set(font, { text: fontSample(node, win), names });
  }
  for (const family of required) {
    const name = familyName(family);
    if (!requested.has(name)) result.issues.push({ family, reason: 'not-requested' });
    else if (![...doc.fonts].some(face => familyName(face.family) === name)) result.issues.push({ family, reason: 'unregistered' });
  }
  for (const [font, request] of requests) {
    try { await doc.fonts.load(font, request.text); }
    catch {
      for (const face of doc.fonts) if (face.status === 'error' && request.names.includes(familyName(face.family))) {
        if (!result.issues.some(issue => familyName(issue.family) === familyName(face.family) && issue.reason === 'load-failed')) {
          result.issues.push({ family: face.family.replace(/^(['"])(.*)\1$/, '$2'), reason: 'load-failed' });
        }
      }
    }
  }
  await doc.fonts.ready;
  for (const face of doc.fonts) if (requested.has(familyName(face.family))) {
    result.faces.push({ family: face.family.replace(/^(['"])(.*)\1$/, '$2'), weight: face.weight, style: face.style, status: face.status });
  }
  result.status = result.issues.length ? 'error' : 'ready';
  return result;
}

/** Inspect an existing, laid-out text element after web fonts have loaded.
 * Limits check text width; the layout check uses the element's current content
 * box, wrapping and height. This function does not resize the source element.
 * @param {HTMLElement} element @param {import('./types.js').FitOptions} [limits]
 * @returns {Promise<FitInspection>}
 */
export async function inspectTextFit(element, limits = {}) {
  return inspectFit(element, limits, true);
}

/** @param {HTMLElement} element @param {import('./types.js').FitOptions} limits @param {boolean} includeAncestors
 * @returns {Promise<FitInspection>} */
async function inspectFit(element, limits, includeAncestors) {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('Element has no browsing context');
  element.getBoundingClientRect(); // Initiate font/layout work before awaiting readiness.
  const fonts = await inspectFonts(element, limits.requiredFonts ?? []);
  const computed = win.getComputedStyle(element);
  const control = element instanceof win.HTMLInputElement || element instanceof win.HTMLTextAreaElement ? element : null;
  const style = Object.fromEntries(typography.map(property => [property, computed.getPropertyValue(property)]));
  const scale = effectiveScale(element, win);
  const contentBox = contentRect(element, win, scale);
  const maxWidth = limits.maxWidth ?? contentBox.width;
  const check = checkWidth(0, { ...limits, maxWidth });
  /** @type {FitInspection} */
  const report = {
    measurable: element.isConnected && element.getClientRects().length > 0,
    basis: 'layout', intrinsic: { minContentWidth: null, maxContentWidth: null },
    coordinates: { space: 'normalized-viewport', scaleX: scale.x, scaleY: scale.y },
    fonts,
    placement: { status: 'unconstrained', container: null, overflow: null },
    presentation: { status: 'unknown', clippedBy: [] }, accepted: null,
    control: null,
    unwrapped: { ...check, width: null, status: 'unmeasurable' },
    layout: { status: 'unmeasurable', overflowX: null, overflowY: null, clipped: null,
      requiredHeight: null, contentBox: null, textBounds: null, fragments: [], overflow: null },
    style, reasons: [],
  };
  if (!report.measurable) {
    report.reasons.push('Element is detached or has no layout box');
    return report;
  }
  if (fonts.status === 'error') {
    report.accepted = false;
    report.unwrapped.status = report.layout.status = 'font-error';
    report.reasons.push('Requested web fonts are missing or failed to load');
    return report;
  }
  // Range rectangles and intrinsic text clones cannot faithfully represent these
  // contexts. Return an explicit unsupported result instead of a false fit.
  if (!scale.valid) report.reasons.push('Rotation, skew, reflection or 3D transforms are outside axis-aligned inspection');
  if (control && !(control instanceof win.HTMLTextAreaElement) && !['text', 'email', 'url', 'tel'].includes(control.type)) {
    report.reasons.push('This input type has hidden text or browser-specific decorations');
  }
  if (element.matches('canvas,video,iframe,select') || element.querySelector('canvas,video,iframe,input,textarea,select') || element.shadowRoot) {
    report.reasons.push('Replaced elements or shadow content are outside text-only inspection');
  }
  if (computed.writingMode !== 'horizontal-tb' || computed.columnCount !== 'auto' || computed.columnWidth !== 'auto') {
    report.reasons.push('Vertical writing and multicolumn layout require separate flow geometry');
  }
  for (const node of [element, ...element.querySelectorAll('*')]) {
    if (node !== element && node.closest('svg') && node.tagName.toLowerCase() !== 'svg') continue;
    const css = win.getComputedStyle(node);
    if (node.shadowRoot) report.reasons.push('Shadow content is outside text-only inspection');
    if (node !== element && (css.transform !== 'none' || (css.zoom && Number.parseFloat(css.zoom) !== 1) || (css.scale && css.scale !== 'none') || (css.rotate && css.rotate !== 'none') || (css.translate && css.translate !== 'none'))) report.reasons.push('Transformed descendants require a separate coordinate-space policy');
    if (node !== element && css.position !== 'static') report.reasons.push('Positioned descendants require a separate flow geometry policy');
    if (node !== element && !['inline', 'inline-block', 'inline-flex', 'inline-grid', 'none', 'contents'].includes(css.display) && !['BR', 'WBR'].includes(node.tagName) && !insideAtomicFlow(node, element, win)) report.reasons.push('Non-inline descendants require a separate layout policy');
    for (const pseudo of node.matches('img,svg,input,textarea') ? [] : ['::before', '::after']) {
      const generated = win.getComputedStyle(node, pseudo);
      if (generated.display !== 'none' && !['none', 'normal', ''].includes(generated.content) &&
        (pseudoText(generated) === null || generated.position !== 'static')) report.reasons.push('Non-string or positioned pseudo content is outside flow inspection');
    }
  }
  for (const image of element.querySelectorAll('img')) {
    try { await image.decode(); }
    catch { report.reasons.push('An inline image failed to decode'); }
  }
  if (report.reasons.length) {
    report.unwrapped.status = report.layout.status = 'unsupported';
    return report;
  }
  report.placement = inspectPlacement(element, win, check.tolerance, scale);
  if (control) report.control = { kind: control instanceof win.HTMLInputElement ? 'input' : 'textarea',
    source: control.value ? 'value' : control.placeholder ? 'placeholder' : 'empty', textLength: (control.value || control.placeholder).length };
  const walker = doc.createTreeWalker(element, 5); // SHOW_ELEMENT | SHOW_TEXT
  const range = doc.createRange();
  /** @type {Rect[]} */
  const fragments = [];
  for (let node = control ? null : walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 3) range.selectNodeContents(node);
    else if (node.nodeName === 'BR') range.selectNode(node);
    else if (node instanceof win.Element && (node.matches('img,svg') || ['inline-block', 'inline-flex', 'inline-grid'].includes(win.getComputedStyle(node).display))) {
      fragments.push(rectData(node.getBoundingClientRect(), scale)); continue;
    }
    else continue;
    for (const part of range.getClientRects()) if (part.height || part.width) fragments.push(rectData(part, scale));
  }
  const probe = textClone(element, win);
  for (const [name, value] of Object.entries({
    position: 'absolute', left: '-100000px', top: '0', visibility: 'hidden',
    display: ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(computed.display) ? computed.display : 'block', width: 'max-content', minWidth: '0', maxWidth: 'none',
    height: 'auto', minHeight: '0', maxHeight: 'none', padding: '0', border: '0', margin: '0',
  })) probe.style.setProperty(name.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`), value, 'important');
  const host = mountProbe(probe, element, win);
  const probeScale = effectiveScale(probe, win);
  let requiredHeight = 0;
  try {
    const maxContentWidth = probe.getBoundingClientRect().width / probeScale.x;
    probe.style.setProperty('width', 'min-content', 'important');
    const minContentWidth = probe.getBoundingClientRect().width / probeScale.x;
    report.intrinsic = { minContentWidth, maxContentWidth };
    report.unwrapped = checkWidth(maxContentWidth, { ...limits, maxWidth });
    // Range rectangles cover font em boxes, which can exceed CSS line-height
    // even when the line boxes fit. Reflow the same styled text at the actual
    // content width to measure required line-box height without fixed clipping.
    probe.style.setProperty('width', `${contentBox.width}px`, 'important');
    requiredHeight = probe.getBoundingClientRect().height / probeScale.y;
    if (control) {
      const origin = rectData(probe.getBoundingClientRect(), probeScale);
      range.selectNodeContents(probe);
      for (const raw of range.getClientRects()) if (raw.width || raw.height) {
        const part = rectData(raw, probeScale);
        fragments.push({ x: contentBox.x + part.x - origin.x - control.scrollLeft,
          y: contentBox.y + part.y - origin.y - control.scrollTop, width: part.width, height: part.height });
      }
    }
  } finally { host.remove(); }
  // Inline elements share their parent's line boxes and do not constrain
  // height. Rebuilding them as a block would compare line-height with their
  // native em rectangle and falsely report vertical overflow.
  if (computed.display === 'inline') requiredHeight = contentBox.height;
  let left = contentBox.x, top = contentBox.y, right = left, bottom = top;
  if (fragments.length) {
    left = top = Infinity; right = bottom = -Infinity;
    for (const part of fragments) {
      left = Math.min(left, part.x); top = Math.min(top, part.y);
      right = Math.max(right, part.x + part.width); bottom = Math.max(bottom, part.y + part.height);
    }
  }
  const overflow = { left: Math.max(0, contentBox.x - left), right: Math.max(0, right - contentBox.x - contentBox.width),
    top: 0, bottom: Math.max(0, requiredHeight - contentBox.height) };
  const overflowX = overflow.left > check.tolerance || overflow.right > check.tolerance ||
    (computed.display !== 'inline' && element.scrollWidth > element.clientWidth + 1);
  const overflowY = overflow.bottom > check.tolerance || (control instanceof win.HTMLTextAreaElement && control.scrollHeight > control.clientHeight + 1);
  report.layout = {
    status: overflowX || overflowY || report.placement.status === 'overflow' ? 'overflow' : checkWidth(Math.max(0, right - left), { ...limits, maxWidth }).status,
    overflowX, overflowY,
    clipped: (overflowX && ['hidden', 'clip', 'scroll', 'auto'].includes(computed.overflowX)) ||
      (overflowY && (['hidden', 'clip', 'scroll', 'auto'].includes(computed.overflowY) || Number.parseInt(computed.webkitLineClamp) > 0)),
    requiredHeight, contentBox, textBounds: { x: left, y: top, width: right - left, height: bottom - top },
    fragments, overflow,
  };
  inspectPresentation(element, report, win, limits.allowTruncation ?? false, includeAncestors);
  return report;
}
