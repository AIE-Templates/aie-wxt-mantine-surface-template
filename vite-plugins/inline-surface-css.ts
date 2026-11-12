/**
 * Embed the content entry's complete, processed CSS in its JS bundle.
 * Ordinary CSS and CSS Modules keep using Vite's pipeline; the emitted CSS
 * asset remains available for audits but is neither fetched nor host-injected.
 * WXT builds each content script separately, including in development mode.
 *
 * The CSS only exists once Vite has emitted it (generateBundle), which is after
 * minification. The virtual module therefore exports a placeholder wrapped in
 * an expression the minifier cannot evaluate (an unknown global read), so code
 * such as `css.replaceAll(...)`, `css.length` or `css ? a : b` stays a runtime
 * operation and sees the real CSS instead of being folded against the marker.
 * The global is never set; content scripts run in an isolated world, so the
 * host page cannot set it either.
 *
 * The embedded CSS also drops `@property` registrations (see
 * keepAtRulesInShadow), so WXT has nothing to hoist into the host <head>.
 */
import postcss, { type AtRule } from 'postcss';
import type { Plugin } from 'vite';
import { escapeNonAscii } from './to-utf8';

const MODULE_ID = 'virtual:surface-css';
const RESOLVED_ID = `\0${MODULE_ID}`;
const MARKER = '__AIE_BUNDLED_SURFACE_CSS_61d9a7__';
const OPAQUE_GLOBAL = '__aieSurfaceCssUnset';

export default function inlineSurfaceCss(): Plugin {
  let loaded = false;
  return {
    name: 'inline-surface-css',
    apply: 'build',
    enforce: 'post',
    buildStart() {
      loaded = false;
    },
    resolveId(id) {
      if (id === MODULE_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      loaded = true;
      return `export default String(globalThis.${OPAQUE_GLOBAL} ?? ${JSON.stringify(MARKER)});`;
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const consumers = Object.values(bundle).filter((item) => item.type === 'chunk' && item.code.includes(MARKER));
        if (consumers.length === 0) {
          if (loaded) {
            this.error('The surface CSS placeholder was removed from the bundle unexpectedly.');
          }
          return;
        }
        // Never accidentally collect styles from unrelated entries or chunks.
        const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
        if (consumers.length !== 1 || chunks.length !== 1) {
          this.error('virtual:surface-css requires a single content-script bundle without code splitting.');
        }
        const sheets = Object.values(bundle).filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'));
        if (sheets.length !== 1) {
          this.error('virtual:surface-css requires exactly one emitted CSS asset. Check the entry CSS imports.');
        }
        const sheet = sheets[0]!;
        if (sheet.type !== 'asset') this.error('Expected a CSS asset.');
        const raw = typeof sheet.source === 'string' ? sheet.source : new TextDecoder().decode(sheet.source);
        let css: string;
        try {
          css = keepAtRulesInShadow(raw);
        } catch (error) {
          this.error(error instanceof Error ? error.message : String(error));
        }
        if (/@font-face/.test(css)) {
          this.warn('@font-face in surface CSS is hoisted into the host document by WXT; load fonts another way.');
        }
        // The audit asset must stay identical to what ships in the JS.
        sheet.source = css;
        // This hook runs after CSS generation and may run after the ASCII
        // plugin, so escape the inserted literal here as well.
        const literal = escapeNonAscii(JSON.stringify(css));
        for (const chunk of chunks) {
          const token = new RegExp('(["\'`])' + MARKER + '\\1', 'g');
          const edits: Edit[] = [];
          chunk.code = chunk.code.replaceAll(token, (match: string, _quote: string, offset: number) => {
            edits.push({ offset, removed: match.length, inserted: literal.length });
            return literal;
          });
          if (edits.length === 0) this.error('The surface CSS placeholder was transformed unexpectedly.');
          if (chunk.map) chunk.map.mappings = shiftMappings(chunk.map.mappings, locate(chunk.code, edits));
        }
      },
    },
  };
}

/**
 * WXT hoists `@property` rules into the host page's <head> (they have no
 * effect inside a shadow root). Drop them for the shadow entry and let
 * Tailwind's own per-element fallback (`@layer properties { @supports (…) {
 * *, ::before, ::after, ::backdrop { --tw-*: initial } } }`), which it gates
 * to browsers without `@property`, apply unconditionally instead. The
 * surface then needs nothing outside its shadow trees, and satellites get the
 * initial values from the same captured CSS. Fails when the fallback does not
 * cover every dropped property (e.g. Tailwind changed its output shape).
 */
export function keepAtRulesInShadow(css: string): string {
  const root = postcss.parse(css);
  const registered: string[] = [];
  root.walkAtRules('property', (rule) => {
    registered.push(rule.params.trim());
    rule.remove();
  });
  if (registered.length === 0) return css;

  const covered = new Set<string>();
  root.walkAtRules('layer', (layer) => {
    if (layer.params.trim() !== 'properties' || !layer.nodes) return;
    for (const node of [...layer.nodes]) {
      if (node.type !== 'atrule' || (node as AtRule).name !== 'supports') continue;
      node.walkDecls((decl) => {
        covered.add(decl.prop);
      });
      node.replaceWith((node as AtRule).nodes ?? []);
    }
  });
  const missing = registered.filter((name) => !covered.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Cannot drop @property for ${missing.join(', ')}: no Tailwind \`@layer properties\` fallback sets them.`
    );
  }
  return root.toString();
}

interface Edit {
  /** Offset of the replaced text in the ORIGINAL code. */
  offset: number;
  removed: number;
  inserted: number;
}

interface LineShift {
  line: number;
  /** Generated columns at or after this (pre-edit) column move by `delta`. */
  fromColumn: number;
  delta: number;
}

/** Convert offset edits into per-line column shifts (the literal never contains a newline). */
function locate(newCode: string, edits: Edit[]): LineShift[] {
  const shifts: LineShift[] = [];
  let drift = 0;
  for (const edit of edits) {
    const newOffset = edit.offset + drift;
    const lineStart = newCode.lastIndexOf('\n', newOffset - 1) + 1;
    const line = countNewlines(newCode, newOffset);
    const prior = shifts.filter((s) => s.line === line).reduce((sum, s) => sum + s.delta, 0);
    shifts.push({
      line,
      fromColumn: newOffset - lineStart - prior + edit.removed,
      delta: edit.inserted - edit.removed,
    });
    drift += edit.inserted - edit.removed;
  }
  return shifts;
}

function countNewlines(code: string, end: number): number {
  let count = 0;
  for (let i = code.indexOf('\n'); i !== -1 && i < end; i = code.indexOf('\n', i + 1)) count++;
  return count;
}

/**
 * Rolldown's generateBundle map is final and not recomposed after code edits,
 * so shift the generated columns that follow each inserted literal. Only the
 * generated column (the first, line-relative VLQ field of each segment) moves.
 */
export function shiftMappings(mappings: string, shifts: LineShift[]): string {
  if (shifts.length === 0) return mappings;
  return mappings
    .split(';')
    .map((lineText, line) => {
      const own = shifts.filter((s) => s.line === line);
      if (own.length === 0 || lineText === '') return lineText;
      let original = 0;
      let previousShifted = 0;
      return lineText
        .split(',')
        .map((segment) => {
          const fields = decodeVlq(segment);
          original += fields[0]!;
          const shifted = original + own.filter((s) => original >= s.fromColumn).reduce((sum, s) => sum + s.delta, 0);
          fields[0] = shifted - previousShifted;
          previousShifted = shifted;
          return encodeVlq(fields);
        })
        .join(',');
    })
    .join(';');
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeVlq(segment: string): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = BASE64.indexOf(char);
    value += (digit & 31) * 2 ** shift;
    if (digit & 32) {
      shift += 5;
    } else {
      values.push(value % 2 === 1 ? -(value - 1) / 2 : value / 2);
      value = 0;
      shift = 0;
    }
  }
  return values;
}

function encodeVlq(values: number[]): string {
  let out = '';
  for (const signed of values) {
    let value = signed < 0 ? -signed * 2 + 1 : signed * 2;
    do {
      let digit = value % 32;
      value = Math.floor(value / 32);
      if (value > 0) digit |= 32;
      out += BASE64[digit];
    } while (value > 0);
  }
  return out;
}
