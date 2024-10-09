/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKE_CLIENT_H
#define SNOWFLAKE_CLIENT_H

#ifdef  __cplusplus
extern "C" {
#endif

#include <time.h>
#include "basic_types.h"
#include "platform.h"
#include "version.h"
#include "logger.h"

/**
 * API Name
 */
#define SF_API_NAME "C API"

/**
 * SQLState code length
 */
#define SF_SQLSTATE_LEN 6

/**
 * Authenticator, Default
 */
#define SF_AUTHENTICATOR_DEFAULT "snowflake"

/**
 * Authenticator, key pair (jwt)
 */
#define SF_AUTHENTICATOR_JWT "snowflake_jwt"

 /**
 * Authenticator, external browser
 * TODO
 */
#define SF_AUTHENTICATOR_EXTERNAL_BROWSER "externalbrowser"

/**
 * UUID4 length
 */
#define SF_UUID4_LEN 37

/**
 * Source compression value length returned by server
 */
#define SF_SOURCE_COMPRESSION_TYPE_LEN 15

/**
 * Download/upload length
 */
#define SF_COMMAND_LEN 10

/**
 * The maximum object size
 */
#define SF_MAX_OBJECT_SIZE 16777216

/**
 * Login timeout in seconds
 */
// make the login timetout defaults to 300 to be inline with retry timeout
// while customer can reduce it as needed
#define SF_LOGIN_TIMEOUT 300

 /**
 * retry timeout in seconds
 */
#define SF_RETRY_TIMEOUT 300

 /**
 * max retry number
 */
#define SF_MAX_RETRY 7

/**
 * Default JWT timeout in seconds
 */
#define SF_JWT_TIMEOUT 60

/**
 * Default JWT renew timeout in seconds
 */
#define SF_JWT_CNXN_WAIT_TIME 10

/**
 * Snowflake Data types
 *
 * Use snowflake_type_to_string to get the string representation.
 */
typedef enum SF_DB_TYPE {
    SF_DB_TYPE_FIXED,
    SF_DB_TYPE_REAL,
    SF_DB_TYPE_TEXT,
    SF_DB_TYPE_DATE,
    SF_DB_TYPE_TIMESTAMP_LTZ,
    SF_DB_TYPE_TIMESTAMP_NTZ,
    SF_DB_TYPE_TIMESTAMP_TZ,
    SF_DB_TYPE_VARIANT,
    SF_DB_TYPE_OBJECT,
    SF_DB_TYPE_ARRAY,
    SF_DB_TYPE_BINARY,
    SF_DB_TYPE_TIME,
    SF_DB_TYPE_BOOLEAN,
    SF_DB_TYPE_ANY
} SF_DB_TYPE;

/**
 * C data types
 *
 * Use snowflake_c_type_to_string to get the string representation.
 */
typedef enum SF_C_TYPE {
    SF_C_TYPE_INT8,
    SF_C_TYPE_UINT8,
    SF_C_TYPE_INT64,
    SF_C_TYPE_UINT64,
    SF_C_TYPE_FLOAT64,
    SF_C_TYPE_STRING,
    SF_C_TYPE_TIMESTAMP,
    SF_C_TYPE_BOOLEAN,
    SF_C_TYPE_BINARY,
    SF_C_TYPE_NULL
} SF_C_TYPE;

/**
 * Snowflake API status
 */
typedef enum SF_STATUS {
    SF_STATUS_EOF = -1,                   // Special status are negative
    SF_STATUS_SUCCESS = 0,                // Success is zero
    SF_STATUS_ERROR_GENERAL = 240000,     // Errors are positive
    SF_STATUS_ERROR_OUT_OF_MEMORY = 240001,
    SF_STATUS_ERROR_REQUEST_TIMEOUT = 240002,
    SF_STATUS_ERROR_DATA_CONVERSION = 240003,
    SF_STATUS_ERROR_BAD_DATA_OUTPUT_TYPE = 240004,
    SF_STATUS_ERROR_BAD_CONNECTION_PARAMS = 240005,
    SF_STATUS_ERROR_STRING_FORMATTING = 240006,
    SF_STATUS_ERROR_STRING_COPY = 240007,
    SF_STATUS_ERROR_BAD_REQUEST = 240008,
    SF_STATUS_ERROR_BAD_RESPONSE = 240009,
    SF_STATUS_ERROR_BAD_JSON = 240010,
    SF_STATUS_ERROR_RETRY = 240011,
    SF_STATUS_ERROR_CURL = 240012,
    SF_STATUS_ERROR_BAD_ATTRIBUTE_TYPE = 240013,
    SF_STATUS_ERROR_APPLICATION_ERROR = 240014,
    SF_STATUS_ERROR_PTHREAD = 240015,
    SF_STATUS_ERROR_CONNECTION_NOT_EXIST = 240016,
    SF_STATUS_ERROR_STATEMENT_NOT_EXIST = 240017,
    SF_STATUS_ERROR_CONVERSION_FAILURE = 240018,
    SF_STATUS_ERROR_OUT_OF_BOUNDS = 240019,
    SF_STATUS_ERROR_MISSING_COLUMN_IN_ROW = 240020,
    SF_STATUS_ERROR_OUT_OF_RANGE = 240021,
    SF_STATUS_ERROR_NULL_POINTER = 240022,
    SF_STATUS_ERROR_BUFFER_TOO_SMALL = 240023,
    SF_STATUS_ERROR_UNSUPPORTED_QUERY_RESULT_FORMAT = 240024,
    SF_STATUS_ERROR_OTHER = 240025
} SF_STATUS;

/**
 * SQLState for client errors
 */
#define SF_SQLSTATE_NO_ERROR "00000"
#define SF_SQLSTATE_UNABLE_TO_CONNECT "08001"
#define SF_SQLSTATE_CONNECTION_ALREADY_EXIST "08002"
#define SF_SQLSTATE_CONNECTION_NOT_EXIST "08003"
#define SF_SQLSTATE_APP_REJECT_CONNECTION "08004"

// For general purpose
#define SF_SQLSTATE_NO_DATA "02000"

// For CLI specific
#define SF_SQLSTATE_GENERAL_ERROR "HY000"
#define SF_SQLSTATE_MEMORY_ALLOCATION_ERROR "HY001"
#define SF_SQLSTATE_INVALID_DATA_TYPE_IN_APPLICATION_DESCRIPTOR "HY003"
#define SF_SQLSTATE_INVALID_DATA_TYPE "HY004"
#define SF_SQLSTATE_ASSOCIATED_STATEMENT_IS_NOT_PREPARED "HY007"
#define SF_SQLSTATE_OPERATION_CANCELED "HY008"
#define SF_SQLSTATE_INVALID_USE_OF_NULL_POINTER "HY009"
#define SF_SQLSTATE_FUNCTION_SEQUENCE_ERROR "HY010"
#define SF_SQLSTATE_ATTRIBUTE_CANNOT_BE_SET_NOW "HY011"
#define SF_SQLSTATE_INVALID_TRANSACTION_OPERATION_CODE "HY012"
#define SF_SQLSTATE_MEMORY_MANAGEMENT_ERROR "HY013"
#define SF_SQLSTATE_LIMIT_ON_THE_NUMBER_OF_HANDLES_EXCEEDED "HY014"
#define SF_SQLSTATE_INVALID_USE_OF_AN_AUTOMATICALLY_ALLOCATED_DESCRIPTOR_HANDLE "HY017"
#define SF_SQLSTATE_SERVER_DECLINED_THE_CANCELLATION_REQUEST "HY018"
#define SF_SQLSTATE_NON_STRING_DATA_CANNOT_BE_SENT_IN_PIECES "HY019"
#define SF_SQLSTATE_ATTEMPT_TO_CONCATENATE_A_NULL_VALUE "HY020"
#define SF_SQLSTATE_INCONSISTENT_DESCRIPTOR_INFORMATION "HY021"
#define SF_SQLSTATE_INVALID_ATTRIBUTE_VALUE "HY024"
#define SF_SQLSTATE_NON_STRING_DATA_CANNOT_BE_USED_WITH_STRING_ROUTINE "HY055"
#define SF_SQLSTATE_INVALID_STRING_LENGTH_OR_BUFFER_LENGTH "HY090"
#define SF_SQLSTATE_INVALID_DESCRIPTOR_FIELD_IDENTIFIER "HY091"
#define SF_SQLSTATE_INVALID_ATTRIBUTE_IDENTIFIER "HY092"
#define SF_SQLSTATE_INVALID_FUNCTIONID_SPECIFIED "HY095"
#define SF_SQLSTATE_INVALID_INFORMATION_TYPE "HY096"
#define SF_SQLSTATE_COLUMN_TYPE_OUT_OF_RANGE "HY097"
#define SF_SQLSTATE_SCOPE_OUT_OF_RANGE "HY098"
#define SF_SQLSTATE_NULLABLE_TYPE_OUT_OF_RANGE "HY099"
#define SF_SQLSTATE_INVALID_RETRIEVAL_CODE "HY103"
#define SF_SQLSTATE_INVALID_LENGTHPRECISION_VALUE "HY104"
#define SF_SQLSTATE_INVALID_PARAMETER_TYPE "HY105"
#define SF_SQLSTATE_INVALID_FETCH_ORIENTATION "HY106"
#define SF_SQLSTATE_ROW_VALUE_OUT_OF_RANGE "HY107"
#define SF_SQLSTATE_INVALID_CURSOR_POSITION "HY108"
#define SF_SQLSTATE_OPTIONAL_FEATURE_NOT_IMPLEMENTED "HYC00"

// For Query Context Cache
#define SF_QCC_CAPACITY_DEF        5
#define SF_QCC_RSP_KEY             "queryContext"
#define SF_QCC_REQ_KEY             "queryContextDTO"
#define SF_QCC_ENTRIES_KEY         "entries"
#define SF_QCC_ID_KEY              "id"
#define SF_QCC_PRIORITY_KEY        "priority"
#define SF_QCC_TIMESTAMP_KEY       "timestamp"
#define SF_QCC_CONTEXT_KEY         "context"
#define SF_QCC_CONTEXT_VALUE_KEY   "base64Data"

/**
 * Attributes for Snowflake database session context.
 */
typedef enum SF_ATTRIBUTE {
    SF_CON_ACCOUNT,
    SF_CON_REGION,
    SF_CON_USER,
    SF_CON_PASSWORD,
    SF_CON_DATABASE,
    SF_CON_SCHEMA,
    SF_CON_WAREHOUSE,
    SF_CON_ROLE,
    SF_CON_HOST,
    SF_CON_PORT,
    SF_CON_PROTOCOL,
    SF_CON_PASSCODE,
    SF_CON_PASSCODE_IN_PASSWORD,
    SF_CON_APPLICATION_NAME,
    SF_CON_APPLICATION_VERSION,
    SF_CON_AUTHENTICATOR,
    SF_CON_INSECURE_MODE,
    SF_CON_LOGIN_TIMEOUT,
    SF_CON_NETWORK_TIMEOUT,
    SF_CON_TIMEZONE,
    SF_CON_SERVICE_NAME,
    SF_CON_AUTOCOMMIT,
    SF_CON_APPLICATION,
    SF_CON_PRIV_KEY_FILE,
    SF_CON_PRIV_KEY_FILE_PWD,
    SF_CON_JWT_TIMEOUT,
    SF_CON_JWT_CNXN_WAIT_TIME,
    SF_CON_MAX_CON_RETRY,
    SF_CON_PROXY,
    SF_CON_NO_PROXY,
    SF_CON_DISABLE_QUERY_CONTEXT_CACHE,
    SF_CON_INCLUDE_RETRY_REASON,
    SF_CON_RETRY_TIMEOUT,
    SF_CON_MAX_RETRY,
    SF_DIR_QUERY_URL,
    SF_DIR_QUERY_URL_PARAM,
    SF_DIR_QUERY_TOKEN,
    SF_RETRY_ON_CURLE_COULDNT_CONNECT_COUNT,
    SF_QUERY_RESULT_TYPE
} SF_ATTRIBUTE;

/**
 * Attributes for Snowflake global context.
 */
typedef enum SF_GLOBAL_ATTRIBUTE {
    SF_GLOBAL_DISABLE_VERIFY_PEER,
    SF_GLOBAL_CA_BUNDLE_FILE,
    SF_GLOBAL_SSL_VERSION,
    SF_GLOBAL_DEBUG,
    SF_GLOBAL_OCSP_CHECK
} SF_GLOBAL_ATTRIBUTE;

/**
 * Attributes for Snowflake statement context.
 */
typedef enum SF_STMT_ATTRIBUTE {
    SF_STMT_USER_REALLOC_FUNC
} SF_STMT_ATTRIBUTE;

/**
 * Snowflake Error
 */
typedef struct SF_ERROR_STRUCT {
    SF_STATUS error_code;
    char sqlstate[SF_SQLSTATE_LEN];
    char *msg;
    sf_bool is_shared_msg;
    char sfqid[SF_UUID4_LEN];
    char *file;
    int line;
} SF_ERROR_STRUCT;
/**
 * Snowflake database session context.
 */
typedef struct SF_CONNECT {
    char *account;
    char *region;
    char *user;
    char *password;
    char *database;
    char *schema;
    char *warehouse;
    char *role;
    char *host;
    char *port;
    char *protocol;

    char *passcode;
    sf_bool passcode_in_password;
    sf_bool insecure_mode;
    sf_bool autocommit;
    char *timezone;
    char *service_name;
    char *query_result_format;

    /* used when updating parameters */
    SF_MUTEX_HANDLE mutex_parameters;

    char *authenticator;

    // the instance of authenticator, if needed
    void * auth_object;

    // key pair authentication
    char *priv_key_file;
    char *priv_key_file_pwd;
    int64 jwt_timeout;
    int64 jwt_cnxn_wait_time;

    // Overrider application name and version
    char *application_name;
    char *application_version;

    // Partner application name
    char * application;

    // Proxy
    char * proxy;
    char * no_proxy;

    // Query Context Cache
    // the flag of whether to disable qcc, false by default
    sf_bool qcc_disable;
    // the cache capacity
    uint64 qcc_capacity;
    // the pointer of qcc instance
    void * qcc;

    // whether to include retry reason in retry for query request
    sf_bool include_retry_reason;

    // Session info
    char *token;
    char *master_token;

    int64 login_timeout;
    int64 network_timeout;
    // retry timeout for new retry strategy
    int64 retry_timeout;

    // Session specific fields
    int64 sequence_counter;
    SF_MUTEX_HANDLE mutex_sequence_counter;
    char request_id[SF_UUID4_LEN];

    char *directURL;

    char *directURL_param;

    char *direct_query_token;

    int8 retry_on_curle_couldnt_connect_count;

    int8 retry_on_connect_count;

    // max retry number for new retry strategy
    int8 retry_count;

    // Error
    SF_ERROR_STRUCT error;
} SF_CONNECT;

/**
 * Column description context. idx is indexed from 1.
 */
typedef struct SF_COLUMN_DESC {
    size_t idx;
    char *name;
    SF_DB_TYPE type;
    SF_C_TYPE c_type;
    int64 byte_size;
    int64 internal_size;
    int64 precision;
    int64 scale;
    sf_bool null_ok;
} SF_COLUMN_DESC;

typedef struct SF_STATS {
    int64 num_rows_inserted;
    int64 num_rows_updated;
    int64 num_rows_deleted;
    int64 num_duplicate_rows_updated;
} SF_STATS;

/**
 * For certain applications, we may wish to capture
 * the raw response after issuing a query to Snowflake.
 * This is a structure used for capturing the results.
 * Note that these should always be constructed
 * with snowflake_query_result_capture_init(), and be
 * destructed with snowflake_query_result_capture_term().
 */
typedef struct SF_QUERY_RESULT_CAPTURE {
    // The buffer for storing the results
    char* capture_buffer;
    // Actual response size
    size_t actual_response_size;
} SF_QUERY_RESULT_CAPTURE;

/**
 * Chunk downloader context
 */
typedef struct SF_CHUNK_DOWNLOADER SF_CHUNK_DOWNLOADER;

/**
 * Put get response struct
 */
typedef struct SF_PUT_GET_RESPONSE SF_PUT_GET_RESPONSE;

/**
 * Statement context
 */
typedef struct SF_STMT {
    char sfqid[SF_UUID4_LEN];
    int64 sequence_counter;
    char request_id[SF_UUID4_LEN];
    SF_ERROR_STRUCT error;
    SF_CONNECT *connection;
    void *qrf;
    char *sql_text;
    void *result_set;
    int64 chunk_rowcount;
    int64 total_rowcount;
    int64 total_fieldcount;
    int64 total_row_index;
    void *params;
    void *name_list;
    unsigned int params_len;
    SF_COLUMN_DESC *desc;
    SF_STATS *stats;
    void *stmt_attrs;
    sf_bool is_dml;

    /**
     * User realloc function used in snowflake_fetch
     */
    void *(*user_realloc_func)(void*, size_t);

    SF_CHUNK_DOWNLOADER *chunk_downloader;
    SF_PUT_GET_RESPONSE *put_get_response;
} SF_STMT;

/**
 * Bind input parameter context
 */
typedef struct {
    size_t idx; /* One based index of the columns, 0 if Named */
    char * name; /* Named Parameter name, NULL if positional */
    SF_C_TYPE c_type; /* input data type in C */
    void *value; /* input value */
    size_t len; /* input value length. valid only for SF_C_TYPE_STRING */
    SF_DB_TYPE type; /* (optional) target Snowflake data type */
} SF_BIND_INPUT;

/**
 *
 */
typedef struct SF_USER_MEM_HOOKS {
    void *(*alloc_fn)(size_t size);
    void (*dealloc_fn)(void *ptr);
    void *(*realloc_fn)(void *ptr, size_t size);
    void *(*calloc_fn)(size_t nitems, size_t size);
} SF_USER_MEM_HOOKS;

/**
 * Timestamp type that can represent any Snowflake DB Datetime/Timestamp type
 */
typedef struct SF_TIMESTAMP {
    struct tm tm_obj;
    int32 nsec;
    int32 tzoffset;
    int32 scale;
    SF_DB_TYPE ts_type;
} SF_TIMESTAMP;

/**
 * Initializes an SF_QUERY_RESPONSE_CAPTURE struct.
 * Note that these need to be released by calling snowflake_query_result_capture_term().
 *
 * @param input pointer to an uninitialized SF_QUERY_RESULT_CAPTURE struct pointer.
 */
void STDCALL snowflake_query_result_capture_init(SF_QUERY_RESULT_CAPTURE **input);

/**
 * Global Snowflake initialization.
 *
 * @return 0 if successful, errno otherwise
 */
SF_STATUS STDCALL
snowflake_global_init(const char *log_path, SF_LOG_LEVEL log_level, SF_USER_MEM_HOOKS *hooks);

/**
 * Global Snowflake cleanup.
 *
 * @return 0 if successful, errno otherwise
 */
SF_STATUS STDCALL snowflake_global_term();

/**
 * Set a global attribute
 * @param type a value of SF_GLOBAL_ATTRIBUTE
 * @param value a pointer to value
 * @return 0 if successful, errno otherise.
 */
SF_STATUS STDCALL snowflake_global_set_attribute(
    SF_GLOBAL_ATTRIBUTE type, const void *value);

/**
 * Get a global attribute
 * @param type a value of SF_GLOBAL_ATTRIBUTE
 * @param value a pointer to value buffer
 * @param buffer size
 * @return 0 if successful, errno otherise.
 */
SF_STATUS STDCALL snowflake_global_get_attribute(
    SF_GLOBAL_ATTRIBUTE type, void *value, size_t size);

/**
 * Initializes a SNOWFLAKE connection context
 *
 * @return SNOWFLAKE context if success
 */
SF_CONNECT *STDCALL snowflake_init();

/**
 * Purge a SNOWFLAKE connection context
 *
 * @param sf SNOWFLAKE context. The data will be freed from memory.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_term(SF_CONNECT *sf);

/**
 * Creates a new session and connects to Snowflake database.
 *
 * @param sf SNOWFLAKE context.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_connect(SF_CONNECT *sf);

/**
 * Sets the attribute to the session.
 *
 * @param sf SNOWFLAKE context.
 * @param type the attribute name type
 * @param value pointer to the attribute value
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_set_attribute(
    SF_CONNECT *sf, SF_ATTRIBUTE type, const void *value);

/**
 * Gets the attribute value from the session.
 *
 * @param sf SNOWFLAKE context.
 * @param type the attribute name type
 * @param value pointer to the attribute value buffer
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_get_attribute(
    SF_CONNECT *sf, SF_ATTRIBUTE type, void **value);

/**
 * Creates sf SNOWFLAKE_STMT context.
 *
 * @param sfstmt SNOWFLAKE_STMT context.
 */
SF_STMT *STDCALL snowflake_stmt(SF_CONNECT *sf);

/**
 * Frees the memory used by a SF_QUERY_RESULT_CAPTURE struct.
 * Note that this only frees the struct itself, and *not* the underlying
 * capture buffer! The caller is responsible for managing that.
 *
 * @param capture SF_QUERY_RESULT_CAPTURE pointer whose memory to clear.
 *
 */
 void STDCALL snowflake_query_result_capture_term(SF_QUERY_RESULT_CAPTURE *capture);

/**
 * Closes and terminates a statement context
 * @param sfstmt SNOWFLAKE_STMT context.
 * @return 0 if success, otherwise an errno is returned.
 */
void STDCALL snowflake_stmt_term(SF_STMT *sfstmt);

/**
 * Begins a new transaction.
 *
 * @param sf SNOWFLAKE context.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_trans_begin(SF_CONNECT *sf);

/**
 * Commits a current transaction.
 *
 * @param sf SNOWFLAKE context.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_trans_commit(SF_CONNECT *sf);

/**
 * Rollbacks a current transaction.
 *
 * @param sf SNOWFLAKE context.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_trans_rollback(SF_CONNECT *sf);

/**
 * Returns an error context for the SNOWFLAKE_STMT context.
 *
 * @param sfstmt SNOWFLAKE_STMT context.
 * @return error context
 */
SF_ERROR_STRUCT *STDCALL snowflake_stmt_error(SF_STMT *sfstmt);

/**
 * Returns an error context for the SNOWFLAKE context.
 *
 * @param sf SNOWFLAKE context.
 * @return error context
 */
SF_ERROR_STRUCT *STDCALL snowflake_error(SF_CONNECT *sf);

/**
 * Propagate SF_STMT error to SF_CONNECT so that the latest statement
 * error is visible in the connection context.
 *
 * @param sf SNOWFLAKE context
 * @param sfstmt SNOWFLAKE_STMT context.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_propagate_error(SF_CONNECT *sf, SF_STMT *sfstmt);

/**
 * Executes a query and returns result set. This function works only for
 * queries and commands that return result set. If no result set is returned,
 * NULL is returned.
 *
 * @param sf SNOWFLAKE_STMT context.
 * @param command a query or command that returns results.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL
snowflake_query(SF_STMT *sfstmt, const char *command, size_t command_size);

/**
 * Returns the number of affected rows in the last execution.  This function
 * works only for DML, i.e., INSERT, UPDATE, DELETE, MULTI TABLE INSERT, MERGE
 * and COPY.
 *
 * @param sf SNOWFLAKE_STMT context.
 * @return the number of affected rows
 */
int64 STDCALL snowflake_affected_rows(SF_STMT *sfstmt);

/**
 * Returns the number of rows can be fetched from the result set.
 *
 * @param sfstmt SNOWFLAKE_RESULTSET context.
 * @return the number of rows.
 */
int64 STDCALL snowflake_num_rows(SF_STMT *sfstmt);

/**
 * Returns the number of fields in the result set.
 *
 * @param sfstmt SNOWFLAKE_RESULTSET context.
 * @return the number of fields.
 */
int64 STDCALL snowflake_num_fields(SF_STMT *sfstmt);

/**
 * Returns a SQLState for the result set.
 *
 * @param sfstmt SNOWFLAKE_STMT context.
 * @return SQL State
 */
const char *STDCALL snowflake_sqlstate(SF_STMT *sfstmt);

/**
 * Gets an array of column metadata. The value returned by snowflake_num_fields is the size of the column metadata array
 *
 * @param sf SNOWFLAKE_STMT context.
 * @return SF_COLUMN_DESC if success or NULL
 */
SF_COLUMN_DESC *STDCALL snowflake_desc(SF_STMT *sfstmt);

/**
 * Prepares a statement.
 *
 * @param sfstmt SNOWFLAKE_STMT context.
 * @param command a query or command that returns results.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL
snowflake_prepare(SF_STMT *sfstmt, const char *command, size_t command_size);

/**
 * Sets a statement attribute.
 *
 * @param sf SNOWFLAKE_STMT context.
 * @param type the attribute name type
 * @param value pointer to the attribute value
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL
snowflake_stmt_set_attr(SF_STMT *sfstmt, SF_STMT_ATTRIBUTE type,
                        const void *value);

/**
 * Gets a statement attribute value.
 *
 * @param sf SNOWFLAKE_STMT context.
 * @param type the attribute name type
 * @param value pointer to the attribute value buffer
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL
snowflake_stmt_get_attr(SF_STMT *sfstmt, SF_STMT_ATTRIBUTE type, void **value);

/**
 * Executes a statement.
 * @param sfstmt SNOWFLAKE_STMT context.
 *
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_execute(SF_STMT *sfstmt);

/**
 * Executes a statement with capture.
 * @param sfstmt SNOWFLAKE_STMT context.
 * @param result_capture pointer to a SF_QUERY_RESULT_CAPTURE
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_execute_with_capture(SF_STMT *sfstmt,
        SF_QUERY_RESULT_CAPTURE* result_capture);

/**
 * Executes a statement with capture in describe only mode.
 * @param sfstmt SNOWFLAKE_STMT context.
 * @param result_capture pointer to a SF_QUERY_RESULT_CAPTURE
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_describe_with_capture(SF_STMT *sfstmt,
                                                  SF_QUERY_RESULT_CAPTURE *result_capture);

/**
 * Fetches the next row for the statement and stores on the bound buffer
 * if any. Noop if no buffer is bound.
 *
 * @param sfstmt SNOWFLAKE_RESULTSET context.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_fetch(SF_STMT *sfstmt);

/**
 * Returns the number of binding parameters in the statement.
 *
 * @param sfstmt SNOWFLAKE_STMT context.
 * @return the number of binding parameters in the statement.
 */
uint64 STDCALL snowflake_num_params(SF_STMT *sfstmt);


/**
 * Initializes a bind input.
 *
 * SF_BIND_INPUT needs to be properly initialized to
 * avoid undefined behavior. Each SF_BIND_INPUT instance
 * can either represent a named bind input or a positional
 * bind input. The name or the idx member of the instance
 * respectively would need to be initialized accordingly.
 *
 * For Named parameters:
 * SF_BIND_INPUT idx = 0
 *
 * For Positional parameters:
 * SF_BIND_INPUT name = NULL;
 *
 * @param input preallocated SF_BIND_INPUT instance
 * @return void
 */
void STDCALL snowflake_bind_input_init(SF_BIND_INPUT * input);

/**
 * Binds parameters with the statement for execution.
 *
 * @param sfstmt SNOWFLAKE_STMT context.
 * @param sfbind SNOWFLAKE_BIND_INPUT context array.
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL snowflake_bind_param(
    SF_STMT *sfstmt, SF_BIND_INPUT *sfbind);

/**
 * Binds an array of parameters with the statement for execution.
 *
 * @param sfstmt SF_STMT context.
 * @param sfbind_array SF_BIND_INPUT array of bind input values.
 * @param size size_t size of the parameter array (sfbind_array).
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS snowflake_bind_param_array(
    SF_STMT *sfstmt, SF_BIND_INPUT *sfbind_array, size_t size);

/**
 * Returns a query id associated with the statement after execution. If not
 * executed, NULL is returned.
 *
 * @param sfstmt SNOWFLAKE_STMT context.
 * @return query id associated with the statement.
 */
const char *STDCALL snowflake_sfqid(SF_STMT *sfstmt);

/**
 * Converts Snowflake Type enum value to a string representation
 * @param type SF_TYPE enum
 * @return a string representation of Snowflake Type
 */
const char *STDCALL snowflake_type_to_string(SF_DB_TYPE type);

/**
 * Converts Snowflake C Type enum value to a string representation
 * @param type SF_C_TYPE
 * @return a string representation of Snowflake C Type
 */
const char *STDCALL snowflake_c_type_to_string(SF_C_TYPE type);


/**
 * Internal: check connection parameters
*
 * @param sf SF_CONNECT context
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL _snowflake_check_connection_parameters(SF_CONNECT *sf);

/**
 * Internal: Advances the iterators of the result set object stored in sfstmt->result_set.
 *
 * If the query result format is ARROW, then advance to next column.
 * If the query result format is JSON, then advance to next row.
 *
 * @param sfstmt SF_STMT context
 * @return 0 if success, otherwise an errno is returned.
 */
SF_STATUS STDCALL _snowflake_next(SF_STMT *sfstmt);

/**
 * Converts a column in the current row into a boolean value (if a valid conversion exists).
 * A NULL column will evaluate to false.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_boolean(SF_STMT *sfstmt, int idx, sf_bool *value_ptr);

/**
 * Stores the first character of the column in a uint8 variable. A NULL column will evaluate to 0
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_uint8(SF_STMT *sfstmt, int idx, uint8 *value_ptr);

/**
 * Converts a column in the current row into a uint32 value (if a valid conversion exists).
 * A NULL column will evaluate to 0.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_uint32(SF_STMT *sfstmt, int idx, uint32 *value_ptr);

/**
 * Converts a column in the current row into a uint64 value (if a valid conversion exists).
 * A NULL column will evaluate to 0.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_uint64(SF_STMT *sfstmt, int idx, uint64 *value_ptr);

/**
 * Stores the first character of the column in a int8 variable. A NULL column will evaluate to 0
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_int8(SF_STMT *sfstmt, int idx, int8 *value_ptr);

/**
 * Converts a column in the current row into a int32 value (if a valid conversion exists).
 * A NULL column will evaluate to 0.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_int32(SF_STMT *sfstmt, int idx, int32 *value_ptr);

/**
 * Converts a column in the current row into a int64 value (if a valid conversion exists).
 * A NULL column will evaluate to 0.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_int64(SF_STMT *sfstmt, int idx, int64 *value_ptr);

/**
 * Converts a column in the current row into a float32 value (if a valid conversion exists).
 * A NULL column will evaluate to 0.0.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_float32(SF_STMT *sfstmt, int idx, float32 *value_ptr);

/**
 * Converts a column in the current row into a float64 value (if a valid conversion exists).
 * A NULL column will evaluate to 0.0.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_float64(SF_STMT *sfstmt, int idx, float64 *value_ptr);

/**
 * Converts a column in the current row into a SF_TIMESTAMP value (if a valid conversion exists).
 * A NULL column will evaluate to the epoch.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Coverted column data is stored in this pointer (if conversion was successful)
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_timestamp(SF_STMT *sfstmt, int idx, SF_TIMESTAMP *value_ptr);

/**
 * Returns the raw column data in the form of a const char pointer that the user can then use
 * to read the string data or copy to another buffer. A NULL column will return a NULL pointer
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Raw column data is stored in this pointer
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_const_str(SF_STMT *sfstmt, int idx, const char **value_ptr);

/**
 * Given the raw value as a string, returns the string representation
 *
 * @param sfstmt (can be null) SF_STMT context to be used for extracting sfqid and error
 * @param const_str_val the src raw value
 * @param type the target type
 *  (caller is responsible to make sure currect type is passed in for the raw value)
 * @param connection_timezone to be used for extracting timestamp string values
 * @param scale to be used for extracting timestamp string values
 * @param isNull
 * @param value_ptr Copied Column data is stored in this pointer (if conversion was successful)
 * @param value_len_ptr The length of the string value. This is what you would get if you were to call strlen(*value_ptr).
 * @param max_value_size_ptr The size of the value buffer. If value_ptr is reallocated because the data to copy is too
 *        large, then this ptr will hold the value of the new buffer size.
 * @return 0 if success, otherwise an errno is returned
 * @return
 */
SF_STATUS STDCALL snowflake_raw_value_to_str_rep(SF_STMT *sfstmt,
                                                 const char *const_str_val,
                                                 const SF_DB_TYPE type,
                                                 const char *connection_timezone,
                                                 int32 scale, sf_bool isNull,
                                                 char **value_ptr,
                                                 size_t *value_len_ptr,
                                                 size_t *max_value_size_ptr);

/**
 * Converts a column into a string, copies to the buffer provided and stores that buffer address in value_ptr. If
 * *value_ptr is not NULL and max_value_size_ptr is not NULL and greater than 0, then the library will copy the string
 * data into the provided buffer. If the provided buffer if not large enough, the library will reallocate this string
 * buffer and store the new buffer size in max_value_size_ptr.The user must pass this buffer to free() once they are
 * done using it, this memory is NOT freed by the library. Buffer pointed to by value_ptr will not be free'd by the library.
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Copied Column data is stored in this pointer (if conversion was successful)
 * @param value_len_ptr The length of the string value. This is what you would get if you were to call strlen(*value_ptr).
 * @param max_value_size_ptr The size of the value buffer. If value_ptr is reallocated because the data to copy is too
 *        large, then this ptr will hold the value of the new buffer size.
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_as_str(SF_STMT *sfstmt, int idx, char **value_ptr, size_t *value_len_ptr, size_t *max_value_size_ptr);

/**
 * Returns the length of the raw column data
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Pointer to the length of the raw column data
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_strlen(SF_STMT *sfstmt, int idx, size_t *value_ptr);

/**
 * Returns whether or not the column data is null
 *
 * @param sfstmt SF_STMT context
 * @param idx Column index
 * @param value_ptr Column's NULL status is stored in this pointer
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_column_is_null(SF_STMT *sfstmt, int idx, sf_bool *value_ptr);

/**
 *
 * Start of timestamp functions
 *
 */

/**
 * Creates a SF_TIMESTAMP from parts. Does not do any validation to ensure that the
 * timestamp created is a valid date other than ensure that the passed in value is within
 * the range specified for each input field.
 *
 * @param ts Pointer to a timestamp object. All fields will be overwritten
 * @param nanoseconds Number of nanoseconds in timestamp (0-999999999)
 * @param seconds Number of seconds in timestamp (0-59)
 * @param minutes Number of minutes in timestamp (0-59)
 * @param hours Number of hours in timestamp (0-23)
 * @param mday Day of the month (1-31)
 * @param months Month number of the year (1-12)
 * @param year Year using the Anno Domini dating system.
 *             Negative values are assumed to be B.C. and
 *             positive values are assumed to be A.D. (-99999 to 99999)
 * @param tzoffset Timezone offset from UTC in minutes (0-1439)
 * @return
 */
SF_STATUS STDCALL snowflake_timestamp_from_parts(SF_TIMESTAMP *ts, int32 nanoseconds, int32 seconds,
                                                 int32 minutes, int32 hours, int32 mday, int32 months,
                                                 int32 year, int32 tzoffset, int32 scale, SF_DB_TYPE ts_type);

/**
 *
 * @param ts
 * @param str
 * @param timezone
 * @param scale
 * @param ts_type
 * @return
 */
SF_STATUS STDCALL snowflake_timestamp_from_epoch_seconds(SF_TIMESTAMP *ts, const char *str, const char *timezone,
                                                         int32 scale, SF_DB_TYPE ts_type);

/**
 *
 * @param ts
 * @param fmt
 * @param buffer_ptr
 * @param buf_size
 * @param bytes_written
 * @param reallocate
 * @return
 */
SF_STATUS STDCALL snowflake_timestamp_to_string(SF_TIMESTAMP *ts, const char *fmt, char **buffer_ptr,
                                                size_t buf_size, size_t *bytes_written,
                                                sf_bool reallocate);
/**
 * Gets seconds from the epoch from the given timestamp.
 *
 * @param ts Timestamp to get epoch seconds from
 * @param epoch_time Pointer to store the number of seconds since the epoch
 * @return 0 if success, otherwise an errno is returned
 */
SF_STATUS STDCALL snowflake_timestamp_get_epoch_seconds(SF_TIMESTAMP *ts, time_t *epoch_time);

/**
 * Extracts the part of the timestamp that contains the number of nanoseconds
 *
 * @param ts Timestamp to get nanoseconds from
 * @return Returns -1 if ts is NULL, otherwise number of nanoseconds
 */
int32 STDCALL snowflake_timestamp_get_nanoseconds(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the number of seconds
 *
 * @param ts Timestamp to get seconds from
 * @return Returns -1 if ts is NULL, otherwise number of seconds
 */
int32 STDCALL snowflake_timestamp_get_seconds(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the number of minutes
 *
 * @param ts Timestamp to get minutes from
 * @return Returns -1 if ts is NULL, otherwise number of minutes
 */
int32 STDCALL snowflake_timestamp_get_minutes(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the number of hours
 *
 * @param ts Timestamp to get hours from
 * @return Returns -1 if ts is NULL, otherwise number of hours
 */
int32 STDCALL snowflake_timestamp_get_hours(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the day of the week since Sunday
 *
 * @param ts Timestamp to get day of the week from
 * @return Returns -1 if ts is NULL, otherwise day of the week since Sunday (0-6)
 */
int32 STDCALL snowflake_timestamp_get_wday(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the day of the month
 *
 * @param ts Timestamp to get day of the month from
 * @return Returns -1 if ts is NULL, otherwise day of the month (1-31)
 */
int32 STDCALL snowflake_timestamp_get_mday(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the day of the year since January 1
 *
 * @param ts Timestamp to get day of the year from
 * @return Returns -1 if ts is NULL, otherwise the day of the year since January 1 (0-365)
 */
int32 STDCALL snowflake_timestamp_get_yday(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the month of the year
 *
 * @param ts Timestamp to get month of the year from
 * @return Returns -1 if ts is NULL, otherwise month of the year (1-12)
 */
int32 STDCALL snowflake_timestamp_get_month(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the year
 *
 * @param ts Timestamp to get the year from
 * @return Returns -100000 if ts is NULL, otherwise the year
 */
int32 STDCALL snowflake_timestamp_get_year(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the timezone offset
 *
 * @param ts Timestamp to get timezone offset from
 * @return Returns -1 if ts is NULL, otherwise the timezone offset (0-1439)
 */
int32 STDCALL snowflake_timestamp_get_tzoffset(SF_TIMESTAMP *ts);

/**
 * Extracts the part of the timestamp that contains the scale
 *
 * @param ts Timestamp to get month of the year from
 * @return Returns -1 if ts is NULL, otherwise scale from timestamp (0-9)
 */
int32 STDCALL snowflake_timestamp_get_scale(SF_TIMESTAMP *ts);

#ifdef  __cplusplus
}
#endif

#endif //SNOWFLAKE_CLIENT_H
