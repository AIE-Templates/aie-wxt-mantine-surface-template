/**
 * @module constants
 *
 * Derives everything that must be collision-free against host pages from
 * PROJECT_PREFIX: custom element tags, storage keys, CSS class names, z-index
 * variables and the Tailwind variable prefix.
 *
 * PROJECT_PREFIX itself lives in `prefix.cjs` at the repo root — the ONE place
 * to change when forking. It is plain CommonJS so the non-TS build tooling that
 * also needs the prefix (postcss.config.cjs, scripts/audit-css-vars.mjs) reads
 * the exact same literal. Only global.css mirrors it by hand (CSS can't import);
 * a test in ./index.test.ts guards that mirror.
 */

import { PROJECT_PREFIX } from '../../prefix.cjs';

export { PROJECT_PREFIX };

/** Custom element tag hosting the main in-page shadow surface (one per page). */
export const SHADOW_SURFACE_TAG = `${PROJECT_PREFIX}-surface`;

/** Custom element tag hosting a satellite (component-level shadow UI, N per page). */
export const SATELLITE_TAG = `${PROJECT_PREFIX}-satellite`;

/**
 * Class applied to the root element of every surface (shadow root div and
 * satellite root div). Mantine's CSS variables are scoped to this selector
 * in shadow surfaces, which is what lets satellites share the host's theme
 * via copied stylesheets.
 */
export const SURFACE_ROOT_CLASS = `${PROJECT_PREFIX}-surface-root`;

/**
 * Layered z-index plan for in-page UI, deliberately just below int32 max.
 * Mirrored as CSS variables in react-app/styles/global.css.
 */
/**
 * Layered z-index plan for in-page UI. Mirrored as CSS variables in
 * react-app/styles/global.css — keep both in sync.
 *
 * Values are deliberately expressible in ≤6 significant digits (trailing
 * zeros carry no precision: 2146250000 = 2.14625e9 = 6 sig digits).
 * lightningcss — which Tailwind v4 runs over all CSS at transform time —
 * serializes CUSTOM PROPERTY values via f32 with 6-digit precision
 * (2147483642 → 2.14748e9 → 2147480000), which would collapse
 * near-int32-max layers into one value. At this magnitude the safe
 * granularity is therefore 100000 (typed properties like a literal
 * `z-index: …` are NOT affected; only values inside CSS variables are).
 *
 * popover > modal mirrors Mantine's own convention (popover 300 > modal
 * 200) so dropdowns opened inside modals still float; floating overlays
 * also portal to the surface root as siblings of the main UI, so they must
 * exceed mainUi or be buried under the panel that opened them.
 */
export const Z_INDEX = {
  /** Reserved layer below the main UI (e.g. backdrops/affordances under the panel) — allocate per product. */
  floatUi: 2146000000,
  mainUi: 2146100000,
  modal: 2146200000,
  popover: 2146250000,
  notification: 2146300000,
  /** Reserved top layer for one-off "must beat everything" cases — allocate per product. */
  max: 2147400000,
} as const;
