/**
 * Theme-token assertions for the Field Ops shell.
 *
 * The filter bar uses `--fo-band` for its background. In dark theme the band
 * MUST resolve to the forest-black panel (var(--fo-ink-2) → #1c2d38) so it
 * blends with the rest of the dark surface. In light theme it stays #ffffff.
 *
 * jsdom doesn't actually apply CSS variables from imported stylesheets, so we
 * load the field-ops.css file as text and parse the relevant rules.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS_PATH = join(process.cwd(), 'src/app/field-ops.css');
const CSS = readFileSync(CSS_PATH, 'utf8');

function extractBlock(selector: string, requiredToken?: string): string {
  // Search every occurrence and return the first block that contains the required token.
  let from = 0;
  while (from < CSS.length) {
    const idx = CSS.indexOf(selector, from);
    if (idx === -1) break;
    const open = CSS.indexOf('{', idx);
    const close = CSS.indexOf('}', open);
    const body = CSS.slice(open + 1, close);
    if (!requiredToken || body.includes(requiredToken)) return body;
    from = close + 1;
  }
  throw new Error(`Selector ${selector} with token ${requiredToken ?? '*'} not found`);
}

function tokenValue(block: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

describe('Field Ops theme tokens', () => {
  it('default (dark) --fo-band resolves to var(--fo-ink-2) so the filter bar matches the dark surface', () => {
    const block = extractBlock('.field-ops-root {', '--fo-band');
    const band = tokenValue(block, '--fo-band');
    expect(band).toBe('var(--fo-ink-2)');
  });

  it('default (dark) --fo-band-text resolves to the dark-theme text token (var(--fo-white))', () => {
    const block = extractBlock('.field-ops-root {', '--fo-band');
    const text = tokenValue(block, '--fo-band-text');
    expect(text).toBe('var(--fo-white)');
  });

  it('default (dark) --fo-band-mute resolves to var(--fo-line)', () => {
    const block = extractBlock('.field-ops-root {', '--fo-band');
    const mute = tokenValue(block, '--fo-band-mute');
    expect(mute).toBe('var(--fo-line)');
  });

  it('light overrides keep --fo-band as pure white (#ffffff)', () => {
    const block = extractBlock('.field-ops-root[data-theme="light"] {');
    const band = tokenValue(block, '--fo-band');
    expect(band).toBe('#ffffff');
  });

  it('light overrides set --fo-band-text to ink (#001e2b)', () => {
    const block = extractBlock('.field-ops-root[data-theme="light"] {');
    expect(tokenValue(block, '--fo-band-text')).toBe('#001e2b');
  });

  it('light overrides set --fo-band-mute to #5c6c75', () => {
    const block = extractBlock('.field-ops-root[data-theme="light"] {');
    expect(tokenValue(block, '--fo-band-mute')).toBe('#5c6c75');
  });
});
