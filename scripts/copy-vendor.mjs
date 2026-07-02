/**
 * Copies vendor runtime files from node_modules → public/vendor/
 * Run automatically after `npm install` via the postinstall script.
 *
 * Why public/ instead of ?url imports:
 *   reveal.js v6 uses a restrictive package.json exports map that prevents
 *   Rollup from resolving arbitrary dist/ paths. Copying to public/ keeps
 *   vendor assets outside the module graph entirely — served as static files
 *   by Vite, cached by the PWA service worker, available offline.
 */
import { copyFileSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as sass from 'sass';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const nm   = join(root, 'node_modules');
const pub  = join(root, 'public', 'vendor');

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log('  copied', to.replace(root + '/', ''));
}

/** Compile an .scss file to plain CSS (reveal.js 6.x ships pdf.css only as source). */
function compileScss(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  const result = sass.compile(from, { style: 'compressed' });
  writeFileSync(to, result.css);
  console.log('  compiled', to.replace(root + '/', ''));
}

function copyDir(fromDir, toDir) {
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.isFile()) copy(join(fromDir, entry.name), join(toDir, entry.name));
  }
}

console.log('Copying vendor assets to public/vendor/ …');

// ── Reveal.js ─────────────────────────────────────────────────
const rv = join(nm, 'reveal.js', 'dist');
copy(join(rv, 'reset.css'),                   join(pub, 'reveal', 'reset.css'));
copy(join(rv, 'reveal.css'),                  join(pub, 'reveal', 'reveal.css'));
copy(join(rv, 'reveal.js'),                   join(pub, 'reveal', 'reveal.js'));
copy(join(rv, 'plugin', 'highlight.js'),      join(pub, 'reveal', 'plugin', 'highlight.js'));
copy(join(rv, 'plugin', 'notes.js'),          join(pub, 'reveal', 'plugin', 'notes.js'));
copy(join(rv, 'plugin', 'zoom.js'),           join(pub, 'reveal', 'plugin', 'zoom.js'));
copy(join(rv, 'plugin', 'search.js'),         join(pub, 'reveal', 'plugin', 'search.js'));
copy(join(rv, 'plugin', 'math.js'),           join(pub, 'reveal', 'plugin', 'math.js'));

// reveal.js 6.x ships the PDF print stylesheet only as .scss source (no
// precompiled dist/print/pdf.css, and it's not published to CDN either) —
// compile it locally so PDF export works fully offline.
compileScss(
  join(nm, 'reveal.js', 'css', 'print', 'pdf.scss'),
  join(pub, 'reveal', 'print', 'pdf.css'),
);

// ── highlight.js CSS theme ────────────────────────────────────
copy(
  join(nm, 'highlight.js', 'styles', 'github-dark.min.css'),
  join(pub, 'highlight', 'github-dark.min.css'),
);

// ── Mermaid ───────────────────────────────────────────────────
copy(
  join(nm, 'mermaid', 'dist', 'mermaid.min.js'),
  join(pub, 'mermaid', 'mermaid.min.js'),
);

// ── KaTeX (Reveal.js math plugin) ──────────────────────────────
// Reveal's math plugin defaults to loading KaTeX from a CDN unconditionally
// (even on decks with no math content) unless given a local base path.
// Layout under vendor/katex/dist/... matches what the plugin requests when
// configured with `katex: { local: '/vendor/katex' }`.
const kx = join(nm, 'katex', 'dist');
copy(join(kx, 'katex.min.css'), join(pub, 'katex', 'dist', 'katex.min.css'));
copy(join(kx, 'katex.min.js'),  join(pub, 'katex', 'dist', 'katex.min.js'));
copyDir(join(kx, 'fonts'),      join(pub, 'katex', 'dist', 'fonts'));
// The math plugin always loads contrib/auto-render.min.js too (unconditionally,
// not just when extensions are configured), plus mhchem.min.js if enabled.
copy(join(kx, 'contrib', 'auto-render.min.js'), join(pub, 'katex', 'dist', 'contrib', 'auto-render.min.js'));
copy(join(kx, 'contrib', 'mhchem.min.js'),      join(pub, 'katex', 'dist', 'contrib', 'mhchem.min.js'));

console.log('Done.');
