const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Fix Firebase ESM/CJS resolution issues
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs"];
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: "./global.css" });
