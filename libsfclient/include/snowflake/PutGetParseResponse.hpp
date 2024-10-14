/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_PUTGETPARSERESPONSE_HPP
#define SNOWFLAKECLIENT_PUTGETPARSERESPONSE_HPP

#include <vector>
#include <string>
#include <unordered_map>
#include "snowflake/client.h"

namespace Snowflake
{
namespace Client
{

struct EncryptionMaterial
{
  EncryptionMaterial(char * queryStageMasterKey_,
                     char * queryId_,
                     long long smkId_)
  {
    this->queryStageMasterKey = std::string(queryStageMasterKey_);
    this->queryId = std::string(queryId_);
    this->smkId = smkId_;
  }
  /// master key to encrypt file key
  std::string queryStageMasterKey;

  ///  query id
  std::string queryId;

  /// smk id
  long long smkId;
};

enum StageType
{
  S3,
  AZURE,
  LOCAL_FS,
  GCS,

  /// This is used to create MOCKED storage client and is for testing purpose
  MOCKED_STAGE_TYPE,
};

struct StageInfo
{
  StageType stageType;

  std::string location;

  std::string path;

  // required by s3 client
  std::string region;

  std::string storageAccount; //Required by Azure

  std::string endPoint;       //Required by Azure & for S3 FIPS

  std::string presignedUrl;   //Required by GCS for uploading

  std::unordered_map<std::string, char *> credentials;
};


enum CommandType
{
  UPLOAD, DOWNLOAD, UNKNOWN
};

/**
 * PUT/GET command response from server.
 */
struct PutGetParseResponse
{
  int parallel;

  size_t threshold;

  bool autoCompress;

  bool overwrite;

  bool clientShowEncryptionParameter;

  char* sourceCompression;

  char* localLocation;

  CommandType command;

  std::vector<std::string> srcLocations;

  /// for put command, size is always 1, while for get,
  /// encryption mat can be a list
  std::vector<EncryptionMaterial> encryptionMaterials;

  // Presigned URLs for downloading
  std::vector<std::string> presignedUrls;

  StageInfo stageInfo;
};

}
}


#endif //SNOWFLAKECLIENT_PUTGETPARSERESPONSE_HPP
