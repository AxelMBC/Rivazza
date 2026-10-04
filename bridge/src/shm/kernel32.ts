const FILE_MAP_READ = 0x0004;

// The UDP handshake omits the layout subfolder of multi-layout tracks; the
// static page names it. ~800 B struct, so a 1 KB read stays in its page.
const STATIC_MAPPING_NAME = "Local\\acpmf_static";
const STATIC_READ_SIZE = 1024;

export const SHM_STATE =
  process.platform !== "win32"
    ? "unsupported"
    : process.env.AC_SHM === "0"
      ? "disabled"
      : "enabled";

export type MappedPage = {
  read: (dest: Buffer) => void;
  close: () => void;
};

export type Kernel32 = {
  mapPage: (name: string) => MappedPage | null;
};

const loadKernel32 = async (): Promise<Kernel32 | null> => {
  if (SHM_STATE !== "enabled") return null;
  try {
    const koffi = (await import("koffi")).default;
    const lib = koffi.load("kernel32.dll");
    const openFileMapping = lib.func("OpenFileMappingW", "void *", [
      "uint32",
      "bool",
      "str16",
    ]);
    const mapViewOfFile = lib.func("MapViewOfFile", "void *", [
      "void *",
      "uint32",
      "uint32",
      "uint32",
      "size_t",
    ]);
    const rtlMoveMemory = lib.func("RtlMoveMemory", "void", [
      "_Out_ uint8 *",
      "void *",
      "size_t",
    ]);
    const unmapViewOfFile = lib.func("UnmapViewOfFile", "bool", ["void *"]);
    const closeHandle = lib.func("CloseHandle", "bool", ["void *"]);
    return {
      mapPage: (name) => {
        const handle = openFileMapping(FILE_MAP_READ, false, name);
        if (handle == null) return null;
        const view = mapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0);
        if (view == null) {
          closeHandle(handle);
          return null;
        }
        return {
          read: (dest) => rtlMoveMemory(dest, view, dest.length),
          close: () => {
            unmapViewOfFile(view);
            closeHandle(handle);
          },
        };
      },
    };
  } catch (err) {
    console.log(
      "[shm] koffi unavailable, shared memory off:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
};

let kernelPromise: Promise<Kernel32 | null> | null = null;
export const kernel32 = (): Promise<Kernel32 | null> =>
  (kernelPromise ??= loadKernel32());

export const readStaticPageTokens = async (): Promise<ReadonlySet<string>> => {
  const page = (await kernel32())?.mapPage(STATIC_MAPPING_NAME);
  if (!page) return new Set();
  const buffer = Buffer.alloc(STATIC_READ_SIZE);
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
