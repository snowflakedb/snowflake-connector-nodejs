/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_IFILETRANSFERAGENT_HPP
#define SNOWFLAKECLIENT_IFILETRANSFERAGENT_HPP

#include "ITransferResult.hpp"
#include "ISFLogger.hpp"
#include "IStatementPutGet.hpp"
#include "Proxy.hpp"

namespace Snowflake
{
namespace Client
{

/**
 * Config struct that is passed from external component
 */
struct TransferConfig
{
  TransferConfig() :
    caBundleFile(NULL),
    tempDir(NULL),
    useS3regionalUrl(false),
    compressLevel(-1),
    proxy(NULL),
    getSizeThreshold(0) {}
  char * caBundleFile;
  char * tempDir;
  bool useS3regionalUrl;
  int compressLevel;
  Util::Proxy * proxy;
  long getSizeThreshold;
};

class IFileTransferAgent
{
public:
  virtual ~IFileTransferAgent() {};
  /**
   * Called by external component to execute put/get command
   * @param command put/get command
   * @return a fixed view result set representing upload/download result
   */
  virtual ITransferResult *execute(std::string *command) = 0;

  /**
  * Set upload stream to enable upload file from stream in memory.
  * @param uploadStream The stream to be uploaded.
  * @param dataSize The data size of the stream.
  */
  virtual void setUploadStream(std::basic_iostream<char>* uploadStream,
                               size_t dataSize) = 0;
  /**
   * Static method to instantiate a IFileTransferAgent class
   * @return a newly allocated IFileTransferAgent, caller need to delete instance
   */
  static IFileTransferAgent *getTransferAgent(
    IStatementPutGet * statementPutGet,
    TransferConfig * transferConfig);


  /**
   * Used by ODBC to inject logger. If this method is not called, default logger
   * will be used.
   */
  static void injectExternalLogger(ISFLogger * logger);

  /**
   * Set useUrand to true to use /dev/urandom device
   * Set it to false to use /dev/random device
   * @param useUrand
   */
  virtual void setRandomDeviceAsUrand(bool useUrand){};

  /**
   * Enable fast fail by setting it to true.
   * For wild char uploads, the put command will be marked as failed when the first file
   * fails to upload and the rest of the files will not be uploaded.
   * In multi thread case, if the parallel threads start uploading and one of the file fails to upload
   * then the already started threads will continue and try to upload but no further files will be uploaded.
   * @param putFastFail
   */
  virtual void setPutFastFail(bool putFastFail){};

  /**
   * Set max number of retries for put fails
   * @param maxRetries: max number of retries.
   */
  virtual void setPutMaxRetries(int maxRetries){};

  /**
  * Enable fast fail for get by setting it to true.
  * @param getFastFail
  */
  virtual void setGetFastFail(bool getFastFail) {};

  /**
  * Set max number of retries for get fails
  * @param maxRetries: max number of retries.
  */
  virtual void setGetMaxRetries(int maxRetries) {};

};

}
}
#endif //SNOWFLAKECLIENT_IFILETRANSFERAGENT_HPP
