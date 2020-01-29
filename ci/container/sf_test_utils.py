#!/usr/bin/env python
#
# Snowflake test utils
#
import os
import sys

def get_test_schema():
    github_sha = os.getenv('GITHUB_SHA')
    github_runner_id = os.getenv('RUNNER_TRACKING_ID')
    if not github_sha or not github_runner_id:
        print("[WARN] The environment variable GITHUB_SHA or RUNNER_TRACKING_ID is not set. No test schema will be created.")
        return None

    return github_runner_id.replace('-', '_') + '_' + github_sha


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
