/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

function formatTagsMap() {
  return [
    // proper mappings
    ['YYYY', 'YYYY'],
    ['YY', 'YY'],
    ['MM', 'MM'],
    ['MON', 'MMM'],
    ['DD', 'DD'],
    ['DY', 'ddd'],
    ['HH24', 'HH'],
    ['HH12', 'hh'],
    ['HH', 'HH'],
    ['AM', 'A'],
    ['PM', 'A'],
    ['MI', 'mm'],
    ['SS', 'ss'],
    ['TZH:TZM', 'Z'],
    ['TZHTZM', 'ZZ'],

    // special code needed
    ['TZH', ''],
    ['TZM', ''],
    ['FF', '']
  ];
}

function convertSnowflakeFormatToMomentFormat(formatSql, scale) {
  const tags = formatTagsMap();

  // get an upper-case version of the input sql format
  const formatSqlUpper = formatSql.toUpperCase();
  let moment;

  // iterate over the format string
  const length = formatSql.length;
  let formatMoment = '';
  for (let pos = 0; pos < length;) {
    let tag = null;
    let out = null;

    // at each position, check if there's a tag at that position; if so, use
    // 'out' as the replacement
    for (let index = 0; index < tags.length; index++) {
      if (formatSqlUpper.substr(pos).indexOf(tags[index][0]) === 0) {
        tag = tags[index][0];
        out = tags[index][1];
        break;
      }
    }

    // if we didn't find a match, just insert the character after escaping it
    // (by wrapping it in square brackets)
    if (out === null) {
      formatMoment += formatSql[pos];
      pos++;
    } else {
      // we found one of our special tags
      if (out === '') {
        if (tag === 'TZH') {
          // format the moment to get the timezone string and extract the
          // hours; for example, '-0700' will be converted to '-07'
          out = moment.format('ZZ').substr(0, 3);
        } else if (tag === 'TZM') {
          // format the moment to get the timezone string and extract the
          // minutes; for example, '-0700' will be converted to '00
          out = moment.format('ZZ').substr(3);
        } else if (tag === 'FF') {
          // if 'FF' is followed by a digit, use the digit as the scale
          let digit = null;
          if (pos + tag.length < length) {
            const matches = formatSql[pos + tag.length].match(/[0-9]/);
            if (matches) {
              digit = matches[0];
            }
          }
          if (digit !== null) {
            pos++; // skip the digit as well
          }

          // if we need to include fractional seconds
          if (scale > 0) {
            // divide the nanoSeconds to get the requested number of
            // meaningful digits
            // pad with the appropriate number of leading zeros
            out = (new Array(9).join('S')).substr(-scale);
          }
        }
      }

      // append the 'out' text to the moment format and update the position
      formatMoment += out;
      pos += tag.length;
    }
  }
  return formatMoment;
}

module.exports.formatTagsMap = formatTagsMap;
module.exports.convertSnowflakeFormatToMomentFormat = convertSnowflakeFormatToMomentFormat;

