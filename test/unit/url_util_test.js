/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */
var URLUtil = require('./../../lib/url_util');
var assert = require('assert');

describe('URLUtil', function ()
{
    it('Valid URL', function ()
    {
        assert.ok(URLUtil.isValidURL("https://ssoTestURL.okta.com"))
        assert.ok(URLUtil.isValidURL("https://ssoTestURL.okta.com:8080"))
        assert.ok(URLUtil.isValidURL("https://ssoTestURL.okta.com/testpathvalue"))
    });

    it('Invalid URL', function ()
    {
        assert.ok(!URLUtil.isValidURL("-a Calculator"))
        assert.ok(!URLUtil.isValidURL("This is random text"))
        assert.ok(!URLUtil.isValidURL("file://TestForFile"))
    });
    
    it('Encode URL', function () {
        assert.equal(URLUtil.urlEncode("Hello @World"), "Hello+%40World")
        assert.equal(URLUtil.urlEncode("Test//String"), "Test%2F%2FString")
        assert.equal(URLUtil.urlEncode("Test+Plus"), "Test%2BPlus")
    });
});