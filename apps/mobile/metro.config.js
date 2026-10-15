// Standard, unmodified Expo Metro config.
//
// NOTE on monorepo workspace resolution: this app deliberately does NOT add
// `watchFolders` pointing at `../../packages/shared`, and apps/mobile is NOT
// registered as an npm workspace member in the repo root package.json.
// See README.md -> "Metro / workspace resolution choice" for the reasoning.
// The handful of enums/types we need from packages/shared/src are copied
// into src/types/shared.ts instead.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
