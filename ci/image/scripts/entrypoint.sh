#!/bin/bash -x
# Add local user
# Either use the LOCAL_USER_ID if passed in at runtime or
# fallback

USER_ID=${LOCAL_USER_ID:-9001}

echo "Starting with UID : $USER_ID"
adduser --shell /bin/bash -u $USER_ID -D user
export HOME=/home/user

exec /usr/bin/gosu user "$@"
