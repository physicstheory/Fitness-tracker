import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reprise.app",
  appName: "RepRise",
  webDir: "dist",
  backgroundColor: "#0d0f14",
  ios: {
    contentInset: "never",
    scheme: "RepRise",
  },
  plugins: {
    SplashScreen: { launchAutoHide: true, launchShowDuration: 300, backgroundColor: "#0d0f14", showSpinner: false },
    LocalNotifications: { presentationOptions: ["sound", "banner"] },
  },
};

export default config;
