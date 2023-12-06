/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

function CustomCredentialManager(storage) {
  this.storage = storage;
  
  this.read = function (host, user, credType) {

    return storage.read(this.buildKey(host, user, credType));
  };
  
  this.write = function (host, user, credType, credential) {
    storage.write(this.buildKey(host, user, credType), credential);
  };
  
  this.remove = function (host, user, credType) {
    storage.remove(this.buildKey(host, user, credType));
  };

  this.buildKey = function (host, user, credType) {
    return `{${host.toUpperCase()}}:{${user.toUpperCase()}}:{SF_NODE_JS_DRIVER}:{${credType.toUpperCase()}}}`;
  };
}

exports.CustomCredentialManager = CustomCredentialManager;
  