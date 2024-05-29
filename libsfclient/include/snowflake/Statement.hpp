/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_SNOWFLAKESTATEMENT_HPP
#define SNOWFLAKECLIENT_SNOWFLAKESTATEMENT_HPP

#include <string>
#include "client.h"
#include "Connection.hpp"
#include "Column.hpp"
#include "Param.hpp"

namespace Snowflake {
    namespace Client {
        class Statement {
        public:

            Statement(Connection &connection_);

            ~Statement(void);

        private:
            // Pointer to the connection object that the statement struct will to
            // connect to Snowflake.
            Connection *m_connection;
        };
    }
}


#endif //SNOWFLAKECLIENT_SNOWFLAKESTATEMENT_HPP
