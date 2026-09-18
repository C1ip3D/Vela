// apps/web pins an exact React version that differs from apps/mobile's (Expo
// requires its own pin), so npm nests `next` inside apps/web/node_modules
// instead of hoisting it to the workspace root. eslint-config-next's parser
// resolves `next/...` relative to its own location in root node_modules,
// which can't see into apps/web/node_modules — so `npm run lint` fails with
// "Cannot find module 'next/dist/compiled/babel/eslint-parser'" without this.
// This symlink makes `next` resolvable from root too, without hoisting React
// itself (which would require reconciling the two pinned versions).
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "apps", "web", "node_modules", "next");
const linkPath = path.join(__dirname, "..", "node_modules", "next");

if (!fs.existsSync(target)) process.exit(0); // next not nested (or not installed yet) — nothing to do

try {
  const stat = fs.lstatSync(linkPath, { throwIfNoEntry: false });
  if (stat?.isSymbolicLink()) fs.unlinkSync(linkPath);
  else if (stat) process.exit(0); // a real (non-symlink) next is already there — leave it alone
} catch {}

fs.symlinkSync(path.join("..", "apps", "web", "node_modules", "next"), linkPath, "dir");
