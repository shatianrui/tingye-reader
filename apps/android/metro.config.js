const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('epub');
config.resolver.assetExts.push('reader');

module.exports = config;
