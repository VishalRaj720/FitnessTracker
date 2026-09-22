import type { CapacitorConfig } from '@capacitor/cli'

// Wraps the same web build as an Android app. Steps (needs Android Studio):
//   npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android
//   npm run build && npx cap add android && npx cap sync && npx cap open android
// The WebView serves the app from https://localhost (secure context) so getUserMedia works;
// add <uses-permission android:name="android.permission.CAMERA" /> to AndroidManifest.xml.
const config: CapacitorConfig = {
  appId: 'app.fitsathi.mobile',
  appName: 'FitSathi',
  webDir: 'dist',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
}

export default config
