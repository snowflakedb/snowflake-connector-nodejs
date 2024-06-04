#include <node.h>
#include <stdio.h>
#include <stdlib.h>
#include <map>
#include "snowflake/version.h"
#include "snowflake/client.h"

namespace demo {

using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::String;
using v8::Value;
using v8::Number;

std::map<std::string, SF_CONNECT*> connections;

void GetVersion(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, SF_API_VERSION).ToLocalChecked());
}

void GetApiName(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, SF_API_NAME).ToLocalChecked());
}

void Connect(const FunctionCallbackInfo<Value>& args) {
  SF_CONNECT *sf = NULL;
  SF_STATUS status = snowflake_connect(sf);
  args.GetReturnValue().Set(status);
}

std::string localStringToStdString(Isolate* isolate, Local<String> s) {
      String::Utf8Value str(isolate, s);
      std::string cppStr(*str);
      return cppStr;
}

std::string readStringArg(const FunctionCallbackInfo<Value>& args, int i) {
    Isolate* isolate = args.GetIsolate();
      String::Utf8Value str(isolate, args[i]);
      std::string cppStr(*str);
      const char* value = cppStr.c_str();
//      printf("In function: %d %s\n", i, value);
      return cppStr;
}

void ConnectUserPassword(const FunctionCallbackInfo<Value>& args) {
//  printf("Args length: %d\n", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  // TODO refactor parameter reading
//  printf("Object keys number: %d\n", (*(args[0].As<Object>()->GetPropertyNames(context).ToLocalChecked()))->Length());
  Local<String> userPropertyName = String::NewFromUtf8Literal(isolate, "user");
//  printf("User name: %s\n", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, userPropertyName).ToLocalChecked().As<String>())).c_str());
  Local<String> passwordPropertyName = String::NewFromUtf8Literal(isolate, "password");
//  printf("Password: %s\n", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, passwordPropertyName).ToLocalChecked().As<String>())).c_str());
  Local<String> accountPropertyName = String::NewFromUtf8Literal(isolate, "account");
  Local<String> databasePropertyName = String::NewFromUtf8Literal(isolate, "database");
//  printf("Account: %s\n", localStringToStdString(isolate, (args[0].As<Object>()->Get(context, accountPropertyName).ToLocalChecked().As<String>())).c_str());
  SF_CONNECT *sf = snowflake_init();
  snowflake_set_attribute(sf, SF_CON_ACCOUNT, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, accountPropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_USER, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, userPropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_PASSWORD, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, passwordPropertyName).ToLocalChecked().As<String>())).c_str());
  snowflake_set_attribute(sf, SF_CON_DATABASE, localStringToStdString(isolate, (args[0].As<Object>()->Get(context, databasePropertyName).ToLocalChecked().As<String>())).c_str());
//  printf("%s %s\n", *(args[0].As<String>()), *(args[1].As<String>()));
  SF_STATUS status = snowflake_connect(sf);
  printf("Connect status is %d\n", status);
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
//  printf("Args length: %d\n", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
  std::string cacheKey = readStringArg(args, 0);
  std::string query = readStringArg(args, 1);

  SF_CONNECT* sf = connections[cacheKey];
  SF_STMT* statement = snowflake_stmt(sf);
  SF_STATUS status;
  // TODO arrow format should be optional
  status = snowflake_query(statement, "alter session set C_API_QUERY_RESULT_FORMAT=ARROW_FORCE", 0);
  printf("Change to arrow status is %d\n", status);
  printf("Query to run: %s\n", query.c_str());
  status = snowflake_query(statement, query.c_str(), 0);
  printf("Query status is %d\n", status);
//  printf("Statement metadata - first column type: %d, c_type: %d and expected type is %d\n", statement->desc[0].type, statement->desc[0].c_type, SF_C_TYPE_INT64);
//  printf("Statement metadata - first column type: %d, c_type: %d and expected type is %d\n", statement->desc[1].type, statement->desc[1].c_type, SF_C_TYPE_STRING);
//  printf("Statement metadata - first column type: %d, c_type: %d and expected type is %d\n", statement->desc[3].type, statement->desc[3].c_type, SF_C_TYPE_STRING);
//  printf("Fetched rows %d\n", statement->total_rowcount);
//  printf("Fetched columns per row %d\n", statement->total_fieldcount);
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
                printf("Unknown column type: %d\n", statement->desc[result_set_column_idx].c_type);
                break;
        }
    }
    result->Set(context, row_idx++, array);
  }
  snowflake_stmt_term(statement);
  status = snowflake_term(sf);
  printf("Connect term status is %d\n", status);
  args.GetReturnValue().Set(result);
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "getVersion", GetVersion);
  NODE_SET_METHOD(exports, "getApiName", GetApiName);
  NODE_SET_METHOD(exports, "connect", Connect);
  NODE_SET_METHOD(exports, "connectUserPassword", ConnectUserPassword);
  NODE_SET_METHOD(exports, "executeQuery", ExecuteQuery);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo