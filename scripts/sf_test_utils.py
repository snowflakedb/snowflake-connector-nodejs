#!/usr/bin/env python
#
# Snowflake test utils
#
import os
import sys

def get_test_schema():
    travis_job_id = os.getenv('TRAVIS_JOB_ID')
    appveyor_job_id = os.getenv('APPVEYOR_BUILD_ID')
    if not travis_job_id and not appveyor_job_id:
        print("[WARN] The environment variable TRAVIS_JOB_ID or APPVEYOR_BUILD_ID is not set. No test schema will be created.")
        sys.exit(1)

    return 'TRAVIS_JOB_{0}'.format(travis_job_id) if travis_job_id else 'APPVEYOR_BUILD_{0}'.format(appveyor_job_id)


def init_connection_params():
    params = {
        'account': os.getenv("SNOWFLAKE_TEST_ACCOUNT"),
        'user': os.getenv("SNOWFLAKE_TEST_USER"),
        'password': os.getenv("SNOWFLAKE_TEST_PASSWORD"),
        'database': os.getenv("SNOWFLAKE_TEST_DATABASE"),
        'role': os.getenv("SNOWFLAKE_TEST_ROLE"),
    }
    host = os.getenv("SNOWFLAKE_TEST_HOST")
    if host:
        params['host'] = host
    port = os.getenv("SNOWFLAKE_TEST_PORT")
    if port:
        params['port'] = port
    protocol = os.getenv("SNOWFLAKE_TEST_PROTOCOL")
    if protocol:
        params['protocol'] = protocol
    warehouse = os.getenv("SNOWFLAKE_TEST_WAREHOUSE")
    if warehouse:
        params['warehouse'] = warehouse

    return params
