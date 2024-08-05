/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKE_BASIC_TYPES_H
#define SNOWFLAKE_BASIC_TYPES_H

#ifdef __cplusplus
extern "C" {
#endif

#include <limits.h>
#include <float.h>
#include <math.h>
#include "platform.h"

/**
 * Supported data types
 */
typedef char int8;
typedef unsigned char uint8;
typedef unsigned int uint32;
typedef int int32;
typedef unsigned long long int uint64;
typedef long long int int64;
typedef double float64;
typedef float float32;
typedef int8 sf_bool;

extern const int8 SF_BOOLEAN_TRUE;
extern const int8 SF_BOOLEAN_FALSE;

#define SF_UINT32_MAX UINT_MAX
#define SF_UINT64_MAX ULLONG_MAX
#define SF_INT32_MIN INT_MIN
#define SF_INT32_MAX INT_MAX
#define SF_INT64_MIN LLONG_MIN
#define SF_INT64_MAX LLONG_MAX
#define SF_HUGE_VAL HUGE_VAL
#define SF_HUGE_VALF HUGE_VALF
/**
 * Boolean data type string representation for Snowflake
 */
#define SF_BOOLEAN_INTERNAL_TRUE_STR "TRUE"
#define SF_BOOLEAN_INTERNAL_FALSE_STR "FALSE"

/**
 * Boolean data type string representation for results.
 *
 * This is mainly used by PHP PDO Snowflake but should work fine
 * for other cases.
 */
#define SF_BOOLEAN_TRUE_STR "1"
#define SF_BOOLEAN_FALSE_STR ""

#ifdef __cplusplus
}
#endif

#endif /* SNOWFLAKE_BASIC_TYPES_H */
