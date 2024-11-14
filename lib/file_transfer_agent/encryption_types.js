/*
 * Copyright (c) 2024 Snowflake Computing Inc. All rights reserved.
 */

const AES_CBC = {
  cipherName: function (keySizeInBytes) {
    return `aes-${keySizeInBytes * 8}-cbc`;
  },
  ivSize: 16
};

const AES_ECB = {
  cipherName: function (keySizeInBytes) {
    return `aes-${keySizeInBytes * 8}-ecb`;
  }
};

const AES_GCM = {
  cipherName: function (keySizeInBytes) {
    return `aes-${keySizeInBytes * 8}-gcm`;
  },
  ivSize: 12
};

exports = [AES_CBC, AES_GCM, AES_ECB];