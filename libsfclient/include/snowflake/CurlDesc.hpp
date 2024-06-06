/*
 * Copyright (c) 2024 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKE_CURLDESC_HPP
#define	SNOWFLAKE_CURLDESC_HPP

#include "snowflake/BaseClasses.hpp"
#include "snowflake/SFURL.hpp"
#include <curl/curl.h>

namespace Snowflake
{
namespace Client
{
/**
 * Class CurlDesc
 */
class CurlDesc: private DoNotCopy
{
public:

  /**
   * Constructor
   *
   * @param (IN/NULL) shareDesc
   *   shared descriptor, use null if not used
   */
  CurlDesc(CURLSH *shareDesc);

  /**
   * Destructor, no-op
   */
  virtual ~CurlDesc();

  /**
   * Get underlying curl descriptor for this request
   */
  CURL *getCurl()
  {
    return(m_curl);
  }

  std::string getUrlStr()
  {
    return m_url.toString();
  }

  /**
   * Reset the descriptor and make it ready to be reused
   *
   * @param cleanup
   *   if true, descriptor should be re-created
   */
  virtual void reset(bool cleanup = false);

protected:

  /** shared descriptor to use. Can be null if we should not use shared desc */
  CURLSH *m_shareCurl;

  /** Curl easy open descriptor */
  CURL *m_curl;

  /** url set at prepare time */
  SFURL m_url;

};
}
}

#endif	/* SNOWFLAKE_CURLDESC_HPP */

