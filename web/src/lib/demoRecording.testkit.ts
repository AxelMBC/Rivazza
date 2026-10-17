import { readFileSync } from "node:fs";

import type { BridgeMessage } from "@rivazza/protocol";

export const loadDemoRecording = (): { t: number; msg: BridgeMessage }[] =>
  JSON.parse(
    readFileSync(
      new URL("../../public/demo/imola.json", import.meta.url),
      "utf8",
    ),
  ) as { t: number; msg: BridgeMessage }[];
