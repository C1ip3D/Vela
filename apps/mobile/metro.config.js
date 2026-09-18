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

const finalConfig = withNativeWind(config, { input: "./global.css" });

// react-native (single copy, hoisted to the workspace root because nothing
// else in the monorepo needs a different version of it) requires an exact
// version match with react's internal renderer — but its own `require("react")`
// calls resolve hierarchically from its own location at the workspace root,
// landing on the root's separately-hoisted react copy instead of the one
// pinned here in apps/mobile/node_modules to match react-native. That leaves
// two live React instances in one bundle ("Invalid hook call" / "Cannot read
// property 'useState' of null"). extraNodeModules doesn't reliably cover
// subpaths like "react/jsx-runtime" once nativewind's own Metro resolver
// plugin is in the chain, so redirect explicitly instead.
const pinnedReact = path.resolve(projectRoot, "node_modules/react");
const pinnedReactDom = path.resolve(projectRoot, "node_modules/react-dom");
const previousResolveRequest = finalConfig.resolver.resolveRequest;

finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  let target = null;
  if (moduleName === "react") target = pinnedReact;
  else if (moduleName.startsWith("react/")) target = path.join(pinnedReact, moduleName.slice("react/".length));
  else if (moduleName === "react-dom") target = pinnedReactDom;
  else if (moduleName.startsWith("react-dom/")) target = path.join(pinnedReactDom, moduleName.slice("react-dom/".length));

  if (target) {
    return context.resolveRequest(context, target, platform);
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = finalConfig;
