const generic = require('../build/Release/generic_driver');

exports.init = generic.init;
exports.connectUserPassword = generic.connectUserPassword;
exports.closeConnection = generic.closeConnection;
exports.executeQuery = generic.executeQuery;
exports.getVersion = generic.getVersion;
exports.getApiName = generic.getApiName;
exports.executeQueryWithoutFetchingRows = generic.executeQueryWithoutFetchingRows;
exports.fetchNextRows = generic.fetchNextRows;
exports.connectUserPasswordWithCallback = generic.connectUserPasswordWithCallback;

exports.connectUserPasswordAsync = (connectionParameters) =>
  new Promise(function (resolve, reject) {
    generic.connectUserPasswordWithCallback(connectionParameters, function (connectionId, err) {
      setTimeout(function () {
        if (connectionId) {
          resolve(connectionId);
        } else {
          reject(err);
        }
      }, 0);
    });
  });