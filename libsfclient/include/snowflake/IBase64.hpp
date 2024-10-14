/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_IBASE64_HPP
#define SNOWFLAKECLIENT_IBASE64_HPP

#include <vector>
#include <string>

namespace Snowflake
{
namespace Client
{
namespace Util
{
class Base64DecodeException : public std::exception
{
public:
  explicit Base64DecodeException(const std::string &message) : message_(message) {}

  const char *what() const throw() override
  {
    return message_.c_str();
  }

private:
  std::string message_;
};

/**
 * This class provide a bunch of useful c++ style interface for base64 encoding
 */
class IBase64
{
public:
  /**
   * Encode a vector of bytes into a string in Base64URL format with no padding
   */
  static std::string encodeURLNoPadding(const std::vector<char> &bytes);

  /**
   * Decode a string of coded Base64URL format with no padding to a vector of bytes
   * @throw Base64DecodeException when the code is not valid base64URL encoded
   */
  static std::vector<char> decodeURLNoPadding(const std::string &code);

  /**
   * Encode a vector of bytes into a Base64 format with padding
   */
  static std::string encodePadding(const std::vector<char> &bytes);

  /**
   * Decode a string of coded base64 format with padding to a vector of bytes
   * @throw Base64EncodeException when the code is not valid base64 encoded
   */
  static std::vector<char> decodePadding(const std::string &code);
};
  
} // namespace Util
} // namespace Client
} // namespace Snowflake

#endif //SNOWFLAKECLIENT_IBASE64_HPP
