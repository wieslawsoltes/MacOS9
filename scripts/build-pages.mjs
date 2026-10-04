/** Builds the plain HTML/ES-module edition as a static site that works under any base path (e.g. GitHub Pages). */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, dirname, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, process.env.PLATINUM_PAGES_DIR || '_site');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'public'), out, { recursive: true });
await cp(join(root, 'packages'), join(out, 'packages'), { recursive: true, filter: source => !source.split(sep).includes('node_modules') });
await mkdir(join(out, 'app'), { recursive: true });
await cp(join(root, 'app/globals.css'), join(out, 'app/globals.css'));
await cp(join(root, 'standalone/index.html'), join(out, 'index.html'));
await writeFile(join(out, '.nojekyll'), '');

// Root-absolute URLs become relative: to the document in HTML/JS, to the stylesheet in CSS.
const rooted = /(["'`(])\/(packages|assets|fonts|app|api)\/|(["'`(])\/(favicon\.svg|version\.json)/g;
async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}
for await (const file of walk(out)) {
  const type = extname(file);
  if (!['.html', '.js', '.css'].includes(type)) continue;
  const prefix = type === '.css' ? `${relative(dirname(file), out).split(sep).join('/') || '.'}/` : './';
  const source = await readFile(file, 'utf8');
  const text = source.replace(rooted, (match, quote, directory, quote2, name) => directory ? `${quote}${prefix}${directory}/` : `${quote2}${prefix}${name}`);
  if (text !== source) await writeFile(file, text);
}
console.log(`Static site written to ${relative(root, out)}`);
