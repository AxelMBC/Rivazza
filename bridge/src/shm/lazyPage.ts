import { kernel32, type Kernel32, type MappedPage } from "./kernel32.js";

const OPEN_RETRY_MS = 3000;

export type LazyPage = {
  read: (dest: Buffer) => boolean;
  close: () => void;
};

export const createLazyPage = (page: "physics" | "graphics"): LazyPage => {
  const mappingName = `Local\\acpmf_${page}`;
  let k32: Kernel32 | null = null;
  let mapped: MappedPage | null = null;
  let nextOpenAt = 0;
  let reportedMissing = false;
  let closed = false;

  void kernel32().then((loaded) => {
    k32 = loaded;
  });

  const tryOpen = (): MappedPage | null => {
    if (!k32 || closed) return null;
    const now = performance.now();
    if (now < nextOpenAt) return null;
    nextOpenAt = now + OPEN_RETRY_MS;
    mapped = k32.mapPage(mappingName);
    if (mapped) console.log(`[shm] ${page} page mapped`);
    else if (!reportedMissing) {
      reportedMissing = true;
      console.log(
        `[shm] ${page} page not available (is AC running on this PC?), retrying quietly`,
      );
    }
    return mapped;
  };

  return {
    read: (dest) => {
      const view = mapped ?? tryOpen();
      if (!view) return false;
      view.read(dest);
      return true;
    },
    close: () => {
      closed = true;
      mapped?.close();
      mapped = null;
    },
  };
};
