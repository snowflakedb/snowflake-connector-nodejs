/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_ISFLOGGER_HPP
#define SNOWFLAKECLIENT_ISFLOGGER_HPP

#include "snowflake/logger.h"
#include "snowflake/basic_types.h"
#include "snowflake/platform.h"

namespace Snowflake
{
namespace Client
{
class ISFLogger
{
public:
  virtual ~ISFLogger() {}

  /**
   * Method used internally in SFLogger.cpp, which call logLineVA
   */
  void logLine(SF_LOG_LEVEL logLevel, const char * fileName, const char * msgFmt,
               ...);

  /**
   * Method implemented by external logger
   */
  virtual void logLineVA(SF_LOG_LEVEL logLevel,
                         const char * ns,
                         const char * className,
                         const char * msgFmt,
                         va_list &args) = 0;

  /**
   * Method could overridden by external logger to identify if mask on secret
   * information is needed.
   */
  virtual sf_bool needSecretMask()
  {
      return SF_BOOLEAN_TRUE;
  }

  /**
   * Method could overridden by external logger to return the log level.
   * When mask on secret information is needed, return actual log level
   * so the masking will perform only when the log will be written and
   * reduce the impact on performance.
   */
  virtual SF_LOG_LEVEL getLogLevel()
  {
      return SF_LOG_TRACE;
  }
};
}
}

#endif //SNOWFLAKECLIENT_ISFLOGGER_HPP
