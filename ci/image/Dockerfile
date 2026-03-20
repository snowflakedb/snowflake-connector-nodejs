ARG IMAGE
FROM $IMAGE

USER root

RUN apk update --no-cache && apk add --no-cache python3 python3-dev py3-pip jq aws-cli gosu openjdk-17
RUN pip install -U snowflake-connector-python

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
ENV PATH="$PATH:$JAVA_HOME/bin"


# workspace
RUN mkdir -p /home/user && \
    chmod 777 /home/user
WORKDIR /mnt/host

# entry point
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
