// Run after `expo export -p web`: writes chunks.json, the list of every page's code file, so the app can
// download them all in the background after sign-in and open each page without waiting for its code.
//   node scripts/chunk-list.mjs <export dir>
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'dist';
const dir = join(out, '_expo/static/js/web');
// The entry and shared files are already loaded when the app starts
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && !/^(entry|__common|__expo-metro-runtime)-/.test(f));
writeFileSync(join(out, 'chunks.json'), JSON.stringify(files.map((f) => `/_expo/static/js/web/${f}`)));
console.log(`chunks.json: ${files.length} page files`);
