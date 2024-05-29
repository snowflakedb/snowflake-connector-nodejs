#ifndef __OOBTELEMETRY_H__
#define __OOBTELEMETRY_H__

#include <stdio.h>
#include <string.h>
#include <curl/curl.h>
#include "jsonutil.h"

#ifdef __cplusplus
extern "C" {
#endif

//event will be Freed by the callee
//We will modify event to mask passwords/secrets
extern int sendOOBevent(char* event);

//connStr will be copied into another string
extern void setConnectionString(char const* connStr);

extern char* prepareOOBevent(oobOcspData* ocspevent);

extern void setOOBeventdata(enum OOBINFO id, const char *data, long num);

extern void setoobConnectioninfo(const char* host,
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

extern void setOOBDsnInfo(KeyValuePair kvPair[], int num);

// setOOBSimbaInfo takes in an array of key value pairs containing the simba.snowflake.ini and adds it to OOB telemetry
extern void setOOBSimbaInfo(KeyValuePair kvPair[], int num);

#ifdef __cplusplus
}
#endif

#endif
