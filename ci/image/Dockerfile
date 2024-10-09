ARG IMAGE
FROM $IMAGE

USER root

RUN apk update && apk add python3 jq aws-cli gosu
RUN pip install -U snowflake-connector-python

# workspace
RUN mkdir -p /home/user && \
    chmod 777 /home/user
WORKDIR /mnt/host

# entry point
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
