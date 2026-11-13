import { expect, test } from '@playwright/test';

test('SVG icons, inline blocks and badges contribute to the measured width', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const box = document.createElement('div');
    Object.assign(box.style, { width: 'max-content', font: '20px sans-serif', lineHeight: '32px', whiteSpace: 'nowrap' });
    box.innerHTML = '<svg width="24" height="24"><rect width="24" height="24"/></svg><span style="display:inline-block;margin-left:8px">Hello</span><span style="display:inline-block;padding:0 6px;border:1px solid;margin-left:4px">12</span>';
    document.body.append(box);
    const expected = box.getBoundingClientRect().width;
    const before = box.outerHTML;
    const checked = await inspectTextFit(box);
    box.style.width = `${expected - 4}px`;
    const overflow = await inspectTextFit(box);
    return { expected, checked, overflow, unchanged: before === box.outerHTML.replace(box.style.width, 'max-content') };
  });
  expect(result.checked.layout.status, JSON.stringify(result.checked.reasons)).toBe('fits');
  expect(Math.abs(result.checked.intrinsic.maxContentWidth! - result.expected)).toBeLessThan(0.1);
  expect(result.overflow.layout.status).toBe('overflow');
});

test('quoted pseudo-element text and empty pseudo icons are measured without changing the source', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const style = document.createElement('style');
    style.textContent = '.pseudo::before { content:"";display:inline-block;width:24px;height:16px;margin-right:8px } .pseudo::after { content:" NEW";font-size:13px;font-weight:bold }';
    const box = document.createElement('div'); box.className = 'pseudo'; box.textContent = 'Hello';
    Object.assign(box.style, { width: 'max-content', font: '20px sans-serif', lineHeight: '32px', whiteSpace: 'nowrap' });
    document.body.append(style, box);
    const expected = box.getBoundingClientRect().width, before = box.outerHTML;
    return { expected, checked: await inspectTextFit(box), unchanged: before === box.outerHTML };
  });
  expect(result.checked.layout.status, JSON.stringify(result.checked.reasons)).toBe('fits');
  expect(Math.abs(result.checked.intrinsic.maxContentWidth! - result.expected)).toBeLessThan(0.1);
  expect(result.unchanged).toBe(true);
});

test('image measurements reuse the loaded resource without cloning its URL', async ({ page }) => {
  let requests = 0;
  await page.route('**/fit-icon.svg', route => { requests++; return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>' }); });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const box = document.createElement('div'); box.style.width = '100px';
    const image = new Image(); image.src = '/fit-icon.svg';
    box.append(image, 'Hi'); document.body.append(box); await image.decode();
    const before = box.outerHTML;
    return { checked: await inspectTextFit(box), unchanged: before === box.outerHTML };
  });
  expect(result.checked.layout.status, JSON.stringify(result.checked.reasons)).toBe('fits');
  expect(result.checked.intrinsic.maxContentWidth!).toBeGreaterThan(24);
  expect(result.unchanged).toBe(true);
  expect(requests).toBe(1);
});

test('host tag selectors do not apply pseudo content twice to measurement clones', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const style = document.createElement('style'); style.textContent = 'div::before { content:"PRE" }';
    const box = document.createElement('div');
    Object.assign(box.style, { width: 'max-content', font: '20px monospace', lineHeight: '24px' });
    box.textContent = 'Hello'; document.body.append(style, box);
    const expected = box.getBoundingClientRect().width;
    return { expected, checked: await inspectTextFit(box) };
  });
  expect(Math.abs(result.checked.intrinsic.maxContentWidth! - result.expected)).toBeLessThan(0.05);
});
