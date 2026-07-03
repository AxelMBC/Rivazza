import dgram from 'node:dgram';
import { EventEmitter } from 'node:events';
import {
  HANDSHAKE_RESPONSE_SIZE,
  OperationId,
  RT_CAR_INFO_SIZE,
  buildHandshakePacket,
  parseHandshakerResponse,
  parseRTCarInfo,
} from './parsers.js';
import type { HandshakerResponse, TelemetryFrame } from './types.js';

const AC_HOST = process.env.AC_HOST ?? '127.0.0.1';
const AC_PORT = Number(process.env.AC_PORT ?? 9996);
const HANDSHAKE_RETRY_MS = 3000;
const STALE_SESSION_MS = 5000;

type ACClientEvents = {
  session: [HandshakerResponse];
  telemetry: [TelemetryFrame];
  waiting: [];
};

// Talks AC's remote telemetry protocol: handshake -> subscribe -> RTCarInfo
// stream. Keeps retrying while the game is closed / in menus, and drops back
// to handshaking when packets stop arriving (user exited the session).
export class ACClient extends EventEmitter<ACClientEvents> {
  private socket = dgram.createSocket('udp4');
  private state: 'handshaking' | 'subscribed' = 'handshaking';
  private retryTimer: NodeJS.Timeout | null = null;
  private staleTimer: NodeJS.Timeout | null = null;

  start = (): void => {
    this.socket.on('message', this.onMessage);
    this.socket.on('error', (err) => {
      console.error('[ac] socket error:', err.message);
    });
    this.beginHandshaking();
  };

  stop = (): void => {
    if (this.retryTimer) clearInterval(this.retryTimer);
    if (this.staleTimer) clearTimeout(this.staleTimer);
    if (this.state === 'subscribed') this.send(OperationId.DISMISS);
    this.socket.close();
  };

  private beginHandshaking = (): void => {
    this.state = 'handshaking';
    this.emit('waiting');
    this.send(OperationId.HANDSHAKE);
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = setInterval(() => this.send(OperationId.HANDSHAKE), HANDSHAKE_RETRY_MS);
  };

  private onMessage = (msg: Buffer): void => {
    if (this.state === 'handshaking' && msg.length === HANDSHAKE_RESPONSE_SIZE) {
      const session = parseHandshakerResponse(msg);
      console.log(
        `[ac] session: ${session.trackName}${session.trackConfig ? `/${session.trackConfig}` : ''} | ${session.carName} | ${session.driverName}`,
      );
      this.state = 'subscribed';
      if (this.retryTimer) clearInterval(this.retryTimer);
      this.send(OperationId.SUBSCRIBE_UPDATE);
      this.emit('session', session);
      this.touchStaleTimer();
      return;
    }

    if (this.state === 'subscribed' && msg.length === RT_CAR_INFO_SIZE) {
      this.emit('telemetry', parseRTCarInfo(msg));
      this.touchStaleTimer();
    }
  };

  // No packets for a while means the session ended; AC won't tell us.
  private touchStaleTimer = (): void => {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      console.log('[ac] telemetry went quiet, waiting for a new session');
      this.send(OperationId.DISMISS);
      this.beginHandshaking();
    }, STALE_SESSION_MS);
  };

  private send = (operationId: number): void => {
    this.socket.send(buildHandshakePacket(operationId), AC_PORT, AC_HOST);
  };
}
