import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { decode, encode, type Message } from '../index.js';
import { type Failure, type Result } from '../../errors/index.js';
export type Session = {
  handle: (
    message: Message,
    signal: AbortSignal,
  ) => Promise<Result<Message, Failure>>;
  close: () => void;
};
export class Server {
  #server = new WebSocketServer({
    noServer: true,
    maxPayload: 65536,
    perMessageDeflate: false,
    handleProtocols: (protocols) =>
      protocols.has('n2f.v1') ? 'n2f.v1' : false,
  });
  #closed = false;
  #active = new Set<{
    ws: WebSocket;
    stop: AbortController;
    done: Promise<void>;
  }>();
  constructor(
    private readonly origin: string,
    private readonly open: () => Result<Session, Failure>,
  ) {}
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const origins = req.rawHeaders.filter(
      (_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === 'origin',
    );
    const protocol = req.headers['sec-websocket-protocol']
      ?.split(',')
      .map((s) => s.trim())
      .includes('n2f.v1');
    if (
      origins.length !== 1 ||
      req.headers.origin !== this.origin ||
      !protocol
    ) {
      socket.end(
        'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
      );
      return;
    }
    if (this.#closed || this.#active.size >= 64) {
      socket.end(
        'HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
      );
      return;
    }
    this.#server.handleUpgrade(req, socket, head, (ws) => this.accept(ws));
  }
  private accept(ws: WebSocket): void {
    ws.on('error', () => {});
    let opened: Result<Session, Failure>;
    try {
      opened = this.open();
    } catch {
      ws.terminate();
      return;
    }
    if (!opened.ok) {
      // No session exists to own a close handshake or its timeout.
      ws.terminate();
      return;
    }
    const session = opened.value;
    const stop = new AbortController();
    let finish!: () => void;
    const done = new Promise<void>((r) => {
      finish = r;
    });
    const entry = { ws, stop, done };
    this.#active.add(entry);
    let pending: Promise<void> | undefined;
    let pong = true;
    let closing = false;
    const heartbeat = setInterval(() => {
      if (!pong) {
        ws.terminate();
        return;
      }
      pong = false;
      ws.ping();
    }, 15000);
    ws.on('pong', () => {
      pong = true;
    });
    ws.on('message', (raw: Buffer, isBinary: boolean) => {
      if (closing) return;
      if (pending) {
        closing = true;
        ws.close(1013, 'message already running');
        return;
      }
      if (isBinary) {
        closing = true;
        ws.close(1003, 'text required');
        return;
      }
      const decoded = decode(raw);
      if (!decoded.ok) {
        closing = true;
        ws.close(1008, 'invalid message');
        return;
      }
      pending = (async () => {
        const operation = new AbortController();
        const onAbort = () => operation.abort();
        stop.signal.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => {
          operation.abort();
          ws.terminate();
        }, 1000);
        try {
          const response = await session.handle(
            decoded.value,
            operation.signal,
          );
          if (operation.signal.aborted || closing) return;
          if (!response.ok) {
            closing = true;
            ws.close(1011, 'message failed');
            return;
          }
          const body = encode(response.value);
          if (!body.ok) {
            closing = true;
            ws.close(1011, 'message failed');
            return;
          }
          await new Promise<void>((resolve, reject) =>
            ws.send(body.value, { binary: false }, (e) =>
              e ? reject(e) : resolve(),
            ),
          );
        } catch {
          closing = true;
          ws.close(1011, 'message failed');
        } finally {
          clearTimeout(timer);
          stop.signal.removeEventListener('abort', onAbort);
        }
      })().finally(() => {
        pending = undefined;
      });
    });
    ws.once('close', () => {
      closing = true;
      clearInterval(heartbeat);
      stop.abort();
      void (async () => {
        await pending;
        try {
          session.close();
        } catch {
          // Cleanup failure must not escape as an unhandled rejection.
        } finally {
          this.#active.delete(entry);
          finish();
        }
      })();
    });
  }
  async close(budgetMs: number): Promise<boolean> {
    this.#closed = true;
    const entries = [...this.#active];
    for (const e of entries) e.ws.close(1001, 'server stopping');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.all(entries.map((e) => e.done)).then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(
            () => {
              for (const e of entries) {
                e.stop.abort();
                e.ws.terminate();
              }
              resolve(false);
            },
            Math.max(1, budgetMs),
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      this.#server.close();
    }
  }
}
