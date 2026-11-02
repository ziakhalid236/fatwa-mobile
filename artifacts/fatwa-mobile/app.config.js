const fs = require('fs');

// Adds Firebase (push) config only when google-services.json is present, so builds without it still succeed.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // CI sets APP_VERSION_CODE (rises every run) so each build is a valid Play Store update.
    ...(process.env.APP_VERSION_CODE ? { versionCode: Number(process.env.APP_VERSION_CODE) } : {}),
    ...(fs.existsSync('./google-services.json') ? { googleServicesFile: './google-services.json' } : {}),
  },
  plugins: [...(config.plugins || []), 'expo-iap', 'react-native-compressor'],
});
