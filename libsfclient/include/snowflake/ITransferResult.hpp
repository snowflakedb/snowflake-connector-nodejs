/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_ITRANSFERRESULT_HPP
#define SNOWFLAKECLIENT_ITRANSFERRESULT_HPP

#include "snowflake/PutGetParseResponse.hpp"

namespace Snowflake
{
namespace Client
{

/**
 * Interface consumed by external component to get transfer result
 *
 * Note: this objects is owned by IFileTransferAgent class, will be deallocated
 * once transfer agent go out of scope or a new put/get command is executed.
 *
 * External component need to consume result and copy result into whatever
 * class that is exposed to user.
 */
class ITransferResult
{
public:
  virtual ~ITransferResult() {}

  /**
   * @return return if has more result otherwise false
   */
  virtual bool next() = 0;

  /**
   * @return result size, a.k.a number of file that has been transferred
   */
  virtual size_t getResultSize() = 0;

  /**
   * @return number of column
   */
  virtual unsigned int getColumnSize() = 0;

  /**
   * @return column name given a column index, index starts from 0
   */
  virtual const char * getColumnName(unsigned int columnIndex) = 0;

  /**
   * @return column value as string
   */
  virtual void getColumnAsString(unsigned int columnIndex, std::string & value) = 0;

  /**
   * @return command type (upload or download) for file transfer
   */
  virtual CommandType getCommandType() = 0;

  /**
   * @return column index given column name
   */
  virtual int findColumnByName(const char *columnName, int columnNameSize) = 0;
};
}
}

#endif //SNOWFLAKECLIENT_ITRANSFERRESULT_HPP
