/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_PARAM_HPP
#define SNOWFLAKECLIENT_PARAM_HPP

#include "client.h"

namespace Snowflake {
    namespace Client {
        class Param {
        public:
            Param();

            ~Param();

            size_t length();

            void setLength(size_t len_);

            SF_DB_TYPE dbDataType();

            void setDbDataType(SF_DB_TYPE type_);

            SF_C_TYPE cDataType();

            void setCDataType(SF_C_TYPE type_);

            void* value();
            
            void setValue(void *value_, SF_C_TYPE type_);

        private:
            SF_BIND_INPUT m_param;
        };
    }
}

#endif //SNOWFLAKECLIENT_PARAM_HPP
