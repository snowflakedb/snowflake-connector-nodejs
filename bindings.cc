#include <node.h>
#include <stdio.h>
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
      const char* value = cppStr.c_str();
      return cppStr;
}

std::string readStringArg(const FunctionCallbackInfo<Value>& args, int i) {
    Isolate* isolate = args.GetIsolate();
      String::Utf8Value str(isolate, args[i]);
      std::string cppStr(*str);
      const char* value = cppStr.c_str();
      printf("In function: %d %s\n", i, value);
      return cppStr;
}

void ConnectUserPassword(const FunctionCallbackInfo<Value>& args) {
//  printf("Args length: %d\n", args.Length());
  Isolate* isolate = args.GetIsolate();
  Local<v8::Context> context = v8::Context::New(isolate);
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
  SF_STMT* statement = snowflake_stmt(sf);
  status = snowflake_query(statement, "alter session set C_API_QUERY_RESULT_FORMAT=ARROW_FORCE", 0);
  printf("Change to arrow status is %d\n", status);
  status = snowflake_query(statement, "select 78", 0);
  printf("Simple query status is %d\n", status);
  while ((status = snowflake_fetch(statement)) == SF_STATUS_SUCCESS) {
    int32 out;
    snowflake_column_as_int32(statement, 1, &out);
    printf("Selected %d\n", out);
  }
  snowflake_stmt_term(statement);
  status = snowflake_term(sf);
  printf("Connect term status is %d\n", status);
  args.GetReturnValue().Set(0);
}


void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "getVersion", GetVersion);
  NODE_SET_METHOD(exports, "getApiName", GetApiName);
  NODE_SET_METHOD(exports, "connect", Connect);
  NODE_SET_METHOD(exports, "connectUserPassword", ConnectUserPassword);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo