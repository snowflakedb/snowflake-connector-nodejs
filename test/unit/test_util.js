module.exports.sleepAsync = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};
