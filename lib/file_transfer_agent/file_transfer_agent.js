/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var binascii = require('binascii');
var glob = require("glob");
var fs = require('fs');
var os = require('os');
var mime = require('mime-types');
var path = require('path');

var statement = require('../connection/statement');
var fileCompressionType = require('./file_compression_type');
var expandTilde = require('expand-tilde');
var SnowflakeFileUtil = new (require('./file_util').file_util)();
var SnowflakeRemoteStorageUtil = new (require('./remote_storage_util').remote_storage_util)();
var SnowflakeFileEncryptionMaterial = require('./remote_storage_util').SnowflakeFileEncryptionMaterial;
var SnowflakeS3Util = new (require('./s3_util'))();
var SnowflakeLocalUtil = new (require('./local_util').local_util)();

var resultStatus = require('./file_util').resultStatus;

const S3_FS = 'S3';
const AZURE_FS = 'AZURE';
const GCS_FS = 'GCS';
const LOCAL_FS = 'LOCAL_FS';
const CMD_TYPE_UPLOAD = 'UPLOAD';
const CMD_TYPE_DOWNLOAD = 'DOWNLOAD';
const FILE_PROTOCOL = 'file://';

var INJECT_WAIT_IN_PUT = 0


const RESULT_TEXT_COLUMN_DESC = function (name) 
{
  return {
    'name': name,
    'type': 'text',
    'length': 16777216,
    'precision': null,
    'scale': null,
    'nullable': false
  };
}
const RESULT_FIXED_COLUMN_DESC = function (name)
{
  return {
    'name': name,
    'type': 'fixed',
    'length': 5,
    'precision': 0,
    'scale': 0,
    'nullable': false
  };
}
/**
 * Creates a file transfer agent.
 *
 * @param {Object} context
 *
 * @returns {Object}
 * @constructor
 */
function file_transfer_agent(context)
{
  var context = context;
  var response = context.fileMetadata;
  var command = context.sqlText;

  var commandType;
  var encryptionMaterial = [];
  var fileName;

  var autoCompress;
  var sourceCompression;
  var parallel;
  var stageInfo;
  var stageLocationType;
  var presignedUrls;
  var overwrite;

  var useAccelerateEndpoint = false;

  var srcFiles;
  var srcFilesToEncryptionMaterial = {};
  var localLocation;

  var results = [];

  // Store info of files retrieved
  var filesToPut = [];

  // Store metadata of files retrieved
  var fileMetadata = [];
  var smallFileMetas = [];
  var largeFileMetas = [];

  /**
  * Execute PUT or GET command.
  *
  * @returns {null}
  */
  this.execute = async function ()
  {
    parseCommand();

    initFileMetadata();

    if (commandType === CMD_TYPE_UPLOAD)
    {
      if (filesToPut.length === 0)
      {
        throw new Error('No file found for: ' + fileName);
      }

      processFileCompressionType();
    }

    if (commandType === CMD_TYPE_DOWNLOAD)
    {
      if (!fs.existsSync(localLocation))
      {
        fs.mkdirSync(localLocation);
      }

    }

    if (stageLocationType === LOCAL_FS)
    {
      process.umask(0);
      if (!fs.existsSync(stageInfo['location']))
      {
        fs.mkdirSync(stageInfo['location'], { mode: 0o777, recursive: true });
      }
    }

    await transferAccelerateConfig();

    await updateFileMetasWithPresignedUrl();

    for (var meta of fileMetadata)
    {
      if (meta['srcFileSize'] > SnowflakeS3Util.DATA_SIZE_THRESHOLD)
      {
        // Add to large file metas
        meta['parallel'] = parallel;
        largeFileMetas.push(meta);
      }
      else
      {
        // Add to small file metas and set parallel to 1
        meta['parallel'] = 1;
        smallFileMetas.push(meta);
      }
    }

    if (commandType === CMD_TYPE_UPLOAD)
    {
      await upload(largeFileMetas, smallFileMetas)
    }

    if (commandType === CMD_TYPE_DOWNLOAD)
    {
      await download(largeFileMetas, smallFileMetas)
    }
  }

  /**
  * Generate the rowset and rowset types using the file metadatas.
  *
  * @returns {Object}
  */
  this.result = function ()
  {
    var rowset = [];
    if (commandType === CMD_TYPE_UPLOAD)
    {
      var srcFileSize;
      var dstFileSize;
      var srcCompressionType;
      var dstCompressionType;
      var errorDetails;

      if (results)
      {
        for (var meta of results)
        {
          if (meta['srcCompressionType'])
          {
            srcCompressionType = meta['srcCompressionType']['name'];
          }
          else
          {
            srcCompressionType = null;
          }

          if (meta['dstCompressionType'])
          {
            dstCompressionType = meta['dstCompressionType']['name'];
          }
          else
          {
            dstCompressionType = null;
          }

          errorDetails = meta['errorDetails'];

          srcFileSize = meta['srcFileSize'].toString();
          dstFileSize = meta['dstFileSize'].toString();

          rowset.push([
            meta['srcFileName'],
            meta['dstFileName'],
            srcFileSize,
            dstFileSize,
            srcCompressionType,
            dstCompressionType,
            meta['resultStatus'],
            errorDetails
          ]);
        }
      }
      return {
        'rowset': rowset,
        'rowtype': [
          RESULT_TEXT_COLUMN_DESC('source'),
          RESULT_TEXT_COLUMN_DESC('target'),
          RESULT_FIXED_COLUMN_DESC('sourceSize'),
          RESULT_FIXED_COLUMN_DESC('targetSize'),
          RESULT_TEXT_COLUMN_DESC('sourceCompression'),
          RESULT_TEXT_COLUMN_DESC('targetCompression'),
          RESULT_TEXT_COLUMN_DESC('status'),
          RESULT_TEXT_COLUMN_DESC('message'),
        ]
      };
    }
    else if (commandType === CMD_TYPE_DOWNLOAD)
    {
      var dstFileSize;
      var errorDetails;

      if (results)
      {
        for (var meta of results)
        {
          errorDetails = meta['errorDetails'];
          dstFileSize = meta['dstFileSize'];

          rowset.push([
            meta['dstFileName'],
            dstFileSize,
            meta['resultStatus'],
            errorDetails
          ]);
        }
      }

      return {
        'rowset': rowset,
        'rowtype': [
          RESULT_TEXT_COLUMN_DESC('file'),
          RESULT_FIXED_COLUMN_DESC('size'),
          RESULT_TEXT_COLUMN_DESC('status'),
          RESULT_TEXT_COLUMN_DESC('message')
        ]
      };
    }
  }

  /**
  * Upload files in the metadata list.
  *
  * @returns {null}
  */
  async function upload(largeFileMetas, smallFileMetas)
  {
    var storageClient = getStorageClient(stageLocationType);
    var client = storageClient.createClient(stageInfo, false);

    for (var meta of smallFileMetas)
    {
      meta['client'] = client;
    }
    for (var meta of largeFileMetas)
    {
      meta['client'] = client;
    }

    if (smallFileMetas.length > 0)
    {
      //await uploadFilesinParallel(smallFileMetas);
      await uploadFilesinSequential(smallFileMetas);
    }
    if (largeFileMetas.length > 0)
    {
      await uploadFilesinSequential(largeFileMetas);
    }
  }

  /**
  * Upload a file sequentially.
  *
  * @param {Object} fileMeta
  *
  * @returns {null}
  */
  async function uploadFilesinSequential(fileMeta)
  {
    var index = 0;
    var fileMetaLen = fileMeta.length;

    while (index < fileMetaLen)
    {
      var result = await uploadOneFile(fileMeta[index]);      
      if (result['resultStatus'] == resultStatus.RENEW_TOKEN)
      {
        var client = renewExpiredClient();
        for (var index2 = index; index2 < fileMetaLen; index2++)
        {
          fileMeta[index2]['client'] = client;
        }
        continue;
      }
      else if (result['resultStatus'] == resultStatus.RENEW_PRESIGNED_URL)
      {
        await updateFileMetasWithPresignedUrl()
        continue;
      }
      results.push(result);
      index += 1;
      if (INJECT_WAIT_IN_PUT > 0)
      {
        await new Promise(resolve => setTimeout(resolve, INJECT_WAIT_IN_PUT));
      }      
    }
  }

  /**
  * Generate a temporary directory for the file then upload.
  *
  * @param {Object} meta
  *
  * @returns {Object}
  */
  async function uploadOneFile(meta)
  {
    meta['realSrcFilePath'] = meta['srcFilePath'];
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp'));
    meta['tmpDir'] = tmpDir;
    try
    {
      if (meta['requireCompress'])
      {
        var result = await SnowflakeFileUtil.compressFileWithGZIP(meta['srcFilePath'], meta['tmpDir']);
        meta['realSrcFilePath'] = result.name;
      }
      var result = await SnowflakeFileUtil.getDigestAndSizeForFile(meta['realSrcFilePath']);
      var sha256_digest = result.digest;
      var uploadSize = result.size;

      meta['SHA256_DIGEST'] = sha256_digest;
      meta['uploadSize'] = uploadSize;

      var storageClient = getStorageClient(meta['stageLocationType']);
      await storageClient.uploadOneFileWithRetry(meta);
    }
    catch (err)
    {
      meta['dstFileSize'] = 0;
      if (meta['resultStatus'])
      {
        meta['resultStatus'] = resultStatus.ERROR;

      }
      meta['errorDetails'] = err.toString();
      meta['errorDetails'] += ` file=${meta['srcFileName']}, real file=${meta['realSrcFilePath']}`;
    }
    finally
    {
      // Remove all files inside tmp folder
      var matchingFileNames = glob.sync(path.join(meta['tmpDir'], meta['srcFileName'] + "*"));
      for (var matchingFileName of matchingFileNames)
      {
        await new Promise((resolve, reject) =>
        {
          fs.unlink(matchingFileName, err =>
          {
            if (err)
            {
              reject(err);
            }
            resolve();
          });
        });
      }
      // Delete tmp folder
      fs.rmdir(meta['tmpDir'], (err) =>
      {
        if (err)
        {
          throw(err);
        }

      });
    }

    return meta;
  }
  
  /**
  * Download files in the metadata list.
  *
  * @returns {null}
  */
  async function download(largeFileMetas, smallFileMetas)
  {
    var storageClient = getStorageClient(stageLocationType);
    var client = storageClient.createClient(stageInfo, false);

    for (var meta of smallFileMetas)
    {
      meta['client'] = client;
    }
    for (var meta of largeFileMetas)
    {
      meta['client'] = client;
    }

    if (smallFileMetas.length > 0)
    {
      //await downloadFilesinParallel(smallFileMetas);
      await downloadFilesinSequential(smallFileMetas);
    }
    if (largeFileMetas.length > 0)
    {
      await downloadFilesinSequential(largeFileMetas);
    }
  }

  /**
  * Download a file sequentially.
  *
  * @param {Object} fileMeta
  *
  * @returns {null}
  */
  async function downloadFilesinSequential(fileMeta)
  {
    var index = 0;
    var fileMetaLen = fileMeta.length;

    while (index < fileMetaLen)
    {
      var result = await downloadOneFile(fileMeta[index]);
      if (result['resultStatus'] == resultStatus.RENEW_TOKEN)
      {
        var client = renewExpiredClient();
        for (var index2 = index; index2 < fileMetaLen; index2++)
        {
          fileMeta[index2]['client'] = client;
        }
        continue;
      }
      else if (result['resultStatus'] == resultStatus.RENEW_PRESIGNED_URL)
      {
        await updateFileMetasWithPresignedUrl()
        continue;
      }
      results.push(result);
      index += 1;
      if (INJECT_WAIT_IN_PUT > 0)
      {
        await new Promise(resolve => setTimeout(resolve, INJECT_WAIT_IN_PUT));
      }
    }
  }

  /**
  * Download a file and place into the target directory.
  *
  * @param {Object} meta
  *
  * @returns {Object}
  */
  async function downloadOneFile(meta)
  {
    var tmpDir = await new Promise((resolve, reject) =>
    {
      fs.mkdtemp(path.join(os.tmpdir(), 'tmp'), (err, dir) =>
      {
        if (err) reject(err);
        resolve(dir);
      });
    });

    meta['tmpDir'] = tmpDir;
    try
    {
      var storageClient = getStorageClient(meta['stageLocationType']);
      await storageClient.downloadOneFile(meta);
    }
    catch (err)
    {
      meta['dstFileSize'] = -1;
      if (meta['resultStatus'])
      {
        meta['resultStatus'] = resultStatus.ERROR;

      }
      meta['errorDetails'] = err.toString();
      meta['errorDetails'] += ` file=${meta['dstFileName']}`;
    }

    return meta;
  }

  /**
  * Determine whether to acceleration configuration for S3 clients.
  *
  * @returns {null}
  */
  async function transferAccelerateConfig()
  {
    if (stageLocationType === S3_FS)
    {
      var client = SnowflakeRemoteStorageUtil.createClient(stageInfo, false);
      var s3location = SnowflakeS3Util.extractBucketNameAndPath(stageInfo['location']);

      await client.getBucketAccelerateConfiguration({ Bucket: s3location.bucketName })
        .promise()
        .then(function (data)
        {
          useAccelerateEndpoint = data['Status'] == 'Enabled';
        }).catch(function (err)
        {
          if (err['code'] === 'AccessDenied')
          {
            return;
          }
        });
    }
  }

  /**
  * Update presigned URLs of file metadata when using GCS client.
  *
  * @returns {null}
  */
  async function updateFileMetasWithPresignedUrl()
  {
    var storageClient = getStorageClient(stageLocationType);

    // presigned url only applies to remote storage
    if (storageClient === SnowflakeRemoteStorageUtil)
    {
      // presigned url only applies to GCS
      if (stageLocationType === GCS_FS)
      {
        if (commandType == CMD_TYPE_UPLOAD)
        {
          var filePathToReplace = getFileNameFromPutCommand(command);

          for (var meta of fileMetadata)
          {
            var fileNameToReplaceWith = meta['dstFileName'];
            var commandWithSingleFile = command;
            var commandWithSingleFile = commandWithSingleFile.replace(filePathToReplace, fileNameToReplaceWith);

            var options = { sqlText: commandWithSingleFile };
            var newContext = statement.createContext(options, context.services, context.connectionConfig);

            var ret = await statement.sendRequest(newContext);
            meta['stageInfo'] = ret['data']['data']['stageInfo']
            meta['presignedUrl'] = meta['stageInfo']['presignedUrl'];
          }
        }
        else if (commandType == CMD_TYPE_DOWNLOAD)
        {
          for (var index = 0; index < fileMetadata.length; index++)
          {
            fileMetadata[index]['presignedUrl'] = presignedUrls[index];
          }
        }
      }
    }
  }

  /**
  * Returns the local file path.
  *
  * @param {String} command
  *
  * @returns {String}
  */
  function getFileNameFromPutCommand(command)
  {
    // Extract file path from PUT command:
    // E.g. "PUT file://C:<path-to-file> @DB.SCHEMA.%TABLE;"
    var startIndex = command.indexOf(FILE_PROTOCOL) + FILE_PROTOCOL.length;
    var spaceIndex = command.substring(startIndex).indexOf(' ');
    var quoteIndex = command.substring(startIndex).indexOf('\'');
    var endIndex = spaceIndex;
    if(quoteIndex != -1 && quoteIndex < spaceIndex)
      endIndex = quoteIndex;
    var filePath = command.substring(startIndex, startIndex + endIndex);
    return filePath;
  }

  /**
  * Get the storage client based on stage location type.
  *
  * @param {String} stageLocationType
  *
  * @returns {Object}
  */
  function getStorageClient(stageLocationType)
  {
    if (stageLocationType == LOCAL_FS)
    {
      return SnowflakeLocalUtil;
    }
    else if (stageLocationType === S3_FS ||
      stageLocationType === AZURE_FS ||
      stageLocationType === GCS_FS)
    {
      return SnowflakeRemoteStorageUtil;
    }
    else
    {
      return null;
    }
  }

  /**
  * Parse the command and get list of files to upload/download.
  *
  * @returns {null}
  */
  function parseCommand()
  {
    var data = response['data'];
    commandType = data['command'];

    initEncryptionMaterial();

    if (commandType === CMD_TYPE_UPLOAD)
    {
      var src = data['src_locations'][0];

      // Get root directory of file path
      var root = path.dirname(src);

      // Check root directory exists
      if (fs.existsSync(root))
      {
        // Check the root path is a directory
        var dir = fs.statSync(root);

        if (dir.isDirectory())
        {
          // Get file name to upload
          fileName = path.basename(src);

          // Full path name of the file
          var fileNameFullPath = path.join(root, fileName);

          // If file name has a wildcard
          if (fileName.includes('*'))
          {
            // Get all file names that matches the wildcard
            var matchingFileNames = glob.sync(path.join(root, fileName));

            for (var matchingFileName of matchingFileNames)
            {
              var fileInfo = fs.statSync(matchingFileName);
              var currFileObj = {};
              currFileObj['srcFileName'] = matchingFileName.substring(matchingFileName.lastIndexOf('/') + 1);
              currFileObj['srcFilePath'] = matchingFileName;
              currFileObj['srcFileSize'] = fileInfo.size;

              filesToPut.push(currFileObj);
            }
          }
          else
          {
            // No wildcard, get single file
            if (fs.existsSync(root))
            {
              var fileInfo = fs.statSync(fileNameFullPath);

              var currFileObj = {};
              currFileObj['srcFileName'] = fileName;
              currFileObj['srcFilePath'] = fileNameFullPath;
              currFileObj['srcFileSize'] = fileInfo.size;

              filesToPut.push(currFileObj);
            }
          }
        }
      }
      else
      {
        throw new Error(dir + ' is not a directory');
      }

      autoCompress = data['autoCompress'];
      sourceCompression = data['sourceCompression'];
    }
    else if (commandType === CMD_TYPE_DOWNLOAD)
    {
      srcFiles = data['src_locations'];

      if (srcFiles.length == encryptionMaterial.length)
      {
        for (const idx in srcFiles)
        {
          srcFilesToEncryptionMaterial[srcFiles[idx]] = encryptionMaterial[idx];
        }
      }
      else if (encryptionMaterial.length !== 0)
      {
        // some encryption material exists. Zero means no encryption
        throw new Error("The number of downloading files doesn't match");
      }
      localLocation = expandTilde(data["localLocation"]);
      var dir = fs.statSync(localLocation);
      if (!dir.isDirectory())
      {
        throw new Error("The local path is not a directory: " + localLocation);
      }
    }

    parallel = data['parallel'];
    stageInfo = data['stageInfo'];
    stageLocationType = stageInfo['locationType'];
    presignedUrls = data['presignedUrls'];
    overwrite = data['overwrite'];
  }

  /**
  * Generate encryption material for each metadata.
  *
  * @returns {null}
  */
  function initEncryptionMaterial()
  {
    if (response['data'] && response['data']['encryptionMaterial'])
    {
      var rootNode = response['data']['encryptionMaterial'];

      if (commandType === CMD_TYPE_UPLOAD)
      {
        encryptionMaterial.push(new SnowflakeFileEncryptionMaterial(
          rootNode['queryStageMasterKey'],
          rootNode['queryId'],
          rootNode['smkId']));
      }
      else if (commandType === CMD_TYPE_DOWNLOAD)
      {
        for (const elem in rootNode)
        {
          encryptionMaterial.push(new SnowflakeFileEncryptionMaterial(
            rootNode[elem]['queryStageMasterKey'],
            rootNode[elem]['queryId'],
            rootNode[elem]['smkId']));
        }
      }
    }
  }

  /**
  * Generate metadata for files to upload/download.
  *
  * @returns {null}
  */
  function initFileMetadata()
  {
    if (commandType === CMD_TYPE_UPLOAD)
    {
      for (var file of filesToPut)
      {
        var currFileObj = {};
        currFileObj['srcFilePath'] = file['srcFilePath'];
        currFileObj['srcFileName'] = file['srcFileName'];
        currFileObj['srcFileSize'] = file['srcFileSize'];
        currFileObj['stageLocationType'] = stageLocationType;
        currFileObj['stageInfo'] = stageInfo;
        currFileObj['overwrite'] = overwrite;

        fileMetadata.push(currFileObj);
      }
    }
    else if (commandType === CMD_TYPE_DOWNLOAD)
    {
      for (var fileName of srcFiles)
      {
        var currFileObj = {};
        currFileObj['srcFileName'] = fileName;
        currFileObj['dstFileName'] = fileName;
        currFileObj['stageLocationType'] = stageLocationType;
        currFileObj['stageInfo'] = stageInfo;
        currFileObj['useAccelerateEndpoint'] = useAccelerateEndpoint;
        currFileObj['localLocation'] = localLocation;
        currFileObj['encryptionMaterial'] = srcFilesToEncryptionMaterial[fileName];

        fileMetadata.push(currFileObj);
      }
    }

    if (encryptionMaterial.length > 0)
    {
      for (var file of fileMetadata)
      {
        file['encryptionMaterial'] = encryptionMaterial[0];
      }
    }
  }

  /**
  * Get the compression type of the file.
  *
  * @returns {null}
  */
  function processFileCompressionType()
  {
    var userSpecifiedSourceCompression;
    var autoDetect;
    if (sourceCompression == 'auto_detect')
    {
      autoDetect = true;

    }
    else if (sourceCompression == typeof('undefined'))
    {
      autoDetect = false;
    }
    else
    {
      userSpecifiedSourceCompression = fileCompressionType.lookupByMimeSubType(sourceCompression);
      if (userSpecifiedSourceCompression == typeof ('undefined') || !userSpecifiedSourceCompression['is_supported'])
      {
        throw new Error(sourceCompression + ' is not a supported compression type');
      }
      autoDetect = false;
    }

    for (var meta of fileMetadata)
    {
      var fileName = meta['srcFileName'];
      var filePath = meta['srcFilePath'];

      var currentFileCompressionType;

      if (autoDetect)
      {
        var encoding = mime.lookup(fileName);

        if (!encoding)
        {
          var test = Buffer.alloc(4);
          var fd = fs.openSync(filePath, 'r+');
          fs.readSync(fd, test, 0, 4, 0);
          fs.closeSync(fd);

          if (fileName.substring(fileName.lastIndexOf('.')) === '.br')
          {
            encoding = 'br';
          }
          else if (fileName.substring(fileName.lastIndexOf('.')) === '.deflate')
          {
            encoding = 'deflate';
          }
          else if (fileName.substring(fileName.lastIndexOf('.')) === '.raw_deflate')
          {
            encoding = 'raw_deflate';
          }
          else if (Buffer.from(test.toString()).slice(0, 3) === Buffer.from('ORC'))
          {
            encoding = 'orc';
          }
          else if (Buffer.from(test.toString()) === Buffer.from('PAR1'))
          {
            encoding = 'parquet';
          }
          else if (binascii.hexlify(test.toString()) === "28fd2ffd" ||
            fileName.substring(fileName.lastIndexOf('.')) === '.zst')
          {
            encoding = 'zstd';
          }
        }

        if (encoding)
        {
          currentFileCompressionType = fileCompressionType.lookupByEncoding(encoding);
        }
        // else {} No file encoding detected

        if (currentFileCompressionType && !currentFileCompressionType['is_supported'])
        {
          throw new Error(encoding + ' is not a a supported compression type');
        }
      }
      else
      {
        currentFileCompressionType = userSpecifiedSourceCompression;
      }

      if (currentFileCompressionType)
      {
        if (currentFileCompressionType['is_supported'])
        {
          meta['dstCompressionType'] = currentFileCompressionType;
          meta['requireCompress'] = false;
          meta['dstFileName'] = meta['srcFileName'];
        }
        else
        {
          throw new Error(encoding + ' is not a a supported compression type');
        }
      }
      else
      {
        meta['requireCompress'] = autoCompress;
        meta['srcCompressionType'] = null;

        // If requireCompress is true, destination file extension is changed to zip
        if (autoCompress)
        {
          // Compress with gzip
          meta['dstCompressionType'] = fileCompressionType.lookupByMimeSubType('GZIP');
          meta['dstFileName'] = meta['srcFileName'] + meta['dstCompressionType']['file_extension'];
        }
        else
        {
          meta['dstFileName'] = meta['srcFileName'];
          meta['dstCompressionType'] = null;
        }
      }
    }
  }
}

module.exports = file_transfer_agent;
