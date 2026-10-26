// Release signing for CI builds. Run after `expo prebuild`.
//
// With the repo secrets ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and
// ANDROID_KEY_PASSWORD set, release APKs are signed with Optimas' own key. Without them the build
// keeps Expo's template key, which is the same on every build, so updates still install over each
// other — but anyone could sign an APK with it, so add the secrets before wide distribution.
import fs from 'node:fs';
import path from 'node:path';

const gradle = path.join('android', 'app', 'build.gradle');
const { ANDROID_KEYSTORE_BASE64: ks, ANDROID_KEYSTORE_PASSWORD: storePw, ANDROID_KEY_ALIAS: alias, ANDROID_KEY_PASSWORD: keyPw } = process.env;

if (!ks || !storePw || !alias || !keyPw) {
  console.warn('⚠ Release signing secrets not set — signing with the template key.');
  process.exit(0);
}

fs.writeFileSync(path.join('android', 'app', 'release.keystore'), Buffer.from(ks, 'base64'));
let src = fs.readFileSync(gradle, 'utf8');
src = src.replace(
  /signingConfigs \{\n/,
  `signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
`,
);
// Point the release build type (not debug) at the release key
src = src.replace(/(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
if (!src.includes('signingConfig signingConfigs.release')) throw new Error('Could not patch release signing in build.gradle');
fs.writeFileSync(gradle, src);
console.log('✔ Release signing configured');
