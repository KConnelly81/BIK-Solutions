import type { CapacitorConfig } from '@capacitor/cli';

// ── App identifier ──────────────────────────────────────────────────────
// PLACEHOLDER — not yet confirmed. `au.com.biksolutions.field` follows the
// reverse-domain convention for biksolutions.com.au. This value becomes
// the Android applicationId and iOS bundle identifier baked into both
// native projects (android/app/build.gradle, ios/App/App.xcodeproj) once
// `cap add` runs, and is very costly to change after either store listing
// exists (effectively a new app, losing reviews/installs) — confirm this
// with Karen before any store submission. See
// /mobile-release/RELEASE_CHECKLIST.md's "NEEDS KAREN" section.
const appId = 'au.com.biksolutions.field';

const config: CapacitorConfig = {
  appId,
  appName: 'BIK Field',
  webDir: 'www',

  // No custom server.url in production builds — the app loads its bundled
  // www/ assets locally, then talks to Supabase directly over HTTPS (same
  // SUPABASE_URL as the web app, see www/js/shared/client.js). This block
  // only ever activates for local device-on-LAN development against a
  // dev server, gated behind an explicit env var so it can never
  // accidentally ship in a release build.
  ...(process.env.BIK_MOBILE_DEV_SERVER
    ? {
        server: {
          url: process.env.BIK_MOBILE_DEV_SERVER,
          cleartext: true,
        },
      }
    : {}),

  android: {
    // Release builds are signed by Codemagic once a keystore exists
    // (see codemagic.yaml) — nothing to configure here for that.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#262220',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Geolocation: {
      // No plugin-level permission strings here — actual usage-description
      // text lives natively (Info.plist NSLocationWhenInUseUsageDescription,
      // AndroidManifest ACCESS_FINE_LOCATION) so it can be reviewed and
      // edited directly — see PRIVACY_DATA_INVENTORY.md.
    },
  },
};

export default config;
