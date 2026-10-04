import dgram from "node:dgram";
import { EventEmitter } from "node:events";

import type { TelemetryFrame } from "@rivazza/protocol";

import {
  buildHandshakePacket,
  HANDSHAKE_RESPONSE_SIZE,
  OperationId,
  parseHandshakerResponse,
  parseRTCarInfo,
  RT_CAR_INFO_SIZE,
  type HandshakerResponse,
} from "./parsers.js";

const AC_HOST = process.env.AC_HOST ?? "127.0.0.1";
const AC_PORT = Number(process.env.AC_PORT ?? 9996);
const HANDSHAKE_RETRY_MS = 3000;
const STALE_SESSION_MS = 5000;

const isSingleFolderName = (name: string): boolean =>
  !/[\\/:]/.test(name) && !/^\.*$/.test(name);

const namesContentFolders = (session: HandshakerResponse): boolean =>
  [session.trackName, session.carName].every(isSingleFolderName) &&
  (session.trackConfig === "" || isSingleFolderName(session.trackConfig));

type ACClientEvents = {
  session: [HandshakerResponse];
  telemetry: [TelemetryFrame];
  waiting: [];
};

export class ACClient extends EventEmitter<ACClientEvents> {
  private socket = dgram.createSocket("udp4");
  private state: "handshaking" | "subscribed" = "handshaking";
  private retryTimer: NodeJS.Timeout | null = null;
  private staleTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private connected = false;

  start = (): void => {
    this.socket.on("error", this.onSocketError);
    this.socket.once("connect", this.onConnect);
    this.connect();
  };

  stop = (): void => {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.retryTimer) clearInterval(this.retryTimer);
    if (this.staleTimer) clearTimeout(this.staleTimer);
    if (this.state === "subscribed") this.send(OperationId.DISMISS);
    this.socket.close();
  };

  private connect = (): void => {
    this.socket.connect(AC_PORT, AC_HOST);
  };

  private onConnect = (): void => {
    this.connected = true;
    this.socket.on("message", this.onMessage);
    this.beginHandshaking();
  };

  private onSocketError = (err: Error): void => {
    console.error("[ac] socket error:", err.message);
    if (this.connected) return;
    this.connectTimer = setTimeout(this.connect, HANDSHAKE_RETRY_MS);
  };

  private beginHandshaking = (): void => {
    this.state = "handshaking";
    this.emit("waiting");
    this.send(OperationId.HANDSHAKE);
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = setInterval(
      () => this.send(OperationId.HANDSHAKE),
      HANDSHAKE_RETRY_MS,
    );
  };

  private onMessage = (msg: Buffer): void => {
    if (
      this.state === "handshaking" &&
      msg.length === HANDSHAKE_RESPONSE_SIZE
    ) {
      const session = parseHandshakerResponse(msg);
      if (!namesContentFolders(session)) {
        console.warn(
          `[ac] ignoring handshake with unusable names: ${JSON.stringify(session)}`,
        );
        return;
      }
      console.log(
        `[ac] session: ${session.trackName}${session.trackConfig ? `/${session.trackConfig}` : ""} | ${session.carName} | ${session.driverName}`,
      );
      this.state = "subscribed";
      if (this.retryTimer) clearInterval(this.retryTimer);
      this.send(OperationId.SUBSCRIBE_UPDATE);
      this.emit("session", session);
      this.touchStaleTimer();
      return;
    }

    if (this.state === "subscribed" && msg.length === RT_CAR_INFO_SIZE) {
      const frame = parseRTCarInfo(msg);
      this.emit("telemetry", frame);
      this.touchStaleTimer();
    }
  };

  private touchStaleTimer = (): void => {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      console.log("[ac] telemetry went quiet, waiting for a new session");
      this.send(OperationId.DISMISS);
      this.beginHandshaking();
    }, STALE_SESSION_MS);
  };

  private send = (operationId: number): void => {
    this.socket.send(buildHandshakePacket(operationId));
  };
}
