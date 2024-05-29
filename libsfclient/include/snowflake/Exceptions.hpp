/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_EXCEPTIONS_HPP
#define SNOWFLAKECLIENT_EXCEPTIONS_HPP

#include <exception>
#include "client.h"

class SnowflakeException: public std::exception {
public:
    SnowflakeException(SF_ERROR_STRUCT *error);

    const char * what() const throw();

    SF_STATUS code();

    const char *sqlstate();

    const char *msg();

    const char *sfqid();

    const char *file();

    int line();

protected:
    SF_ERROR_STRUCT *error;
};

class GeneralException: public SnowflakeException {
public:
    GeneralException(SF_ERROR_STRUCT *error) : SnowflakeException(error) {};
};

#endif //SNOWFLAKECLIENT_EXCEPTIONS_HPP
