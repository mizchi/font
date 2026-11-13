import { expect, test } from '@playwright/test';

test('CSS font-stretch changes native fit width', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    document.fonts.add(await new FontFace('FitWidth', 'url(/fixtures/shaping-reference/roboto-variable.ttf)', { weight: '100 900', stretch: '75% 100%' }).load());
    const style = { fontFamily: 'FitWidth', fontSize: '32px', lineHeight: '40px', fontOpticalSizing: 'none' };
    return { narrow: await checkTextFit('Hello world office AV', { maxWidth: 600, style: { ...style, fontStretch: '75%' } }),
      normal: await checkTextFit('Hello world office AV', { maxWidth: 600, style: { ...style, fontStretch: '100%' } }) };
  });
  expect(result.narrow.intrinsic.maxContentWidth!).toBeLessThan(result.normal.intrinsic.maxContentWidth!);
  expect(result.narrow.accepted).toBe(true);
});

test('automatic optical sizing is measured by the browser itself', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    document.fonts.add(await new FontFace('FitOptical', 'url(/fixtures/shaping-reference/robotoserif-variable.ttf)').load());
    const box = document.createElement('div');
    Object.assign(box.style, { width: 'max-content', font: '72px FitOptical', lineHeight: '90px', fontOpticalSizing: 'auto' });
    box.textContent = 'Hello world office AV'; document.body.append(box);
    const expected = box.getBoundingClientRect().width;
    return { expected, checked: await inspectTextFit(box) };
  });
  expect(result.checked.accepted).toBe(true);
  expect(Math.abs(result.checked.intrinsic.maxContentWidth! - result.expected)).toBeLessThan(0.05);
  expect(result.checked.style['font-optical-sizing']).toBe('auto');
});
