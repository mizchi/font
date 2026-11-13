import { expect, test } from '@playwright/test';
import type { FontMeasurement } from '../../browser/types.js';

async function measure(page: import('@playwright/test').Page, text: string, fontSize = 13.25,
  options = {}, file = 'NotoSansMono-Regular.ttf'): Promise<FontMeasurement> {
  await page.goto('/');
  return page.evaluate(async ({ text, fontSize, options, file }) => {
    const { loadFont } = await import(new URL('/browser/font.js', location.href).href) as typeof import('../../browser/font.js');
    const font = await loadFont(`/fixtures/${file}`);
    try { return font.measure(text, fontSize, options); }
    finally { font.dispose(); }
  }, { text, fontSize, options, file });
}

for (const file of ['NotoSansMono-Regular.ttf', 'NotoSansMono-Regular.woff', 'NotoSansMono-Regular.woff2']) {
  test(`${file}: subpixel advance matches Canvas and DOM`, async ({ page }, info) => {
    const result = await measure(page, 'Hello Ag 123', 13.25, {}, file);
    expect(result.missingCodepoints).toEqual([]);
    expect(Math.abs(result.widthDelta)).toBeLessThan(0.02);
    expect(Math.abs(result.dom.textBounds.width - result.canvas.advanceWidth)).toBeLessThan(0.05);
    expect(result.moonbit.glyphs).toHaveLength(12);
    const ink = result.moonbit.ink_bounds!;
    // Chromium's hinted glyph bounds may differ by up to two CSS pixels.
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(ink[key] - result.canvas.inkBounds[key])).toBeLessThan(2);
    }
    await info.attach('metrics.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  });
}

test('empty text and spaces have advance but no ink', async ({ page }) => {
  const empty = await measure(page, '');
  expect(empty.moonbit.advance_width).toBe(0);
  expect(empty.moonbit.ink_bounds).toBeNull();
  expect(empty.dom.graphemes).toEqual([]);
  const spaces = await measure(page, '  ');
  expect(spaces.moonbit.ink_bounds).toBeNull();
  expect(spaces.moonbit.advance_width).toBeGreaterThan(0);
  expect(Math.abs(spaces.widthDelta)).toBeLessThan(0.02);
});

test('CFF outlines match browser ink bounds', async ({ page }) => {
  const result = await measure(page, 'Ag', 100, {}, 'NotoSans-subset.otf');
  expect(result.moonbit.ink_bounds).not.toBeNull();
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(result.moonbit.ink_bounds![key] - result.canvas.inkBounds[key])).toBeLessThan(2);
  }
  expect(Math.abs(result.widthDelta)).toBeLessThan(0.02);
});

test('legacy kerning agrees with browser shaping', async ({ page }) => {
  const result = await measure(page, 'AV', 100, {}, 'minimal-kern.ttf');
  expect(result.moonbit.advance_width).toBe(112);
  expect(result.moonbit.glyphs[1].x).toBe(52);
  expect(Math.abs(result.widthDelta)).toBeLessThan(0.02);
});

test('UTF-16 ranges preserve a non-BMP character', async ({ page }) => {
  const result = await measure(page, 'A\u{10780}V');
  expect(result.missingCodepoints).toEqual([]);
  expect(result.moonbit.glyphs.map(g => [g.text_start, g.text_end])).toEqual([[0, 1], [1, 3], [3, 4]]);
  expect(result.dom.graphemes.map(g => [g.start, g.end])).toEqual([[0, 1], [1, 3], [3, 4]]);
  expect(Math.abs(result.widthDelta)).toBeLessThan(0.02);
});

test('DOM reports wrapped line and grapheme rectangles', async ({ page }) => {
  const result = await measure(page, 'Hello world again', 20, { maxWidth: 70, lineHeight: 30 });
  expect(result.dom.bounds.width).toBe(70);
  expect(result.dom.bounds.height).toBeGreaterThanOrEqual(90);
  expect(new Set(result.dom.lineRects.map(r => r.y)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(result.dom.graphemes.flatMap(g => g.rects.map(r => r.y))).size).toBeGreaterThanOrEqual(3);
});

test('missing glyphs are reported rather than silently compared as fallback', async ({ page }) => {
  const result = await measure(page, 'A\u{1F600}');
  expect(result.missingCodepoints).toEqual([0x1F600]);
});

test('multiple font handles retain their own metrics and reject invalid input', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { loadFont } = await import(new URL('/browser/font.js', location.href).href) as typeof import('../../browser/font.js');
    const regular = await loadFont('/fixtures/NotoSansMono-Regular.ttf');
    const bold = await loadFont('/fixtures/NotoSansMono-Bold.ttf');
    const before = regular.measure('Ag', 16);
    const other = bold.measure('Ag', 16);
    const after = regular.measure('Ag', 16);
    let invalidSize = false;
    let invalidWidth = false;
    try { regular.measure('A', Number.NaN); } catch { invalidSize = true; }
    try { regular.measure('A', 16, { maxWidth: -1 }); } catch { invalidWidth = true; }
    regular.dispose(); bold.dispose();
    let disposed = false;
    try { regular.measure('A', 16); } catch { disposed = true; }
    return { before, other, after, invalidSize, invalidWidth, disposed };
  });
  expect(result.before).toEqual(result.after);
  expect(result.other.moonbit.ink_bounds).not.toEqual(result.before.moonbit.ink_bounds);
  expect(result.invalidSize && result.invalidWidth && result.disposed).toBe(true);
});

test('invalid font bytes clear the raw binding and loading fails explicitly', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const raw = await import(new URL('/_build/js/release/build/js/js.js', location.href).href) as typeof import('../../_build/js/release/build/js/js.js');
    const bytes = new Uint8Array(await (await fetch('/fixtures/NotoSansMono-Regular.ttf')).arrayBuffer());
    raw.loadFont(bytes);
    raw.loadFont(new Uint8Array(4));
    const { loadFont } = await import(new URL('/browser/font.js', location.href).href) as typeof import('../../browser/font.js');
    let rejected = false;
    try { await loadFont('/missing.ttf'); } catch { rejected = true; }
    return { bounds: raw.layoutTextBounds('A', 16), rejected };
  });
  expect(result).toEqual({ bounds: 'null', rejected: true });
});

for (const file of ['shaping.ttf', 'shaping.woff']) {
  test(`${file}: GSUB ligatures, contextual substitutions and GPOS agree with browser`, async ({ page }, info) => {
    for (const text of ['fi', 'office', 'AV', 'oe', 'oc', 'A\u0301']) {
      const result = await measure(page, text, 50, {}, file);
      expect(result.missingCodepoints).toEqual([]);
      expect(Math.abs(result.widthDelta), text).toBeLessThan(0.02);
      expect(Math.abs(result.dom.textBounds.width - result.canvas.advanceWidth), text).toBeLessThan(0.05);
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(result.moonbit.ink_bounds![key] - result.canvas.inkBounds[key]), `${text}: ${key}`).toBeLessThan(2);
      }
      if (text === 'fi') {
        expect(result.moonbit.glyphs).toHaveLength(1);
        expect(result.moonbit.glyphs[0].text_end).toBe(2);
      }
      await info.attach(`${text.codePointAt(0)}-${text.length}.json`, {
        body: JSON.stringify(result, null, 2), contentType: 'application/json',
      });
    }
  });
}

test('feature switches apply equally to MoonBit, Canvas and DOM', async ({ page }) => {
  const result = await measure(page, 'fi AV', 100, { ligatures: false, kerning: false }, 'shaping.ttf');
  expect(result.moonbit.glyphs).toHaveLength(5);
  expect(result.moonbit.advance_width).toBe(270);
  expect(Math.abs(result.widthDelta)).toBeLessThan(0.02);
  expect(Math.abs(result.dom.textBounds.width - 270)).toBeLessThan(0.02);
});

for (const direction of ['auto', 'ltr', 'rtl'] as const) {
  test(`BiDi ${direction}: Hebrew, numbers, brackets and isolates retain their visual rectangles`, async ({ page }, info) => {
    for (const text of ['A אבג 123', 'אבג (123) A', 'A \u2067אבג\u2069 V', 'א\u0301ב']) {
      const result = await measure(page, text, 50, { direction }, 'shaping.ttf');
      expect(Math.abs(result.widthDelta), text).toBeLessThan(0.02);
      expect(result.missingCodepoints).toEqual([]);
      for (const glyph of result.moonbit.glyphs) {
        // Compare one-character clusters with browser Range rectangles; combining
        // marks use a shared cluster and are checked by the union of ink bounds.
        if (glyph.text_end - glyph.text_start !== 1) continue;
        const dom = result.dom.graphemes.find(g => g.start === glyph.text_start)!;
        expect(dom, `${text}: ${glyph.text_start}`).toBeDefined();
        expect(Math.abs(dom.rects[0].x - glyph.x), `${text}: ${glyph.text_start}`).toBeLessThan(0.05);
      }
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(result.moonbit.ink_bounds![key] - result.canvas.inkBounds[key]), `${text}: ${key}`).toBeLessThan(2);
      }
      await info.attach(`bidi-${text.codePointAt(0)}-${text.length}.json`, {
        body: JSON.stringify(result, null, 2), contentType: 'application/json',
      });
    }
  });
}

test('Arabic joining matches browser-shaped ink and advance', async ({ page }) => {
  const result = await measure(page, 'ببب', 100, { direction: 'rtl', language: 'ar' }, 'shaping.ttf');
  expect(result.shaping.direction).toBe('rtl');
  expect(result.moonbit.glyphs.map(g => g.text_start)).toEqual([2, 1, 0]);
  expect(Math.abs(result.widthDelta)).toBeLessThan(0.02);
  expect(Math.abs(result.moonbit.ink_bounds!.height - result.canvas.inkBounds.height)).toBeLessThan(2);
});

test('shaping errors are explicit and do not return partial metrics', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const raw = await import(new URL('/_build/js/release/build/js/js.js', location.href).href) as typeof import('../../_build/js/release/build/js/js.js');
    const initial = JSON.parse(raw.shapeText('fi', 16, 'ltr', 'und', true, true));
    const bytes = new Uint8Array(await (await fetch('/fixtures/shaping.ttf')).arrayBuffer());
    raw.loadFont(bytes);
    return [initial,
      JSON.parse(raw.shapeText('fi', -1, 'ltr', 'und', true, true)),
      JSON.parse(raw.shapeText('fi', 16, 'invalid', 'und', true, true)),
      JSON.parse(raw.shapeText('A\nV', 16, 'ltr', 'und', true, true))];
  });
  expect(result.every(r => r.ok === false && r.error.code)).toBeTruthy();
});

const referenceCases = [
  { font: 'serif', texts: ['office AV', 'a\u0301g', '1/2'] },
  { font: 'hebrew', texts: ['שלום', 'שָׁלוֹם'] },
  { font: 'arabic', texts: ['سلام', 'العربية', 'بِسْمِ', 'ببب'] },
];
for (const { font, texts } of referenceCases) {
  test(`Noto ${font}: real GSUB/GPOS tables agree with Chromium`, async ({ page }, info) => {
    for (const text of texts) {
      const result = await measure(page, text, 32, {}, `shaping-reference/${font}.ttf`);
      expect(result.missingCodepoints).toEqual([]);
      expect(Math.abs(result.widthDelta), text).toBeLessThan(0.02);
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(result.moonbit.ink_bounds![key] - result.canvas.inkBounds[key]), `${text}: ${key}`).toBeLessThan(2);
      }
      await info.attach(`${font}-${text.length}.json`, {
        body: JSON.stringify(result, null, 2), contentType: 'application/json',
      });
    }
  });
}

for (const fontWeight of [100, 400, 700, 900]) {
  test(`variable Roboto weight ${fontWeight} matches browser advances and outlines`, async ({ page }) => {
    for (const size of [13.25, 24, 32]) {
      const result = await measure(page, 'Hello world office AV 123', size, { fontWeight }, 'shaping-reference/roboto-variable.ttf');
      expect(result.missingCodepoints).toEqual([]);
      expect(result.shaping.variations.wght).toBe(fontWeight);
      expect(Math.abs(result.widthDelta)).toBeLessThan(0.05);
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(result.moonbit.ink_bounds![key] - result.canvas.inkBounds[key])).toBeLessThan(2);
      }
    }
  });
}

for (const file of ['serif-bold', 'serif-italic']) {
  test(`static ${file} uses real face descriptors`, async ({ page }) => {
    const result = await measure(page, 'office AV', 32, {}, `shaping-reference/${file}.ttf`);
    expect(Math.abs(result.widthDelta)).toBeLessThan(0.05);
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(result.moonbit.ink_bounds![key] - result.canvas.inkBounds[key])).toBeLessThan(2);
    }
  });
}

test('explicit width and optical-size axes agree with browser advances', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { loadFont } = await import(new URL('/browser/font.js', location.href).href) as typeof import('../../browser/font.js');
    const font = await loadFont('/fixtures/shaping-reference/robotoserif-variable.ttf');
    try {
      const results = [];
      const instances: Record<string, number>[] = [{ wdth: 75, opsz: 8 }, { wdth: 100, opsz: 144 }, { wdth: 75, opsz: 8, wght: 900 }];
      for (const axisValues of instances) {
        results.push(await font.measureWithAxes('Hello world office AV', 32, { fontWeight: 400, axisValues }));
      }
      results.push(await font.measureWithAxes('Hello world office AV', 32, { fontStretch: 75 }));
      return results;
    } finally { font.dispose(); }
  });
  for (const result of results) {
    expect(Math.abs(result.widthDelta)).toBeLessThan(0.05);
    expect(Math.abs(result.dom.textBounds.width - result.moonbit.advance_width)).toBeLessThan(0.05);
  }
  expect(results[0].shaping.variations.opsz).toBe(8);
  expect(results.map(result => result.shaping.variations.wdth)).toEqual([75, 100, 75, 75]);
  expect(results[1].shaping.variations.opsz).toBe(144);
  expect(results[2].shaping.variations.wght).toBe(900);
  expect(results[3].shaping.variations.wdth).toBe(75);
});

test('variation input rejects malformed contracts and releases instance faces', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const raw = await import(new URL('/_build/js/release/build/js/js.js', location.href).href) as typeof import('../../_build/js/release/build/js/js.js');
    const { loadFont } = await import(new URL('/browser/font.js', location.href).href) as typeof import('../../browser/font.js');
    const before = document.fonts.size;
    const font = await loadFont('/fixtures/shaping-reference/robotoserif-variable.ttf');
    try {
      const invalid = ['[]', '{"wdth":"wide"}', '{', '{"xxxx":3}'].map(axes => JSON.parse(raw.shapeTextWithAxes('Hello', 32, 'auto', 'und', true, true, 400, axes)));
      let rejected = false;
      try { await font.measureWithAxes('Hello', 32, { axisValues: { xxxx: 1 } }); } catch { rejected = true; }
      const base = font.measure('Hello world', 32);
      await Promise.all([font.measureWithAxes('Hello', 32, { axisValues: { wdth: 75 } }), font.measureWithAxes('Hello', 32, { axisValues: { wdth: 75 } })]);
      font.dispose();
      return { invalid, rejected, released: document.fonts.size === before, baseDelta: base.widthDelta };
    } finally { font.dispose(); }
  });
  expect(result.invalid.every(value => value.ok === false && typeof value.error.message === 'string')).toBe(true);
  expect(result.rejected && result.released).toBe(true);
  expect(Math.abs(result.baseDelta)).toBeLessThan(0.05);
});
