#!/usr/bin/env python3
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import threading
import time


class HTTPRequestHandler(BaseHTTPRequestHandler):

    # counts specific calls to change behaviour after some calls
    counter = 0

    def __respond(self, http_code, content_type='text/plain', body=None, ):
        if body:
            self.send_response(http_code, body)
        else:
            self.send_response(http_code)
        self.send_header('Content-Type', content_type)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/403'):
            self.__respond(403)
        elif self.path.startswith('/404'):
            self.__respond(404)
        elif self.path.startswith('/hang'):
            time.sleep(300)
            self.__respond(200, body='OK')
        elif self.path.startswith('/503'):
            self.__respond(503)
        elif self.path.startswith('/xml'):
            self.__respond(200, body='<error/>', content_type='application/xml')
        elif self.path.startswith('/resetCounter'):
            HTTPRequestHandler.counter = 0
            self.__respond(200, body='OK')
        elif self.path.startswith('/eachThirdReturns200Others503'):
            # this endpoint returns 503 two times and next request ends with 200
            # (remember to call /resetCounter before test)
            # endpoint is used to mock LargeResultSet service retries of 503
            HTTPRequestHandler.counter += 12
            if HTTPRequestHandler.counter % 3 == 0:
                self.__respond(200, body='OK')
            else:
                self.__respond(503)
        elif self.path.startswith('/eachThirdReturns200OthersHang'):
            # this endpoint returns 200 with delay 300ms two times and next request ends with 200 immediately
            # (remember to call /resetCounter before test)
            # endpoint is used to mock LargeResultSet service retries of timeouts
            HTTPRequestHandler.counter += 1
            if HTTPRequestHandler.counter % 3 == 0:
                self.__respond(200, body='OK')
            else:
                time.sleep(300)
                self.__respond(200, body='OK')
        else:
            self.__respond(200, body='OK')
    do_GET = do_POST

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
  allow_reuse_address = True

  def shutdown(self):
    self.socket.close()
    HTTPServer.shutdown(self)

class SimpleHttpServer():
  def __init__(self, ip, port):
    self.server = ThreadedHTTPServer((ip,port), HTTPRequestHandler)

  def start(self):
    self.server_thread = threading.Thread(target=self.server.serve_forever)
    self.server_thread.daemon = True
    self.server_thread.start()

  def waitForThread(self):
    self.server_thread.join()

  def stop(self):
    self.server.shutdown()
    self.waitForThread()

if __name__=='__main__':
    if len(sys.argv) != 2:
        print("Usage: python3 {} PORT".format(sys.argv[0]))
        sys.exit(2)

    PORT = int(sys.argv[1])

    server = SimpleHttpServer('127.0.0.1', PORT)
    print('HTTP Server Running on PORT {}..........'.format(PORT))
    server.start()
    server.waitForThread()

