/**
 * Copyright (c) 2017 rxi
 *
 * This library is free software; you can redistribute it and/or modify it
 * under the terms of the MIT license. See `log.c` for details.
 */
/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKE_LOGGER_H
#define SNOWFLAKE_LOGGER_H

#include <stdio.h>
#include <stdarg.h>

/**
 * Log timestamp format.
 *
 * The parameters are:
 * - Timestamp
 * - Log Level
 * - Namespace
 * - Filename (excluding the directory)
 * - Line number
 */
#define SF_LOG_TIMESTAMP_FORMAT "%s %-5s %-5s %-16s %4d: "

/**
 * Log timestamp format in Color
 *
 * The parameters are:
 * - Timestamp
 * - Log Level Color
 * - Log Level
 * - Namespace
 * - Filename (excluding the directory)
 * - Line number
 */
#define SF_LOG_TIMESTAMP_FORMAT_COLOR "%s %s%-5s\x1b[0m \x1b[90m%-5s %-16s %4d:\x1b[0m "

typedef void (*log_LockFn)(void *udata, int lock);

typedef enum SF_LOG_LEVEL {
    SF_LOG_TRACE,
    SF_LOG_DEBUG,
    SF_LOG_INFO,
    SF_LOG_WARN,
    SF_LOG_ERROR,
    SF_LOG_FATAL
} SF_LOG_LEVEL;

#define CXX_LOG_NS "C++"

#define log_trace(...) log_log(SF_LOG_TRACE, __FILE__, __LINE__, "C", __VA_ARGS__)
#define log_debug(...) log_log(SF_LOG_DEBUG, __FILE__, __LINE__, "C", __VA_ARGS__)
#define log_info(...)  log_log(SF_LOG_INFO,  __FILE__, __LINE__, "C", __VA_ARGS__)
#define log_warn(...)  log_log(SF_LOG_WARN,  __FILE__, __LINE__, "C", __VA_ARGS__)
#define log_error(...) log_log(SF_LOG_ERROR, __FILE__, __LINE__, "C", __VA_ARGS__)
#define log_fatal(...) log_log(SF_LOG_FATAL, __FILE__, __LINE__, "C", __VA_ARGS__)

#define sf_log_trace(ns, ...) log_log(SF_LOG_TRACE, __FILE__, __LINE__, ns, __VA_ARGS__)
#define sf_log_debug(ns, ...) log_log(SF_LOG_DEBUG, __FILE__, __LINE__, ns, __VA_ARGS__)
#define sf_log_info(ns, ...)  log_log(SF_LOG_INFO, __FILE__, __LINE__, ns, __VA_ARGS__)
#define sf_log_warn(ns, ...)  log_log(SF_LOG_WARN,  __FILE__, __LINE__, ns, __VA_ARGS__)
#define sf_log_error(ns, ...) log_log(SF_LOG_ERROR, __FILE__, __LINE__, ns, __VA_ARGS__)
#define sf_log_fatal(ns, ...) log_log(SF_LOG_FATAL, __FILE__, __LINE__, ns, __VA_ARGS__)

#if defined(__cplusplus)
extern "C" {
#endif

void log_set_udata(void *udata);

void log_set_lock(log_LockFn fn);

void log_set_fp(FILE *fp);

int log_get_level();

void log_set_level(int level);

void log_set_quiet(int enable);

void
log_log(int level, const char *file, int line, const char *ns, const char *fmt,
        ...);

void
log_log_va_list(int level, const char *file, int line, const char *ns, 
                const char *fmt, va_list args);

void log_masked_va_list(FILE* fp, const char *fmt, va_list args);

SF_LOG_LEVEL log_from_str_to_level(const char *level_in_str);

void log_set_path(const char* path);

void log_close();

#if defined(__cplusplus)
}
#endif

#endif /* SNOWFLAKE_LOGGER_H */
