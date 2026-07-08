const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver = {
  ...config.resolver,
  blockList: [/.*_tmp_\d+.*/],
};
module.exports = config;