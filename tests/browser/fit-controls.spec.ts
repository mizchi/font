import { expect, test } from '@playwright/test';

test('text inputs inspect values and preserve selection and horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const input = document.createElement('input');
    Object.assign(input.style, { width: '80px', height: '30px', font: '20px monospace', padding: '4px', border: '2px solid', boxSizing: 'content-box' });
    input.value = 'Hello world Hello world'; document.body.append(input);
    input.setSelectionRange(3, 7); input.scrollLeft = 40;
    const before = [input.value, input.selectionStart, input.selectionEnd, input.scrollLeft];
    const checked = await inspectTextFit(input);
    const after = [input.value, input.selectionStart, input.selectionEnd, input.scrollLeft];
    input.value = 'Hi'; const short = await inspectTextFit(input);
    return { checked, short, before, after };
  });
  expect(result.checked.layout.overflowX).toBe(true);
  expect(result.checked.control?.source).toBe('value');
  expect(result.short.layout.status).toBe('fits');
  expect(result.before).toEqual(result.after);
});

test('input placeholders use their own typography', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const style = document.createElement('style'); style.textContent = 'input::placeholder { font-size:24px }';
    const input = document.createElement('input');
    Object.assign(input.style, { width: '70px', height: '32px', font: '12px monospace', padding: '4px', border: '1px solid' });
    input.placeholder = 'Hello world'; document.body.append(style, input);
    return inspectTextFit(input);
  });
  expect(result.control?.source).toBe('placeholder');
  expect(result.unwrapped.status).toBe('overflow');
  expect(result.presentation.status).toBe('clipped');
});

test('textarea wrapping, trailing newlines and vertical scrolling use the value', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const area = document.createElement('textarea');
    Object.assign(area.style, { width: '100px', height: '24px', font: '16px monospace', lineHeight: '24px', padding: '6px', border: '2px solid' });
    area.value = 'Hello world\nHello world\n'; document.body.append(area);
    area.scrollTop = 12; area.setSelectionRange(2, 5);
    const before = [area.value, area.selectionStart, area.selectionEnd, area.scrollTop];
    const checked = await inspectTextFit(area);
    const after = [area.value, area.selectionStart, area.selectionEnd, area.scrollTop];
    area.style.height = '180px'; const tall = await inspectTextFit(area);
    area.wrap = 'off'; const off = await inspectTextFit(area);
    return { checked, tall, off, before, after };
  });
  expect(result.checked.layout.overflowY).toBe(true);
  expect(result.checked.presentation.status).toBe('scrollable');
  expect(result.tall.layout.status).toBe('fits');
  expect(result.off.layout.overflowX).toBe(true);
  expect(result.before).toEqual(result.after);
});

test('passwords and decorated search controls remain explicitly unsupported', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { inspectTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    const values = [];
    for (const type of ['password', 'search']) {
      const input = document.createElement('input'); input.type = type; input.value = 'private-value';
      document.body.append(input); values.push(await inspectTextFit(input));
    }
    return values;
  });
  expect(result.every(value => value.layout.status === 'unsupported')).toBe(true);
  expect(JSON.stringify(result)).not.toContain('private-value');
});
