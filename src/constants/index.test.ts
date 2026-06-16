import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Z_INDEX } from './index';

/**
 * Z_INDEX requires two specific constraints that type checkers won't catch:
 *  1. lightningcss (used by Tailwind v4) serializes custom-property
 *     values to 32-bit floats (6 significant digits). Values needing >6
 *     significant digits will collapse, causing z-index layers to merge.
 *  2. The values are manually mirrored into global.css as `--aie-z-*`. Any
 *     drift between the two files will cause silent visual bugs.
 * These tests ensure both constraints are maintained.
 */

const Z_TO_CSS_VAR: Record<keyof typeof Z_INDEX, string> = {
  floatUi: '--aie-z-float-ui',
  mainUi: '--aie-z-main-ui',
  modal: '--aie-z-modal',
  popover: '--aie-z-popover',
  notification: '--aie-z-notification',
  max: '--aie-z-max',
};

const LAYER_ORDER: (keyof typeof Z_INDEX)[] = ['floatUi', 'mainUi', 'modal', 'popover', 'notification', 'max'];

describe('Z_INDEX', () => {
  it('every value is expressible in <=6 significant digits (lightningcss safe)', () => {
    for (const [key, value] of Object.entries(Z_INDEX)) {
      // Round-trip through 6-sig-figure precision: unchanged ⇒ safe.
      expect(Number(value.toPrecision(6)), `${key}=${value} loses precision at 6 sig figs`).toBe(value);
    }
  });

  it('layers are strictly ascending in documented stacking order', () => {
    for (let i = 1; i < LAYER_ORDER.length; i++) {
      const lower = Z_INDEX[LAYER_ORDER[i - 1]];
      const higher = Z_INDEX[LAYER_ORDER[i]];
      expect(higher, `${LAYER_ORDER[i]} must sit above ${LAYER_ORDER[i - 1]}`).toBeGreaterThan(lower);
    }
  });

  it('mirrors the --aie-z-* values declared in global.css', () => {
    // cwd is the project root under vitest — env-agnostic (happy-dom rewrites import.meta.url).
    const css = readFileSync(join(process.cwd(), 'src/react-app/styles/global.css'), 'utf8');
    for (const [key, cssVar] of Object.entries(Z_TO_CSS_VAR)) {
      const match = css.match(new RegExp(`${cssVar}:\\s*(\\d+)`));
      expect(match, `${cssVar} missing from global.css`).not.toBeNull();
      expect(Number(match![1]), `${cssVar} drifted from Z_INDEX.${key}`).toBe(Z_INDEX[key as keyof typeof Z_INDEX]);
    }
  });
});
