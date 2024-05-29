#ifndef __JSONUTIL_H_
#define __JSONUTIL_H_
#include "sf_ocsp_telemetry_data.h"

#ifdef __cplusplus
extern "C" {
#endif

enum OOBINFO { CTX_ACCOUNT, CTX_HOST, CTX_PORT, CTX_USER, CTX_STR, CTX_PROTOCOL, CTX_DEPLOYMENT, OOBEVENTNAME,  EXCPMSG, EXCPMSGTRC, REQUESTURL, RESPSTATUSCODE, ERRORCODE, OOBSQLSTATE, URGENCY, OOBCABUNDLE };

struct conStr{
  char ctxStr[4096];
  char dep[256];
  char host[512];
  char port[10];
  char account[256];
  char user[256];
  char token[1024];
  char authenticator[1024];
  char dbName[256];
  char schema[256];
  char warehouse[256];
  char role[256];
  char protocol[8];
  char sqlstate[64];
  char cabundle[512];
};

struct logDetails{
  char name[256];
  char exceptionMessage[4096];
  char exceptionStackTrace[4096];
  char request[1024];
  char responsestatuscode[64];
  long errorCode;
  int urgent;
};

typedef struct KeyValuePair{
  const char* key;
  const char* val;
} KeyValuePair;

typedef struct ocsp_telemetry_data oobOcspData;

void setoobConnectioninfo(const char* host,
    const char* port,
    const char* account,
    const char* user,
    const char* token,
    const char* authenticator,
    const char* dbName,
    const char* schema,
    const char* warehouse,
    const char* role,
    short ssl
    );

void setOOBDsnInfo(KeyValuePair kvPair[], int num);

void setOOBSimbaInfo(KeyValuePair kvPair[], int num);

extern char* getOOBDeployment();

extern void getCabundle(char* cabundle, int maxlen);

#ifdef __cplusplus
}
#endif
#endif
