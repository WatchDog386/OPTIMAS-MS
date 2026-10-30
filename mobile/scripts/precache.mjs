// After `expo export -p web`: list every file the app needs (all pages' code, the fonts in use, images,
// the barcode reader) in precache.json, and stamp the service worker with a hash of that list. The
// service worker downloads them all once, so every page opens straight away, even the first time.
//   node scripts/precache.mjs <export dir>
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/precache.mjs <export dir>');

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const FONTS = /(Ionicons|Figtree_(400Regular|500Medium|600SemiBold|700Bold|800ExtraBold))\.[0-9a-f]+\.ttf$/;
const files = walk(dir)
  .map((f) => '/' + relative(dir, f).split('\\').join('/'))
  .filter((f) => f.startsWith('/_expo/') || FONTS.test(f) || /^\/assets\/assets\//.test(f) || ['/leaflet.css', '/logo.png', '/zxing_reader.wasm', '/favicon.png'].includes(f))
  .filter((f) => !f.endsWith('.map'))
  .sort();

const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
writeFileSync(join(dir, 'precache.json'), JSON.stringify({ version, files }));
const sw = join(dir, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replace(/optimas-shell-[\w-]+/, `optimas-shell-${version}`));
const size = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
console.log(`precache: ${files.length} files, ${(size / 1048576).toFixed(1)} MB, version ${version}`);
