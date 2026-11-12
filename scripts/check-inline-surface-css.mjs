import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.argv[2];
assert(directory, 'Usage: node scripts/check-inline-surface-css.mjs <build-directory>');
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
const files = await readdir(join(directory, 'content-scripts'));
const sheets = files.filter((file) => file.endsWith('.css'));
assert(sheets.length > 0, 'No content-script CSS found; expected one audited sheet per surface entry.');

const normalize = (path) => path.replace(/^\.?\//, '');
const injected = (manifest.content_scripts ?? []).flatMap((entry) => (entry.css ?? []).map(normalize));
const exposed = (manifest.web_accessible_resources ?? [])
  .flatMap((entry) => (typeof entry === 'string' ? [entry] : entry.resources))
  .map((resource) => new RegExp('^' + normalize(resource).split('*').map(escapeRegex).join('.*') + '$'));

for (const sheet of sheets) {
  const cssPath = `content-scripts/${sheet}`;
  const jsPath = cssPath.replace(/\.css$/, '.js');
  assert(files.includes(jsPath.slice('content-scripts/'.length)), `${cssPath} has no matching ${jsPath}.`);
  const [css, js] = await Promise.all([
    readFile(join(directory, cssPath), 'utf8'),
    readFile(join(directory, jsPath), 'utf8'),
  ]);
  const literal = JSON.stringify(css).replace(
    /[\u0080-￿]/g,
    (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
  );
  assert(js.includes(literal), `${cssPath} must be embedded verbatim in ${jsPath} (import virtual:surface-css).`);
  assert(
    !/@(property|font-face)\b/.test(css),
    `${cssPath} contains rules WXT would hoist into the host <head> (@property/@font-face).`
  );
  assert(!injected.includes(cssPath), `${cssPath} must not be injected into the host document by the manifest.`);
  assert(!exposed.some((pattern) => pattern.test(cssPath)), `${cssPath} must not be a web-accessible resource.`);
}
for (const file of files.filter((name) => name.endsWith('.js'))) {
  const js = await readFile(join(directory, 'content-scripts', file), 'utf8');
  assert(!js.includes('__AIE_BUNDLED_SURFACE_CSS_'), `Unresolved surface CSS placeholder in content-scripts/${file}.`);
}
console.log(
  `audit:surface OK — ${sheets.length} content-script sheet(s) embedded; no manifest CSS injection or public CSS resource.`
);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
