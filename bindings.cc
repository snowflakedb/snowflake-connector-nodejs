#include <node.h>
#include <stdio.h>
#include <stdlib.h>
#include <map>
#include <ctime>
#include <unistd.h>
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

struct RunningStatement {
    std::string connectionId;
    std::string statementId;
};

bool operator< ( RunningStatement a, RunningStatement b ) { return std::make_pair(a.connectionId,a.statementId) < std::make_pair(b.connectionId,b.statementId) ; }

//auto runningStatementComparator = [](const RunningStatement& rs1, const RunningStatement& rs2){
//    return rs1.connectionId < rs2.connectionId || (rs1.connectionId == rs2.connectionId && rs1.statementId < rs2.statementId);
//};

std::map<std::string, SF_CONNECT*> connections;
//std::map<RunningStatement, SF_STMT*, decltype(runningStatementComparator)> streamingStatements(runningStatementComparator);
std::map<RunningStatement, SF_STMT*> runningStatements;

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

int64_t readLongArg(const FunctionCallbackInfo<Value>& args, int i) {
    Isolate* isolate = args.GetIsolate();
    return args[i].As<v8::Integer>()->Value();
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

std::string readStringObjectProperty(Isolate* isolate, Local<v8::Context> context, Local<Object> connectionParameters, char* name) {
    Local<String> propertyName = String::NewFromUtf8(isolate, name).ToLocalChecked();
    return localStringToStdString(isolate, connectionParameters->Get(context, propertyName).ToLocalChecked().As<String>());
}

std::string gen_random_string(const int len) {
    // https://stackoverflow.com/questions/440133/how-do-i-create-a-random-alpha-numeric-string-in-c
    srand((unsigned)time(NULL) * getpid());
    static const char alphanum[] =
        "0123456789"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz";
    std::string tmp_s;
    tmp_s.reserve(len);

    for (int i = 0; i < len; ++i) {
        tmp_s += alphanum[rand() % (sizeof(alphanum) - 1)];
    }

    return tmp_s;
}

void ConnectUserPassword(const FunctionCallbackInfo<Value>& args) {
//  GENERIC_LOG_TRACE("Args length: %d", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  Local<Object> connectionParameters = args[0].As<Object>();
  std::string username = readStringObjectProperty(isolate, context, connectionParameters, "username");
  std::string password = readStringObjectProperty(isolate, context, connectionParameters, "password");
  std::string account = readStringObjectProperty(isolate, context, connectionParameters, "account");
  std::string database = readStringObjectProperty(isolate, context, connectionParameters, "database");
  std::string schema = readStringObjectProperty(isolate, context, connectionParameters, "schema");
  std::string warehouse = readStringObjectProperty(isolate, context, connectionParameters, "warehouse");
  GENERIC_LOG_TRACE("Account: %s", account.c_str());
  GENERIC_LOG_TRACE("Username: %s", username.c_str());
  GENERIC_LOG_TRACE("Database: %s", database.c_str());
  GENERIC_LOG_TRACE("Schema: %s", schema.c_str());
  GENERIC_LOG_TRACE("Warehouse: %s", warehouse.c_str());
  SF_CONNECT *sf = snowflake_init();
  snowflake_set_attribute(sf, SF_CON_ACCOUNT, account.c_str());
  snowflake_set_attribute(sf, SF_CON_USER, username.c_str());
  snowflake_set_attribute(sf, SF_CON_PASSWORD, password.c_str());
  snowflake_set_attribute(sf, SF_CON_DATABASE, database.c_str());
  snowflake_set_attribute(sf, SF_CON_SCHEMA, schema.c_str());
  snowflake_set_attribute(sf, SF_CON_WAREHOUSE, warehouse.c_str());
  SF_STATUS status = snowflake_connect(sf);
  GENERIC_LOG_TRACE("Connect status is %d", status);
  if (status == SF_STATUS_SUCCESS) {
    std::string cacheKey = gen_random_string(20); // TODO use uuid or session id
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
  std::string connectionId = readStringArg(args, 0);
  std::string query = readStringArg(args, 1);
  std::string resultFormat = "JSON";
  if (args.Length() > 2) {
    // third parameter is option object
    Local<Object> options = args[2].As<Object>();
    resultFormat = readStringObjectProperty(isolate, context, options, "resultFormat");
  }

  SF_CONNECT* sf = connections[connectionId];
  SF_STMT* statement = snowflake_stmt(sf);
  SF_STATUS status;
  if (resultFormat == "ARROW") {
    status = snowflake_query(statement, "alter session set C_API_QUERY_RESULT_FORMAT=ARROW_FORCE", 0);
    GENERIC_LOG_TRACE("Change to arrow status is %d", status);
  } else {
    status = snowflake_query(statement, "alter session set C_API_QUERY_RESULT_FORMAT=JSON", 0);
    GENERIC_LOG_TRACE("Change to json status is %d", status);
  }
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
                const char* buffer = NULL;
                snowflake_column_as_const_str(statement, result_set_column_idx, &buffer);
                array->Set(context, column_idx, String::NewFromUtf8(isolate, buffer).ToLocalChecked());
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

void ExecuteQueryWithoutFetchingRows(const FunctionCallbackInfo<Value>& args) {
//  GENERIC_LOG_TRACE("Args length: %d", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  std::string connectionId = readStringArg(args, 0);
  std::string query = readStringArg(args, 1);
  std::string resultFormat = "JSON";
  if (args.Length() > 2) {
    // third parameter is option object
    Local<Object> options = args[2].As<Object>();
    resultFormat = readStringObjectProperty(isolate, context, options, "resultFormat");
  }

  SF_CONNECT* sf = connections[connectionId];
  SF_STMT* statement = snowflake_stmt(sf);
  SF_STATUS status;
  if (resultFormat == "ARROW") {
    status = snowflake_query(statement, "alter session set C_API_QUERY_RESULT_FORMAT=ARROW_FORCE", 0);
    GENERIC_LOG_TRACE("Change to arrow status is %d", status);
  } else {
    status = snowflake_query(statement, "alter session set C_API_QUERY_RESULT_FORMAT=JSON", 0);
    GENERIC_LOG_TRACE("Change to json status is %d", status);
  }
  GENERIC_LOG_TRACE("Query to run: %s", query.c_str());
  status = snowflake_query(statement, query.c_str(), 0);
  GENERIC_LOG_TRACE("Query status is %d", status);
//  GENERIC_LOG_TRACE("Statement metadata - first column type: %d, c_type: %d and expected type is %d", statement->desc[0].type, statement->desc[0].c_type, SF_C_TYPE_INT64);
//  GENERIC_LOG_TRACE("Statement metadata - first column type: %d, c_type: %d and expected type is %d", statement->desc[1].type, statement->desc[1].c_type, SF_C_TYPE_STRING);
//  GENERIC_LOG_TRACE("Statement metadata - first column type: %d, c_type: %d and expected type is %d", statement->desc[3].type, statement->desc[3].c_type, SF_C_TYPE_STRING);
//  GENERIC_LOG_TRACE("Fetched rows %d", statement->total_rowcount);
//  GENERIC_LOG_TRACE("Fetched columns per row %d", statement->total_fieldcount);
  if (status == SF_STATUS_SUCCESS) {
      std::string statementId = gen_random_string(20); // TODO use uuid or session id
      RunningStatement cacheKey = { .connectionId = connectionId, .statementId = statementId };
      runningStatements[cacheKey] = statement;
      args.GetReturnValue().Set(String::NewFromUtf8(isolate, statementId.c_str()).ToLocalChecked());
      // TODO return object
    } else {
      args.GetReturnValue().SetNull();
      // TODO return error
    }
}

void FetchNextRows(const FunctionCallbackInfo<Value>& args) {
//  GENERIC_LOG_TRACE("Args length: %d", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  std::string connectionId = readStringArg(args, 0);
  std::string statementId = readStringArg(args, 1);
  int64_t rowsToFetch = readLongArg(args, 2);

  GENERIC_LOG_TRACE("Reading from statement %s/%s: %d rows", connectionId.c_str(), statementId.c_str(), rowsToFetch);

  RunningStatement cacheKey = { .connectionId = connectionId, .statementId = statementId };

  SF_STMT* statement = runningStatements[cacheKey];
  Local<v8::Array> result = v8::Array::New(isolate, rowsToFetch); // TODO check how many rows should there be
  SF_STATUS status;
  long row_idx = 0;
  while (row_idx < rowsToFetch && (status = snowflake_fetch(statement)) == SF_STATUS_SUCCESS) {
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
                const char* buffer = NULL;
                snowflake_column_as_const_str(statement, result_set_column_idx, &buffer);
                array->Set(context, column_idx, String::NewFromUtf8(isolate, buffer).ToLocalChecked());
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
  if (status != SF_STATUS_SUCCESS) {
    snowflake_stmt_term(statement);
    runningStatements.erase(cacheKey);
  }
  if(result->Length() > row_idx) {
    // shrinking result array
    // TODO may be optimize on upper level
    Local<v8::Array> result2 = v8::Array::New(isolate, row_idx);
    long idx;
    for(idx = 0; idx < row_idx; ++idx) {
        result2->Set(context, idx, result->Get(context, idx).ToLocalChecked());
    }
    result = result2;
  }

  Local<Object> returnObject = Object::New(isolate);
  returnObject->Set(context, String::NewFromUtf8Literal(isolate, "rows"), result);
  returnObject->Set(context, String::NewFromUtf8Literal(isolate, "end"), v8::Boolean::New(isolate, status != SF_STATUS_SUCCESS));
  // TODO optimize when number of rows % fetch size == 0 to not return empty array at the end
  args.GetReturnValue().Set(returnObject);
}

void CloseConnection(const FunctionCallbackInfo<Value>& args) {
//  GENERIC_LOG_TRACE("Args length: %d", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  std::string cacheKey = readStringArg(args, 0);

  SF_CONNECT* sf = connections[cacheKey];
  SF_STATUS status = snowflake_term(sf);
  GENERIC_LOG_TRACE("Connect term status is %d", status);
  connections.erase(cacheKey);
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "getVersion", GetVersion);
  NODE_SET_METHOD(exports, "getApiName", GetApiName);
  NODE_SET_METHOD(exports, "connectUserPassword", ConnectUserPassword);
  NODE_SET_METHOD(exports, "executeQuery", ExecuteQuery);
  NODE_SET_METHOD(exports, "init", Init);
  NODE_SET_METHOD(exports, "closeConnection", CloseConnection);
  NODE_SET_METHOD(exports, "executeQueryWithoutFetchingRows", ExecuteQueryWithoutFetchingRows);
  NODE_SET_METHOD(exports, "fetchNextRows", FetchNextRows);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo