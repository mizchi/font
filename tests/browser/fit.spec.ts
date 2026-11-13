import { expect, test } from '@playwright/test';
import type { FitInspection } from '../../browser/types.js';

async function inspect(page: import('@playwright/test').Page, text: string,
  style: Record<string, string> = {}, limits = {}): Promise<FitInspection> {
  await page.goto('/');
  return page.evaluate(async ({ text, style, limits }) => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const font = await new FontFace('FitTest', 'url(/fixtures/shaping-reference/serif.ttf)').load();
    document.fonts.add(font);
    const box = document.createElement('div');
    Object.assign(box.style, { width: '120px', font: '20px FitTest', lineHeight: '24px', ...style });
    box.textContent = text;
    document.body.append(box);
    return inspectTextFit(box, limits);
  }, { text, style, limits });
}

test('single-line range detects exact fit, underflow and overflow', async ({ page }) => {
  const result = await inspect(page, 'office AV', { whiteSpace: 'nowrap' });
  const width = result.intrinsic.maxContentWidth!;
  const exact = await inspect(page, 'office AV', { whiteSpace: 'nowrap' }, { minWidth: width, maxWidth: width });
  expect(exact.unwrapped.status).toBe('fits');
  const below = await inspect(page, 'office AV', {}, { minWidth: width + 1, maxWidth: width + 10 });
  expect(below.unwrapped.status).toBe('underflow');
  const above = await inspect(page, 'office AV', { whiteSpace: 'nowrap' }, { maxWidth: width - 1 });
  expect(above.unwrapped.status).toBe('overflow');
});

test('wrapping fits while the unwrapped width exceeds the limit', async ({ page }) => {
  const result = await inspect(page, 'office AV office AV', { width: '100px', whiteSpace: 'normal' });
  expect(result.unwrapped.status).toBe('overflow');
  expect(result.layout.status).toBe('fits');
  expect(result.layout.overflowX).toBe(false);
  expect(result.layout.overflowY).toBe(false);
  expect(result.intrinsic.minContentWidth!).toBeLessThan(result.intrinsic.maxContentWidth!);
});

test('long words, constrained height and ellipsis report overflow', async ({ page }) => {
  const word = await inspect(page, 'officeofficeoffice', { width: '50px', overflowWrap: 'normal' });
  expect(word.layout.overflowX).toBe(true);
  const clipped = await inspect(page, 'office AV office AV', { width: '80px', height: '24px', overflow: 'hidden' });
  expect(clipped.layout.overflowY).toBe(true);
  expect(clipped.layout.clipped).toBe(true);
  const ellipsis = await inspect(page, 'office AV office AV', {
    width: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  });
  expect(ellipsis.layout.status).toBe('overflow');
  expect(ellipsis.layout.clipped).toBe(true);
});

test('break rules, whitespace, padding and borders use actual browser geometry', async ({ page }) => {
  const broken = await inspect(page, 'officeofficeoffice', {
    width: '50px', overflowWrap: 'anywhere', padding: '8px', border: '2px solid', boxSizing: 'content-box',
  });
  expect(broken.layout.status).toBe('fits');
  expect(broken.layout.contentBox!.width).toBeCloseTo(50, 2);
  const pre = await inspect(page, 'office\nAV', { whiteSpace: 'pre', height: '24px', overflow: 'hidden' });
  expect(pre.layout.overflowY).toBe(true);
  const nowrap = await inspect(page, 'officeofficeoffice', { width: '50px', whiteSpace: 'nowrap' });
  expect(nowrap.layout.overflowX).toBe(true);
});

test('unmeasurable elements do not return a false fit', async ({ page }) => {
  const result = await inspect(page, 'office', { display: 'none' });
  expect(result.layout.status).toBe('unmeasurable');
});

test('inspection does not change the element or leak measurement nodes', async ({ page }) => {
  await inspect(page, 'office AV');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const element = document.body.firstElementChild as HTMLElement;
    const before = element.outerHTML;
    const count = document.body.childElementCount;
    await inspectTextFit(element);
    return { unchanged: before === element.outerHTML, count, after: document.body.childElementCount };
  });
  expect(result.unchanged).toBe(true);
  expect(result.after).toBe(result.count);
});

test('actual CSS font-weight selection can change the fit result', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    for (const [file, weight] of [['serif', '400'], ['serif-bold', '700']]) {
      document.fonts.add(await new FontFace('FitFamily', `url(/fixtures/shaping-reference/${file}.ttf)`, { weight }).load());
    }
    const box = document.createElement('div');
    Object.assign(box.style, { width: '500px', font: '32px FitFamily', lineHeight: '48px', whiteSpace: 'nowrap' });
    box.textContent = 'office AV'; document.body.append(box);
    const regular = await inspectTextFit(box);
    box.style.fontWeight = '700';
    const bold = await inspectTextFit(box);
    const maxWidth = (regular.intrinsic.maxContentWidth! + bold.intrinsic.maxContentWidth!) / 2;
    const boldFit = await inspectTextFit(box, { maxWidth });
    box.style.fontWeight = '400';
    const regularFit = await inspectTextFit(box, { maxWidth });
    return { regularFit, boldFit };
  });
  expect(result.regularFit.unwrapped.status).toBe('fits');
  expect(result.boldFit.unwrapped.status).toBe('overflow');
  expect(result.boldFit.style['font-weight']).toBe('700');
});

test('Japanese line breaking, spacing and variable weight use the real CSS layout', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    document.fonts.add(await new FontFace('FitJapanese', 'url(/fixtures/shaping-reference/japanese-variable.ttf)', { weight: '100 900' }).load());
    const box = document.createElement('div');
    Object.assign(box.style, { width: '100px', font: '700 20px FitJapanese', lineHeight: '32px', letterSpacing: '1px' });
    box.textContent = '日本語のテキスト幅検査'; document.body.append(box);
    const normal = await inspectTextFit(box);
    box.style.wordBreak = 'keep-all';
    const keepAll = await inspectTextFit(box);
    return { normal, keepAll };
  });
  expect(result.normal.unwrapped.status).toBe('overflow');
  expect(result.normal.layout.status).toBe('fits');
  expect(result.keepAll.layout.overflowX).toBe(true);
});

test('mixed styled spans, fallback fonts and fractional sizes are preserved', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    document.fonts.add(await new FontFace('FitPrimary', 'url(/fixtures/shaping-reference/serif.ttf)').load());
    document.fonts.add(await new FontFace('FitFallback', 'url(/fixtures/shaping.ttf)').load());
    const box = document.createElement('div');
    Object.assign(box.style, { width: '200px', font: '13.25px FitPrimary, FitFallback', lineHeight: '30px', wordSpacing: '2px' });
    const strong = document.createElement('strong'); strong.textContent = 'office';
    const rest = document.createElement('span'); rest.textContent = ' AV אבג'; rest.style.fontStyle = 'italic';
    box.append(strong, rest); document.body.append(box);
    const checked = await inspectTextFit(box);
    return { checked, textWidth: (() => { const range = document.createRange(); range.selectNodeContents(box); return range.getBoundingClientRect().width; })() };
  });
  expect(result.checked.layout.status).toBe('fits');
  expect(Math.abs(result.checked.intrinsic.maxContentWidth! - result.textWidth)).toBeLessThan(0.1);
});

test('line clamp is detected and rotated contexts return unsupported', async ({ page }) => {
  const clamp = await inspect(page, 'office AV office AV office AV', {
    width: '80px', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: '1', overflow: 'hidden',
  });
  expect(clamp.layout.overflowY).toBe(true);
  expect(clamp.layout.clipped).toBe(true);
  const transformed = await inspect(page, 'office', { transform: 'rotate(5deg)' });
  expect(transformed.layout.status).toBe('unsupported');
});

test('text fit helper checks both modes and cleans up temporary layout', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const count = document.body.childElementCount;
    const checked = await checkTextFit('Hello world Hello world Hello world', {
      minWidth: 20, maxWidth: 100, maxHeight: 24,
      style: { fontSize: '20px', lineHeight: '24px', overflowWrap: 'anywhere', overflow: 'hidden' },
    });
    return { checked, leaked: count !== document.body.childElementCount };
  });
  expect(result.checked.unwrapped.status).toBe('overflow');
  expect(result.checked.layout.overflowX).toBe(false);
  expect(result.checked.layout.overflowY).toBe(true);
  expect(result.checked.layout.clipped).toBe(true);
  expect(result.leaked).toBe(false);
});

test('unsupported content and invalid CSS do not produce a false fit', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit, inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    let rejected = false;
    try { await checkTextFit('abc', { maxWidth: 100, style: { fontWeight: 'nonsense' } }); }
    catch { rejected = true; }
    const input = document.createElement('input'); input.type = 'password'; document.body.append(input);
    const checked = await inspectTextFit(input);
    const style = document.createElement('style');
    style.textContent = '.generated::before { content: ""; display: inline-block; width: 200px; }';
    const generated = document.createElement('div'); generated.className = 'generated';
    generated.textContent = 'Hello'; generated.style.width = '100px';
    document.body.append(style, generated);
    return { rejected, checked, generated: await inspectTextFit(generated) };
  });
  expect(result.rejected).toBe(true);
  expect(result.checked.layout.status).toBe('unsupported');
  expect(result.generated.layout.status).toBe('overflow');
});

test('inline padding, borders and margins contribute to intrinsic width', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const box = document.createElement('div');
    Object.assign(box.style, { width: 'max-content', font: '20px sans-serif', lineHeight: '32px' });
    const span = document.createElement('span'); span.textContent = 'Hello world';
    Object.assign(span.style, { margin: '0 12px', padding: '0 14px', border: '3px solid' });
    box.append(span); document.body.append(box);
    const expected = box.getBoundingClientRect().width;
    return { expected, checked: await inspectTextFit(box) };
  });
  expect(Math.abs(result.checked.intrinsic.maxContentWidth! - result.expected)).toBeLessThan(0.05);
  expect(result.checked.layout.status).toBe('fits');
});

test('positioned inline descendants return unsupported', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const box = document.createElement('div'); box.style.width = '100px';
    const span = document.createElement('span'); span.textContent = 'Hello';
    Object.assign(span.style, { position: 'relative', top: '100px' });
    box.append(span); document.body.append(box);
    return inspectTextFit(box);
  });
  expect(result.layout.status).toBe('unsupported');
});
