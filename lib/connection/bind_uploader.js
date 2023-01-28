/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */
 var Logger = require('../logger');

const Readable = require('stream').Readable;
const fs = require('fs');
const tmp = require('tmp');

var Statement = require('./statement');
var fileCompressionType = require('.././file_transfer_agent/file_compression_type');

const STAGE_NAME = 'SYSTEM$BIND';
const CREATE_STAGE_STMT = "CREATE OR REPLACE TEMPORARY STAGE "
	+ STAGE_NAME
	+ " file_format=( type=csv field_optionally_enclosed_by='\"')";
	
/**
 * Creates a new BindUploader.
 *
 * @param {Object} options
 * @param {Object} services
 * @param {Object} connectionConfig
 * @param {*} requestId 
 *
 * @constructor
 */
 
function BindUploader(options, services, connectionConfig, requestId)
{
	const MAX_BUFFER_SIZE = 1024 * 1024 * 100;
	
	Logger.getInstance().debug('BindUploaders');
	this.options = options;
	this.services = services;
	this.connectionConfig = connectionConfig;
	this.requestId = requestId;
	this.stagePath = '@' + STAGE_NAME + '/' + requestId;
	Logger.getInstance().debug('token = %s', connectionConfig.getToken());

	this.tempStageCreated = false;
	this.bindData = null;
	this.files = [];
	this.datas = [];
	this.puts = [];

	this.Upload = function(bindings)
	{
		Logger.getInstance().debug('BindUploaders::Upload');
	
		if(bindings == null)
			return null;
	
		var dataRows = new Array();
		var startIndex = 0;
		var rowNum = 0;
		var curBytes = 0;
		var fileCount = 0;
		var strbuffer = "";

		for(var i=0; i<bindings.length; i++)
		{
			for(var j=0; j< bindings[i].length; j++)
			{
				if (j>0)
					strbuffer += ',';
				var value = this.cvsData(bindings[i][j]);
				strbuffer += value;
			}
			strbuffer += '\n';

			if(curBytes < MAX_BUFFER_SIZE)
			{
				var size = Buffer.byteLength(strbuffer, 'utf8');
				curBytes += size;
			}
			else
			{
				var fileName = (++fileCount).toString();
				Logger.getInstance().debug('fileName='+fileName);
				this.UploadStream(strbuffer, fileName);
				strbuffer = "";
				curBytes = 0;
			}
		}
		if(curBytes > 0)
		{
			var fileName = (++fileCount).toString();
			Logger.getInstance().debug('fileName='+fileName);
			this.UploadStream(strbuffer, fileName);
		}
				
		this.bindData = {files: this.files, datas: this.datas, puts:this.puts};
		return this.bindData;
	};
	
	this.UploadStream = function(data, fileName)
	{
		Logger.getInstance().debug('BindUploaders::UploadStream');
		var stageName = this.stagePath;
		if(stageName == null)
		{
			throw new Error("Stage name is null.");
		}
		if(fileName == null)
		{
			throw new Error("File name is null.");
		}
	
		var putStmt = "PUT file://" + fileName + "'" + stageName + "' overwrite=true auto_compress=false source_compression=gzip";
		fs.writeFileSync(fileName, data);
		this.files.push(fileName);
		this.datas.push(data);
		this.puts.push(putStmt);
	};

	this.cvsData = function(data)
	{
		if(data == null)
			return "";
		if(data.toString() == "")
			return "\"\"";
		if(data.toString().indexOf('"') >= 0
			|| data.toString().indexOf(',') >= 0	
			|| data.toString().indexOf('\\') >= 0
			|| data.toString().indexOf('\n') >= 0
			|| data.toString().indexOf('\t') >= 0)
				return '"' + data.toString().replace("\"", "\"\"") + '"';
		else 
			return data;
	}
}

function GetCreateStageStmt()
{
	return CREATE_STAGE_STMT;
}

function GetStageName(requestId)
{
	return '@' + STAGE_NAME + '/' + requestId;
}

function CleanFile(fileName)
{
	try
	{
		if(fs.existsSync(fileName))
		{
			fs.unlinkSync(fileName);
		}
	}
	catch(err)
	{
		Logger.getInstance().debug('Delete file failed: %s', fileName);
	}
}

module.exports = {BindUploader, GetCreateStageStmt, GetStageName, CleanFile};