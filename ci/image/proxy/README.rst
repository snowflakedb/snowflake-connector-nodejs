********************************************************************************
Squid proxy server on the docker
********************************************************************************

This docker file was copied from:

https://github.com/fedora-cloud/Fedora-Dockerfiles/tree/master/squid

To build:

.. code-block:: bash

    docker build --rm -t squid .

To run by binding the port 3128 of the container with the port 8765 on the host:

.. code-block:: bash

    docker run --name proxy -d -p 8765:3128 squid

To test,

.. code-block:: bash

    curl -x http://localhost:8765 https://www.snowflake.net/

