import { kernel32 } from "./kernel32.js";

// The UDP handshake omits the layout subfolder of multi-layout tracks; the
// static page names it. ~800 B struct, so a 1 KB read stays in its page.
const MAPPING_NAME = "Local\\acpmf_static";
const READ_SIZE = 1024;

export const readStaticPageTokens = async (): Promise<ReadonlySet<string>> => {
  const page = (await kernel32())?.mapPage(MAPPING_NAME);
  if (!page) return new Set();
  const buffer = Buffer.alloc(READ_SIZE);
  try {
    page.read(buffer);
  } finally {
    page.close();
  }
  return new Set(
    buffer
      .toString("utf16le")
      .split(/[^A-Za-z0-9_-]+/)
      .filter(Boolean),
  );
};
