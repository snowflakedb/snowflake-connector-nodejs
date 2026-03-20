/*
 * WireMock's --enable-browser-proxying always performs TLS interception (MITM) for HTTPS CONNECT
 * requests, replacing the destination server's certificate with a dynamically generated one that
 * lacks some extensions. There is no WireMock option to disable this.
 *
 * This is a simple CONNECT tunnel proxy that pipes bytes without terminating TLS, allowing the
 * client to see the real server certificate. Needed for tests like CRL validation that depend
 * on the original certificate.
 */
import http from 'http';
import net from 'net';

export class ProxyServer {
  readonly port: number;
  private server: http.Server;
  private openSockets = new Set<net.Socket>();

  constructor(server: http.Server, port: number) {
    this.server = server;
    this.port = port;
  }

  trackSocket(socket: net.Socket) {
    this.openSockets.add(socket);
    socket.on('close', () => this.openSockets.delete(socket));
  }

  async shutdown(): Promise<void> {
    for (const socket of this.openSockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve, reject) =>
      this.server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

export async function startProxyServer(port = 0): Promise<ProxyServer> {
  // This proxy only handles CONNECT tunneling. Reject plain HTTP requests
  // that arrive here by mistake instead of letting them hang with no response.
  const server = http.createServer((_req, res) => {
    res.writeHead(405);
    res.end();
  });

  const proxyServer = await new Promise<ProxyServer>((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const assignedPort = (server.address() as net.AddressInfo).port;
      resolve(new ProxyServer(server, assignedPort));
    });
  });

  server.on('connect', (req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
    const [host, destPort] = req.url!.split(':');
    const serverSocket = net.connect(parseInt(destPort), host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    proxyServer.trackSocket(clientSocket);
    proxyServer.trackSocket(serverSocket);
    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  });

  return proxyServer;
}
