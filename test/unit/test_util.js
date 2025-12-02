// TODO: move this to top-level test utils
module.exports.sleepAsync = function (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

module.exports.clearRequireCache = function () {
  for (const key in require.cache) {
    delete require.cache[key];
  }
};
