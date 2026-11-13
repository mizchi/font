import { expect, test } from '@playwright/test';

test('ancestor clipping rejects text that fits its own box', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const parent = document.createElement('div');
    Object.assign(parent.style, { width: '100px', height: '24px', overflow: 'hidden' });
    const label = document.createElement('div');
    Object.assign(label.style, { width: '100px', font: '20px sans-serif', lineHeight: '24px' });
    label.textContent = 'Hello world Hello world Hello world';
    parent.append(label); document.body.append(parent);
    return inspectTextFit(label);
  });
  expect(result.layout.status).toBe('fits');
  expect(result.presentation.status).toBe('clipped');
  expect(result.presentation.clippedBy).toHaveLength(1);
  expect(result.accepted).toBe(false);
});

test('ellipsis is accepted only when truncation is explicitly allowed', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const options = { maxWidth: 70, style: { fontSize: '20px', lineHeight: '24px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } };
    const strict = await checkTextFit('Hello world Hello world', options);
    const allowed = await checkTextFit('Hello world Hello world', { ...options, allowTruncation: true });
    return { strict, allowed };
  });
  expect(result.strict.presentation.status).toBe('truncated');
  expect(result.strict.accepted).toBe(false);
  expect(result.allowed.layout.status).toBe('overflow');
  expect(result.allowed.accepted).toBe(true);
});

test('scrollable overflow is distinguished from an unintended cut', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const options = { maxWidth: 70, maxHeight: 24, style: { fontSize: '20px', lineHeight: '24px' } };
    return { scroll: await checkTextFit('Hello world Hello world', { ...options, style: { ...options.style, overflow: 'auto' } }),
      hidden: await checkTextFit('Hello world Hello world', { ...options, style: { ...options.style, overflow: 'hidden' } }) };
  });
  expect(result.scroll.presentation.status).toBe('scrollable');
  expect(result.hidden.presentation.status).toBe('clipped');
  expect(result.scroll.accepted).toBe(false);
});

test('temporary measurements are independent of the host page clipping', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    document.body.style.overflow = 'hidden';
    return checkTextFit('Hello', { maxWidth: 100 });
  });
  expect(result.accepted).toBe(true);
});

test('allowing truncation does not bypass the requested width interval', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const results = [];
    for (const width of [30, 90, 300]) {
      const box = document.createElement('div');
      Object.assign(box.style, { width: `${width}px`, font: '20px monospace', lineHeight: '24px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
      box.textContent = 'Hello world Hello world Hello world'; document.body.append(box);
      results.push(await inspectTextFit(box, { minWidth: 80, maxWidth: 100, allowTruncation: true }));
    }
    return results;
  });
  expect(result.map(value => value.presentation.status)).toEqual(['truncated', 'truncated', 'truncated']);
  expect(result.map(value => value.accepted)).toEqual([false, true, false]);
});
