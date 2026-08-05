// ShowTracker deploy minifier — shrinks the single-file PWA before upload.
// GitHub Pages doesn't gzip, so every byte saved here is a byte off the wire.
// Keeps HTML structure intact (only whitespace/comments removed) and runs
// terser on the inline JS + clean-css on the inline CSS.
import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'html-minifier-terser';

const input = await readFile('index.html', 'utf8');

const output = await minify(input, {
  collapseWhitespace: true,
  removeComments: true,
  minifyJS: true,
  minifyCSS: true
});

// Sanity check: the minified inline JS must still parse, or we abort the deploy.
const script = output.match(/<script>([\s\S]*?)<\/script>/);
if (!script) throw new Error('Minified output lost the inline <script> — aborting');
new Function(script[1]);

await writeFile('index.html', output);
console.log(`Minified index.html: ${input.length} → ${output.length} bytes (${Math.round((1 - output.length / input.length) * 100)}% smaller)`);
