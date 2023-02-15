/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var testUtil = require('./testUtil');

var connection;
var files = new Array();

function uploadFiles(callback, index = 0)
{
  if(index < files.length)
  {
    var putQuery = 'PUT file://'+files[index]+ " @SmallFilesStage overwrite=true auto_compress=false source_compression=gzip";
    var insertStmt = connection.execute({
      sqlText: putQuery,
      complete: function (err, stmt) {
        testUtil.checkError(err);
        if(!err)
        {
          index++;
          if(index < files.length)
          {
            uploadFiles(index);
          }
          else
          {
            callback();
          }
        }
      }
    });
  }
}

describe('Test Concurrent Execution', function ()
{
  
  var createStage = "create or replace stage SmallFilesStage file_format=( type=csv field_optionally_enclosed_by='\"')";
  

  before(function (done)
  {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: createStage,
        complete: function (err)
        {
          testUtil.checkError(err);
          done();
        }
      });
    });
  });

  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });

  it('testPutSmallFiles', function (done)
  {
    async.series(
      [
        function(callback)
        {
          var arrBind = [];
          var filesize = 1024;
          var count = 5000;
          for(var i = 0; i<count; i++)
          {
            arrBind.push(['string'+i, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
          }
          
          var fileCount = 0;
          var strbuffer = "";
          
          var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp'));
          if (tmpDir.indexOf('~') != -1 && process.platform === "win32") {
            var tmpFolderName = tmpDir.substring(tmpDir.lastIndexOf('\\'));
            tmpDir = process.env.USERPROFILE + '\\AppData\\Local\\Temp\\' + tmpFolderName;
          }

          for(var i=0; i<arrBind.length; i++)
          {
            for(var j=0; j<arrBind.length; j++)
            {
              if(j>0)
                strbuffer += ',';
                strbuffer += arrBind[i][j];
            }
            strbuffer += '\n';

            if((strbuffer.length >= filesize) || (i == arrBind.length-1))
            {
              var fileName = tmpDir + "\\" + (++fileCount).toString();
              fs.writeFileSync(fileName, strbuffer);
              files.push(fileName);
              strbuffer = "";
            }
          }
          var callbackfunc = function()
          {
            for(var fileName in files)
            {
              if(fs.existsSync(fileName))
              {
                fs.unlinkSync(fileName);
              }
            }
            done();
          }
          uploadFiles(callbackfunc,0);
          
        },
      ],
      done
    );
  });
});
