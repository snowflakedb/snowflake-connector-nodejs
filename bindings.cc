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

std::string readArg(const FunctionCallbackInfo<Value>& args, int i) {
    Isolate* isolate = args.GetIsolate();
      String::Utf8Value str(isolate, args[i]);
      std::string cppStr(*str);
      const char* value = cppStr.c_str();
      printf("In function: %d %s\n", i, value);
      return cppStr;
}

void ConnectUserPassword(const FunctionCallbackInfo<Value>& args) {
  printf("Args length: %d\n", args.Length());
  Isolate* isolate = args.GetIsolate();
  String::Utf8Value str(isolate, args[0]);
  std::string cppStr(*str);
  printf("Param 0: %s\n", cppStr.c_str());
  printf("Param 0: %s\n", readArg(args, 0).c_str());
  printf("Param 1: %s\n", readArg(args, 1).c_str());
//  printf("Param 0: %s %s\n", args[0].As<String>(), *(args[0].As<String>()));
//  printf("Param 1: %s %s\n", args[1].As<String>(), *(args[1].As<String>()));
//  printf("Param 2: %s %s\n", args[2].As<String>(), *(args[2].As<String>()));
  SF_CONNECT *sf = snowflake_init();
//  snowflake_set_attribute(sf, SF_CON_USER, *(args[0].As<String>()));
//  snowflake_set_attribute(sf, SF_CON_PASSWORD, *(args[1].As<String>()));
//  printf("%s %s\n", *(args[0].As<String>()), *(args[1].As<String>()));
  SF_STATUS status = snowflake_connect(sf);
  args.GetReturnValue().Set(status);
}


void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "getVersion", GetVersion);
  NODE_SET_METHOD(exports, "getApiName", GetApiName);
  NODE_SET_METHOD(exports, "connect", Connect);
  NODE_SET_METHOD(exports, "connectUserPassword", ConnectUserPassword);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)

}  // namespace demo