// Audit: enumerate EVERY custom-property declaration in built surface CSS
// and classify its selector against the iron law —
// "all root-level plugin CSS variables are anchored on .<prefix>-surface-root".
//
// Usage: node scripts/audit-css-vars.mjs <file.css | directory of .css files>
import postcss from 'postcss';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_PREFIX } from '../prefix.cjs';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/audit-css-vars.mjs <file.css | directory>');
  process.exit(1);
}
const files = statSync(target).isDirectory()
  ? readdirSync(target)
      .filter((name) => name.endsWith('.css'))
      .map((name) => join(target, name))
  : [target];
if (files.length === 0) {
  console.error(`No .css files in ${target}`);
  process.exit(1);
}

// A "root-level" selector is one that targets the document/shadow root or
// every element — i.e. where a custom property becomes a design token for the
// whole subtree. These are the ONLY ones the iron law governs.
const ROOT_TOKENS = [':root', ':host', 'html', 'body', '*'];
const SURFACE = `.${PROJECT_PREFIX}-surface-root`;
const TW_PREFIX = `--${PROJECT_PREFIX}-tw-`;

function atRuleChain(node) {
  const chain = [];
  let p = node.parent;
  while (p && p.type === 'atrule') {
    chain.unshift(`@${p.name} ${p.params}`.trim());
    p = p.parent;
  }
  return chain.join(' > ');
}

function selectorTargetsRoot(sel) {
  // split on commas, check each compound selector for a root token at its head
  return sel.split(',').some((part) => {
    const s = part.trim();
    return ROOT_TOKENS.some(
      (t) => s === t || s.startsWith(t + '[') || s.startsWith(t + ':') || s.startsWith(t + ' ') || s.startsWith(t + '.'),
    );
  });
}
function selectorIncludesSurface(sel) {
  return sel.split(',').some((p) => p.trim().split(/[ >+~]/)[0].includes(SURFACE.slice(1)));
}

function auditFile(file) {
  const root = postcss.parse(readFileSync(file, 'utf8'));
  console.log(`\n##### ${file}`);
  const buckets = {
    rootCompliant: [], // design tokens on root AND includes .<prefix>-surface-root → GOOD
    rootViolation: [], // design tokens on root but MISSING .<prefix>-surface-root  → VIOLATION
    schemeStatic: [], // :root[data-mantine-color-scheme],:host([...]) static defaults — inert in shadow, runtime <style> on .<prefix>-surface-root supplies real values (NOT visible to this static audit)
    twTransient: [], // `*`-scoped --<prefix>-tw-* per-element fallback (Tailwind's initial values, namespaced) — not a design token
    scoped: new Map(), // component/utility selectors (local scope, out of law)
  };

  const onlyTwVars = (props) => props.every((p) => p.startsWith(TW_PREFIX));
  const isSchemeBlock = (sel) => /\[data-mantine-color-scheme/.test(sel);

  root.walkRules((rule) => {
    const customProps = rule.nodes?.filter((n) => n.type === 'decl' && n.prop.startsWith('--')) ?? [];
    if (customProps.length === 0) return;
    const props = customProps.map((d) => d.prop);
    const chain = atRuleChain(rule);
    const entry = { selector: rule.selector, chain, count: customProps.length, sample: props.slice(0, 3) };
    if (selectorTargetsRoot(rule.selector)) {
      if (isSchemeBlock(rule.selector) && !selectorIncludesSurface(rule.selector)) buckets.schemeStatic.push(entry);
      else if (onlyTwVars(props)) buckets.twTransient.push(entry);
      else if (selectorIncludesSurface(rule.selector)) buckets.rootCompliant.push(entry);
      else buckets.rootViolation.push(entry);
    } else {
      const key = rule.selector.length > 60 ? rule.selector.slice(0, 60) + '…' : rule.selector;
      buckets.scoped.set(key, (buckets.scoped.get(key) || 0) + customProps.length);
    }
  });

  // @property at-rules: stripped from shadow surface CSS (ignored there); if any remain, they must be namespaced
  let propertyCount = 0;
  const propertyNames = new Set();
  root.walkAtRules('property', (at) => {
    propertyCount++;
    propertyNames.add(at.params);
  });

  console.log('=== DESIGN-TOKEN root rules (governed by the iron law) ===');
  console.log(`COMPLIANT (include ${SURFACE}): ${buckets.rootCompliant.length} rule(s)`);
  for (const e of buckets.rootCompliant) console.log(`  ✓ [${e.chain || 'top'}] "${e.selector}" (${e.count} vars, e.g. ${e.sample.join(', ')})`);
  console.log(`\nVIOLATIONS (design tokens on root, MISSING ${SURFACE}): ${buckets.rootViolation.length} rule(s)`);
  for (const e of buckets.rootViolation) console.log(`  ✗ [${e.chain || 'top'}] "${e.selector}" (${e.count} vars, e.g. ${e.sample.join(', ')})`);

  console.log(`\n=== Mantine color-scheme STATIC defaults (inert in shadow; real values via runtime <style> on ${SURFACE} — verify at runtime): ${buckets.schemeStatic.length} ===`);
  for (const e of buckets.schemeStatic) console.log(`  ~ "${e.selector.slice(0, 70)}" (${e.count} vars)`);

  console.log(`\n=== Tailwind ${TW_PREFIX}* per-element transient fallback (initial values, namespaced): ${buckets.twTransient.length} rule(s) ===`);
  for (const e of buckets.twTransient) console.log(`  ~ [${e.chain ? e.chain.slice(0, 40) + '…' : 'top'}] "${e.selector}" (${e.count} vars)`);

  console.log(`\n=== @property registrations (must be namespaced if present): ${propertyCount} ===`);
  const unprefixed = [...propertyNames].filter((n) => n.startsWith('--tw-'));
  const prefixed = [...propertyNames].filter((n) => n.startsWith(TW_PREFIX));
  const otherProp = [...propertyNames].filter((n) => !n.startsWith('--tw-') && !n.startsWith(TW_PREFIX));
  console.log(`  ${TW_PREFIX}* (namespaced): ${prefixed.length}`);
  console.log(`  --tw-* (UNNAMESPACED — would collide!): ${unprefixed.length}${unprefixed.length ? ' → ' + unprefixed.join(', ') : ''}`);
  console.log(`  other: ${otherProp.length}${otherProp.length ? ' → ' + otherProp.slice(0, 10).join(', ') : ''}`);

  console.log(`\n=== SCOPED (component/utility, local — outside the law): ${buckets.scoped.size} distinct selectors ===`);
  let scopedTotal = 0;
  for (const [, c] of buckets.scoped) scopedTotal += c;
  console.log(`  total scoped custom-prop decls: ${scopedTotal} (these are element-local, not root tokens)`);
  // show any scoped selector that looks suspiciously root-ish or unprefixed-leaky
  const suspicious = [...buckets.scoped.keys()].filter((s) => /^(:root|:host|html|body|\*)/.test(s));
  console.log(`  suspicious root-ish scoped selectors: ${suspicious.length}${suspicious.length ? ' → ' + suspicious.join(' | ') : ''}`);

  console.log(`\n=== VERDICT ===`);
  const ok = buckets.rootViolation.length === 0 && unprefixed.length === 0;
  console.log(ok ? `✅ Iron law holds: every root-level var rule includes ${SURFACE}; any @property registrations namespaced.` : '❌ Violations found above.');
  return ok;
}

const results = files.map(auditFile);
process.exit(results.every(Boolean) ? 0 : 1);
