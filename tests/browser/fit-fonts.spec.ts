import { expect, test } from '@playwright/test';

test('required unregistered fonts cannot silently pass with fallback', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    return checkTextFit('Hello', { maxWidth: 400, requiredFonts: ['Missing Fit Font'],
      style: { fontFamily: '"Missing Fit Font", sans-serif' } });
  });
  expect(result.layout.status).toBe('font-error');
  expect(result.fonts.issues).toContainEqual({ family: 'Missing Fit Font', reason: 'unregistered' });
});

test('a failed selected web font reports its failure', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    document.fonts.add(new FontFace('BrokenFit', 'url(/missing-font.ttf)'));
    return checkTextFit('Hello', { maxWidth: 400, requiredFonts: ['BrokenFit'],
      style: { fontFamily: 'BrokenFit, sans-serif' } });
  });
  expect(result.layout.status).toBe('font-error');
  expect(result.fonts.issues.some((issue: { reason: string }) => issue.reason === 'load-failed')).toBe(true);
});

test('mixed script fallback and synthetic bold remain native and explicitly unverified per glyph', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { checkTextFit } = await import(new URL('/browser/fit.js', location.href).href) as typeof import('../../browser/fit.js');
    document.fonts.add(await new FontFace('FitLatin', 'url(/fixtures/shaping-reference/serif.ttf)').load());
    document.fonts.add(await new FontFace('FitJapanese', 'url(/fixtures/shaping-reference/japanese-variable.ttf)', { weight: '100 900' }).load());
    return checkTextFit('Hello 日本語 👨‍👩‍👧‍👦', { maxWidth: 400, requiredFonts: ['FitLatin', 'FitJapanese'],
      style: { fontFamily: 'FitLatin, FitJapanese, sans-serif', fontWeight: '700', fontSynthesis: 'weight' } });
  });
  expect(result.layout.status).toBe('fits');
  expect(result.fonts.status).toBe('ready');
  expect(result.fonts.glyphCoverage).toBe('unverified');
  expect(result.fonts.faces.map((face: { family: string }) => face.family)).toEqual(expect.arrayContaining(['FitLatin', 'FitJapanese']));
});
