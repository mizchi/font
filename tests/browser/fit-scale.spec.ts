import { expect, test } from '@playwright/test';

for (const variant of [
  { name: 'root scale', parent: {}, root: { transform: 'translate(12px, 7px) scale(1.5, 2)' }, x: 1.5, y: 2 },
  { name: 'ancestor scale', parent: { transform: 'scale(1.25)' }, root: {}, x: 1.25, y: 1.25 },
  { name: 'CSS zoom', parent: { zoom: '1.25' }, root: {}, x: 1.25, y: 1.25 },
  { name: 'nested scale and zoom', parent: { zoom: '1.25' }, root: { transform: 'scale(1.2)' }, x: 1.5, y: 1.5 },
  { name: 'individual scale property', parent: {}, root: { scale: '1.5 2' }, x: 1.5, y: 2 },
]) {
  test(`${variant.name} keeps fit limits in unscaled CSS pixels`, async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async ({ parentStyle, rootStyle }) => {
      const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
      const parent = document.createElement('div');
      const box = document.createElement('div');
      Object.assign(box.style, { width: '100.25px', font: '16px monospace', lineHeight: '24px', padding: '5px', border: '2px solid' });
      box.textContent = 'Hello'; parent.append(box); document.body.append(parent);
      const original = await inspectTextFit(box, { minWidth: 30, maxWidth: 100.25 });
      Object.assign(parent.style, parentStyle); Object.assign(box.style, rootStyle);
      return { original, scaled: await inspectTextFit(box, { minWidth: 30, maxWidth: 100.25 }) };
    }, { parentStyle: variant.parent, rootStyle: variant.root });
    expect(result.scaled.accepted, JSON.stringify(result.scaled.reasons)).toBe(true);
    expect(result.scaled.coordinates.scaleX).toBeCloseTo(variant.x, 5);
    expect(result.scaled.coordinates.scaleY).toBeCloseTo(variant.y, 5);
    // Native transformed geometry can round to the engine's 1/60 or 1/64px units.
    expect(Math.abs(result.scaled.layout.contentBox!.width - 100.25)).toBeLessThan(0.02);
    expect(Math.abs(result.original.unwrapped.width! - result.scaled.unwrapped.width!)).toBeLessThan(0.05);
  });
}

test('scaled ancestor clipping stays distinct from internal fit', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const parent = document.createElement('div');
    Object.assign(parent.style, { width: '60px', height: '24px', overflow: 'hidden', transform: 'scale(1.5)' });
    const box = document.createElement('div');
    Object.assign(box.style, { width: '100px', font: '16px monospace', lineHeight: '24px', whiteSpace: 'nowrap' });
    box.textContent = 'Hello Hi'; parent.append(box); document.body.append(parent);
    return inspectTextFit(box);
  });
  expect(result.layout.status).toBe('fits');
  expect(result.presentation.status).toBe('clipped');
  expect(result.accepted).toBe(false);
});

test('rotation, skew, reflection and 3D remain explicitly unsupported', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const results = [];
    for (const transform of ['rotate(5deg)', 'skewX(5deg)', 'scale(-1,1)', 'rotateY(20deg)']) {
      results.push(await checkTextFit('Hello', { maxWidth: 100, style: { transform } }));
    }
    return results;
  });
  expect(result.every(value => value.layout.status === 'unsupported' && value.accepted === null)).toBe(true);
});

test('zoomed asymmetric borders use native edge widths at device scale factor two', async ({ browser }) => {
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  try {
    const page = await context.newPage(); await page.goto('http://127.0.0.1:43783/');
    const result = await page.evaluate(async () => {
      const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
      const box = document.createElement('div');
      Object.assign(box.style, { zoom: '1.25', width: '100.25px', font: '16px monospace', lineHeight: '24px', padding: '5px', border: '2px solid', borderRightWidth: '3px' });
      box.textContent = 'Hello'; document.body.append(box);
      return inspectTextFit(box);
    });
    expect(result.accepted).toBe(true);
    expect(Math.abs(result.layout.contentBox!.width - 100.25)).toBeLessThan(0.02);
  } finally { await context.close(); }
});
