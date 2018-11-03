/*
 * This software is licensed under the MIT License.
 *
 * Copyright Fedor Indutny, 2015.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use strict';

var ocsp = require('ocsp');
var verify = require('./verify');

var rfc2560 = require('asn1.js-rfc2560');

var Logger = require('../logger');

module.exports = function check(options, cb) {
  var sync = true;
  var req;

  function done(err, data) {
    if (sync) {
      sync = false;
      process.nextTick(function() {
        cb(err, data);
      });
      return;
    }

    cb(err, data);
  }

  try {
    req = ocsp.request.generate(options.cert, options.issuer);
  } catch (e) {
    return done(e);
  }

  var ocspMethod = rfc2560['id-pkix-ocsp'].join('.');
  ocsp.utils.getAuthorityInfo(req.cert, ocspMethod, function(err, uri) {

    if (err)
      return done(err);

    Logger.getInstance().trace('Contacting OCSP responder: %s', uri);

    ocsp.utils.getResponse(uri, req.data, function(err, raw) {
      if (err)
        return done(err);

      verify({
        request: req,
        response: raw
      }, done);
    });
  });

  sync = false;
};