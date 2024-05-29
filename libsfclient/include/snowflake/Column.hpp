/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_COLUMN_HPP
#define SNOWFLAKECLIENT_COLUMN_HPP

#include <string>
#include "client.h"

namespace Snowflake {
    namespace Client {
        class Column {
        public:

            Column(SF_COLUMN_DESC* column_desc_);

            ~Column();

            // Column Output data
            bool isNull();

            size_t idx();

            size_t len();

            // Column Description
            std::string name();

            bool nullOk();

            int64 precision();

            int64 scale();

            SF_DB_TYPE dbDataType();

            SF_C_TYPE cDataType();

            // Data Conversions (as needed)
            bool asBool();

            int8 asInt8();

            int32 asInt32();

            int64 asInt64();

            uint8 asUInt8();

            uint32 asUInt32();

            uint64 asUInt64();

            float32 asFloat32();

            float64 asFloat64();

            std::string asString();

            const char *asCString();

        private:
            SF_COLUMN_DESC *m_desc;
        };
    }
}

#endif //SNOWFLAKECLIENT_COLUMN_HPP
