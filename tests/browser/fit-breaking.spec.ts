import { expect, test } from '@playwright/test';

for (const sample of [
  { name: 'Japanese punctuation', text: '「日本語のテキスト幅検査。」（折り返しを確認します。）', style: { lineBreak: 'strict' } },
  { name: 'long URL', text: 'https://example.test/abcdefghijklmnopqrstuvwxyz0123456789', style: { overflowWrap: 'anywhere' } },
  { name: 'zero width spaces', text: 'Hello\u200bHello\u200bHello', style: {} },
  { name: 'soft hyphens', text: 'Hello\u00adHello\u00adHello', style: { hyphens: 'manual' } },
  { name: 'hard breaks and preserved whitespace', text: 'Hello   world\n\nHello\tworld\n', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', tabSize: '2' } },
  { name: 'balanced wrapping', text: 'Hello world Hello world Hello', style: { textWrap: 'balance' } },
]) {
  test(`${sample.name} follows the browser's own wrapping and line boxes`, async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async ({ text, style }) => {
      const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
      const box = document.createElement('div');
      Object.assign(box.style, { width: '85px', font: '16px sans-serif', lineHeight: '24px', ...style });
      box.lang = 'ja'; box.textContent = text; document.body.append(box);
      const range = document.createRange(); range.selectNodeContents(box);
      return { nativeHeight: box.getBoundingClientRect().height,
        nativeRects: Array.from(range.getClientRects(), rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })),
        checked: await inspectTextFit(box) };
    }, { text: sample.text, style: sample.style });
    expect(result.checked.layout.status).toBe('fits');
    expect(Math.abs(result.checked.layout.requiredHeight! - result.nativeHeight)).toBeLessThan(0.02);
    expect(result.checked.layout.fragments).toEqual(result.nativeRects.filter(rect => rect.width || rect.height));
  });
}

test('nonbreaking spaces and unbreakable URLs overflow until emergency wrapping is enabled', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const options = { maxWidth: 60, style: { font: '16px monospace', lineHeight: '24px' } };
    return { nbsp: await checkTextFit('Hello\u00a0world', options),
      url: await checkTextFit('https://example.test/abcdefghijklmnopqrstuvwxyz', options),
      broken: await checkTextFit('Hello\u00a0world', { ...options, style: { ...options.style, overflowWrap: 'anywhere' } }) };
  });
  expect(result.nbsp.layout.overflowX).toBe(true);
  expect(result.url.layout.overflowX).toBe(true);
  expect(result.broken.layout.status).toBe('fits');
});
