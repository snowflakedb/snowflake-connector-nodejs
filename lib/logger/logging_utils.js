const Util = require('../util');

exports.describePresence = function (valueToDescribe) {
  const VAR_PROVIDED_TEXT = 'provided';
  const VAR_NOT_PROVIDED_TEXT = 'not provided';

  return Util.isNotEmptyAsString(valueToDescribe) ? VAR_PROVIDED_TEXT : VAR_NOT_PROVIDED_TEXT;
};
