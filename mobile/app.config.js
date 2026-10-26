/**
 * Build-time additions to app.json (Android release builds on GitHub Actions set these env vars):
 *  - ANDROID_VERSION_CODE: increasing build number, so each APK installs over the previous one
 *  - EXPO_PUBLIC_API_URL:  the production API the app talks to
 */
module.exports = ({ config }) => {
  const versionCode = Number(process.env.ANDROID_VERSION_CODE || 1);
  return {
    ...config,
    android: { ...config.android, versionCode },
    extra: { ...config.extra, apiUrl: process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl },
  };
};
