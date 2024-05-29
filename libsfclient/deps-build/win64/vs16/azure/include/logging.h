#pragma once

#include <string>
#include <functional>
#include <memory>

#ifdef _WIN32
#include <Rpc.h>
#pragma warning(disable : 4996)
#define _SNPRINTF _snprintf
#else
#include <unistd.h>
#define _SNPRINTF snprintf
#endif

#include "storage_EXPORTS.h"

constexpr auto MAX_LOG_LENGTH = 8192u;

namespace azure { namespace storage_lite {

    enum log_level {
        trace = 0x0,
        debug,
        info,
        warn,
        error,
        critical,
        none
    };

    class logger
    {
    public:
        static void log(log_level level, const std::string& msg)
        {
            s_logger(level, msg);
        }

        template<typename ... Args>
        static void log(log_level level, const char* format, Args ... args)
        {
            if (level > log_level::critical)
            {
                return; // does not support higher level logging.
            }
            size_t size = _SNPRINTF(nullptr, 0, format, args ...) + 1;
            // limit the maximum size of this log string to 8kb, as the buffer needs
            // to be allocated to a continuous memory and is likely to fail
            // when the size is relatively big.
            size = size > MAX_LOG_LENGTH ? MAX_LOG_LENGTH : size;
            std::unique_ptr<char[]> buf(new char[size]);
            _SNPRINTF(buf.get(), size, format, args ...);
            auto msg = std::string(buf.get(), buf.get() + size - 1);
            log(level, msg);
        }

        static void debug(const std::string& msg)
        {
            log(log_level::debug, msg);
        }

        static void info(const std::string& msg)
        {
            log(log_level::info, msg);
        }

        static void warn(const std::string& msg)
        {
            log(log_level::warn, msg);
        }

        static void error(const std::string& msg)
        {
            log(log_level::error, msg);
        }

        static void critical(const std::string& msg)
        {
            log(log_level::critical, msg);
        }

        static void trace(const std::string& msg)
        {
            log(log_level::trace, msg);
        }

        static void set_logger(const std::function<void(log_level, const std::string&)>& new_logger)
        {
            s_logger = new_logger;
        }

    protected:
        static std::function<void(log_level, const std::string&)> s_logger;

        static void simple_logger(log_level level, const std::string& msg);
    };
}}