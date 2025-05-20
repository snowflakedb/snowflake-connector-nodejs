const snowflake = require('snowflake-sdk');

// NOTE:
// A check to ensure that imported package doesn't crush in runtime
//
// For example, this can catch wrong imports caused by compiled code being located in /dist folder
// or missing files because of .npmignore
//
// Ideally, we should have a set of mocha tests running against snowflake-sdk package

// eslint-disable-next-line no-console
console.log('snowflae-sdk imported', snowflake);
