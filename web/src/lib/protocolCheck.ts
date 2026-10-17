import { PROTOCOL_VERSION } from "@rivazza/protocol";

export const matchesProtocol = (status: { protocol?: unknown }): boolean =>
  status.protocol === PROTOCOL_VERSION;
