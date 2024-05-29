/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_ISTATEMENT_HPP
#define SNOWFLAKECLIENT_ISTATEMENT_HPP

#include "PutGetParseResponse.hpp"
#include "Proxy.hpp"
#include <iostream>

namespace Snowflake
{
namespace Client
{
/**
 * Interface that should be implemented by external component to interact
 * with server to get metadata/credentials about put/get command
 */
class IStatementPutGet
{
public:
  /**
   * Send put or get command to gs and get all data back.
   * This command will allocate a PutGetParseResponse object on heap,
   * Caller of this method is responsible for deallocating the memory
   *
   * @param sql put or get command
   * @param putGetParseResponse parse response. Object is owned by caller
   *
   * return true if parse succeed otherwise false
   */
  virtual bool parsePutGetCommand(std::string *sql,
                                  PutGetParseResponse *putGetParseResponse) = 0;

  /**
  * PUT/GET on GCS use this interface to perform put request.
  * Not implemented by default.
  * @param url The url of the request.
  * @param headers The headers of the request.
  * @param payload The upload data.
  * @param responseHeaders The headers of the response.
  *
  * return true if succeed otherwise false
  */
  virtual bool http_put(std::string const& url,
                        std::vector<std::string> const& headers,
                        std::basic_iostream<char>& payload,
                        size_t payloadLen,
                        std::string& responseHeaders)
  {
    return false;
  }

  /**
  * PUT/GET on GCS use this interface to perform put request.
  * Not implemented by default.
  * @param url The url of the request.
  * @param headers The headers of the request.
  * @param payload The upload data.
  * @param responseHeaders The headers of the response.
  * @param headerOnly True if get response header only without payload body.
  *
  * return true if succeed otherwise false
  */
  virtual bool http_get(std::string const& url,
                        std::vector<std::string> const& headers,
                        std::basic_iostream<char>* payload,
                        std::string& responseHeaders,
                        bool headerOnly)
  {
    return false;
  }

  virtual Util::Proxy* get_proxy()
  {
    return NULL;
  }

  // Utility functions to convert enconding between UTF-8 to the encoding
  // from system locale. No coversion by default.
  virtual std::string UTF8ToPlatformString(const std::string& utf8_str)
  {
    return std::string(utf8_str);
  }

  virtual std::string platformStringToUTF8(const std::string& platform_str)
  {
    return std::string(platform_str);
  }

  virtual ~IStatementPutGet()
  {

  }
};
}
}

#endif //SNOWFLAKECLIENT_ISTATEMENT_HPP
