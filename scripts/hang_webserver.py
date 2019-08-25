#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler 
import socket
import socketserver
import time
import sys

if len(sys.argv) != 2:
    print("Usage: python3 {} PORT".format(sys.argv[0]))
    sys.exit(2)

PORT = int(sys.argv[1])

class MyHandler(SimpleHTTPRequestHandler):

    def __init__(self,req,client_addr,server):
        SimpleHTTPRequestHandler.__init__(self,req,client_addr,server)

    def do_GET(self):
        self.send_response(200, 'OK')
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        time.sleep(300)
    do_POST = do_GET

class MyTCPServer(socketserver.TCPServer):
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(self.server_address)

httpd = MyTCPServer(("localhost", PORT), MyHandler)
try:
    print("hang webserver serving at port", PORT)
    httpd.serve_forever()
finally:
    httpd.shutdown()
