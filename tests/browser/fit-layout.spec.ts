import { expect, test } from '@playwright/test';

test('flex placement distinguishes min-width auto from a shrinkable text box', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const parent = document.createElement('div');
    Object.assign(parent.style, { display: 'flex', width: '140px', gap: '8px', alignItems: 'start' });
    const label = document.createElement('div');
    Object.assign(label.style, { font: '16px monospace', lineHeight: '24px', overflowWrap: 'break-word' });
    label.textContent = 'WWWWWWWWWWWWWWWWWW WWWWWWWWWWWWWWWWWW';
    const sibling = document.createElement('div'); Object.assign(sibling.style, { width: '32px', flexShrink: '0', height: '24px' });
    parent.append(label, sibling); document.body.append(parent);
    const auto = await inspectTextFit(label);
    label.style.minWidth = '0';
    const shrink = await inspectTextFit(label);
    return { auto, shrink };
  });
  expect(result.auto.layout.status).toBe('overflow');
  expect(result.auto.placement.status).toBe('overflow');
  expect(result.shrink.placement.status).toBe('fits');
  expect(result.shrink.layout.status).toBe('fits');
  expect(result.shrink.layout.contentBox!.width).toBeCloseTo(100, 2);
});

test('grid track width and sibling gaps determine the available text width', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const parent = document.createElement('div');
    Object.assign(parent.style, { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 32px', width: '140px', gap: '8px' });
    const label = document.createElement('div');
    Object.assign(label.style, { font: '16px monospace', lineHeight: '24px', overflowWrap: 'anywhere' });
    label.textContent = 'WWWWWWWWWWWWWWWWWW';
    parent.append(label, document.createElement('div')); document.body.append(parent);
    return inspectTextFit(label);
  });
  expect(result.layout.contentBox!.width).toBeCloseTo(100, 2);
  expect(result.placement.status).toBe('fits');
  expect(result.layout.status).toBe('fits');
});

test('inline labels use their native fragments instead of a synthetic block height', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const parent = document.createElement('div');
    Object.assign(parent.style, { width: '100px', font: '16px sans-serif', lineHeight: '32px' });
    const label = document.createElement('span'); label.textContent = 'Hello';
    parent.append(label); document.body.append(parent);
    const single = await inspectTextFit(label);
    label.textContent = 'Hello world Hello world Hello world';
    const wrapped = await inspectTextFit(label);
    Object.assign(parent.style, { height: '32px', overflow: 'hidden' });
    const clipped = await inspectTextFit(label);
    return { single, wrapped, clipped };
  });
  expect(result.single.accepted).toBe(true);
  expect(result.wrapped.accepted).toBe(true);
  expect(result.clipped.layout.status).toBe('fits');
  expect(result.clipped.presentation.status).toBe('clipped');
  expect(result.clipped.accepted).toBe(false);
});
