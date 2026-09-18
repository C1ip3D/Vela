const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Resolve the @vela/* workspace packages, which npm hoists to the monorepo
// root's node_modules rather than apps/mobile's own — Metro doesn't walk up
// past the project root by default, so both must be registered explicitly.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Fix Firebase ESM/CJS resolution issues
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs"];
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: "./global.css" });
