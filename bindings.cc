#include <node.h>
#include <stdio.h>
#include <stdlib.h>
#include <map>
#include "snowflake/version.h"
#include "snowflake/client.h"
#include "snowflake/logger.h"

#define GENERIC_NAME "GENERIC"
#define GENERIC_LOG_TRACE(...) sf_log_trace(GENERIC_NAME, __VA_ARGS__)
#define GENERIC_LOG_ERROR(...) sf_log_error(GENERIC_NAME, __VA_ARGS__)

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;
using v8::Number;

std::map<std::string, SF_CONNECT*> connections;

std::string localStringToStdString(Isolate* isolate, Local<String> s) {
      String::Utf8Value str(isolate, s);
      std::string cppStr(*str);
      return cppStr;
}

std::string readStringArg(const FunctionCallbackInfo<Value>& args, int i) {
    Isolate* isolate = args.GetIsolate();
      String::Utf8Value str(isolate, args[i]);
      std::string cppStr(*str);
      return cppStr;
}

void Init(const FunctionCallbackInfo<Value>& args) {
    std::string string_log_level = readStringArg(args, 0);
    SF_LOG_LEVEL log_level;
    if (string_log_level == "TRACE") {
      log_level = SF_LOG_TRACE;
    } else if (string_log_level == "DEBUG") {
      log_level = SF_LOG_DEBUG;
    } else if (string_log_level == "INFO") {
      log_level = SF_LOG_INFO;
    } else if (string_log_level == "WARN") {
      log_level = SF_LOG_WARN;
    } else if (string_log_level == "ERROR") {
      log_level = SF_LOG_ERROR;
    } else {
      log_level = SF_LOG_FATAL;
    }
    log_set_level(log_level);
//    GENERIC_LOG_TRACE("Setting log level to %s (%d)", string_log_level.c_str(), log_level);
//    snowflake_global_set_attribute(SF_GLOBAL_DEBUG, "TRUE");
//    snowflake_global_init(NULL, log_level, NULL); // TODO setting log level here force logging to file in ./logs/*
//    snowflake_global_init("/tmp", log_level, NULL);
}

void GetVersion(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, SF_API_VERSION).ToLocalChecked());
}

void GetApiName(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, SF_API_NAME).ToLocalChecked());
}

void ConnectUserPassword(const FunctionCallbackInfo<Value>& args) {
//  GENERIC_LOG_TRACE("Args length: %d", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  // TODO refactor parameter reading
//  GENERIC_LOG_TRACE("Object keys number: %d", (*(args[0].As<Object>()->GetPropertyNames(context).ToLocalChecked()))->Length());
  Local<String> usernamePropertyName = String::NewFromUtf8Literal(isolate, "username");
  Local<String> passwordPropertyName = String::NewFromUtf8Literal(isolate, "password");
  Local<String> accountPropertyName = String::NewFromUtf8Literal(isolate, "account");
  Local<String> databasePropertyName = String::NewFromUtf8Literal(isolate, "database");
  Local<String> schemaPropertyName = String::NewFromUtf8Literal(isolate, "schema");
  Local<String> warehousePropertyName = String::NewFromUtf8Literal(isolate, "warehouse");
//  GENERIC_LOG_TRACE("Username: %s", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, usernamePropertyName).ToLocalChecked().As<String>())).c_str());
//  GENERIC_LOG_TRACE("Account: %s", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, accountPropertyName).ToLocalChecked().As<String>())).c_str());
//  GENERIC_LOG_TRACE("Database: %s", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, databasePropertyName).ToLocalChecked().As<String>())).c_str());
//  GENERIC_LOG_TRACE("Schema: %s", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, schemaPropertyName).ToLocalChecked().As<String>())).c_str());
//  GENERIC_LOG_TRACE("Warehouse: %s", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, warehousePropertyName).ToLocalChecked().As<String>())).c_str());
  SF_CONNECT *sf = snowflake_init();
  snowflake_set_attribute(sf, SF_CON_ACCOUNT, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, accountPropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_USER, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, usernamePropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_PASSWORD, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, passwordPropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_DATABASE, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, databasePropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_SCHEMA, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, schemaPropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_WAREHOUSE, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, warehousePropertyName).ToLocalChecked().As<String>())).c_str());
//  GENERIC_LOG_TRACE("%s %s", *(args[0].As<String>()), *(args[1].As<String>()));
  SF_STATUS status = snowflake_connect(sf);
  GENERIC_LOG_TRACE("Connect status is %d", status);
  if (status == SF_STATUS_SUCCESS) {
    // TODO key should be uuid
    std::string cacheKey = "bla";
    connections[cacheKey] = sf;
    args.GetReturnValue().Set(String::NewFromUtf8(isolate, cacheKey.c_str()).ToLocalChecked());
    // TODO return object
  } else {
    args.GetReturnValue().SetNull();
    // TODO return error
  }
}

void ExecuteQuery(const FunctionCallbackInfo<Value>& args) {
//  GENERIC_LOG_TRACE("Args length: %d", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  std::string cacheKey = readStringArg(args, 0);
  std::string query = readStringArg(args, 1);

  SF_CONNECT* sf = connections[cacheKey];
  SF_STMT* statement = snowflake_stmt(sf);
  SF_STATUS status;
  // TODO arrow format should be optional
  status = snowflake_query(statement, "alter session set C_API_QUERY_RESULT_FORMAT=ARROW_FORCE", 0);
  GENERIC_LOG_TRACE("Change to arrow status is %d", status);
  GENERIC_LOG_TRACE("Query to run: %s", query.c_str());
  status = snowflake_query(statement, query.c_str(), 0);
  GENERIC_LOG_TRACE("Query status is %d", status);
//  GENERIC_LOG_TRACE("Statement metadata - first column type: %d, c_type: %d and expected type is %d", statement->desc[0].type, statement->desc[0].c_type, SF_C_TYPE_INT64);
//  GENERIC_LOG_TRACE("Statement metadata - first column type: %d, c_type: %d and expected type is %d", statement->desc[1].type, statement->desc[1].c_type, SF_C_TYPE_STRING);
//  GENERIC_LOG_TRACE("Statement metadata - first column type: %d, c_type: %d and expected type is %d", statement->desc[3].type, statement->desc[3].c_type, SF_C_TYPE_STRING);
//  GENERIC_LOG_TRACE("Fetched rows %d", statement->total_rowcount);
//  GENERIC_LOG_TRACE("Fetched columns per row %d", statement->total_fieldcount);
  Local<v8::Array> result = v8::Array::New(isolate, statement->total_rowcount);
  long row_idx = 0;
  while ((status = snowflake_fetch(statement)) == SF_STATUS_SUCCESS) {
    Local<v8::Array> array = v8::Array::New(isolate, statement->total_fieldcount);
    for(int64 column_idx = 0; column_idx < statement->total_fieldcount; ++column_idx) {
        int64 result_set_column_idx = column_idx + 1;
        sf_bool is_null = SF_BOOLEAN_FALSE;
        snowflake_column_is_null(statement, result_set_column_idx, &is_null);
        if (is_null) {
            array->Set(context, column_idx, v8::Null(isolate));
            continue;
        }
        switch (statement->desc[column_idx].c_type) {
            case SF_C_TYPE_INT64:
                int32 out;
                snowflake_column_as_int32(statement, result_set_column_idx, &out);
                array->Set(context, column_idx, v8::Integer::New(isolate, out));
                break;
            case SF_C_TYPE_FLOAT64:
                double outDouble;
                snowflake_column_as_float64(statement, result_set_column_idx, &outDouble);
                array->Set(context, column_idx, Number::New(isolate, outDouble));
                break;
            case SF_C_TYPE_STRING: {
                const char* buffer = (char*) malloc(statement->desc[column_idx].byte_size * sizeof(char));
                snowflake_column_as_const_str(statement, result_set_column_idx, &buffer);
                array->Set(context, column_idx, String::NewFromUtf8(isolate, buffer).ToLocalChecked());
                // TODO should we call free
                break;
                }
            default:
                // TODO handle unknown type
                GENERIC_LOG_ERROR("Unknown column type: %d", statement->desc[result_set_column_idx].c_type);
                break;
        }
    }
    result->Set(context, row_idx++, array);
  }
  snowflake_stmt_term(statement);
  args.GetReturnValue().Set(result);
}

void CloseConnection(const FunctionCallbackInfo<Value>& args) {
//  GENERIC_LOG_TRACE("Args length: %d", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  std::string cacheKey = readStringArg(args, 0);

  SF_CONNECT* sf = connections[cacheKey];
  SF_STATUS status = snowflake_term(sf);
  GENERIC_LOG_TRACE("Connect term status is %d", status);
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "getVersion", GetVersion);
  NODE_SET_METHOD(exports, "getApiName", GetApiName);
  NODE_SET_METHOD(exports, "connectUserPassword", ConnectUserPassword);
  NODE_SET_METHOD(exports, "executeQuery", ExecuteQuery);
  NODE_SET_METHOD(exports, "init", Init);
  NODE_SET_METHOD(exports, "closeConnection", CloseConnection);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo