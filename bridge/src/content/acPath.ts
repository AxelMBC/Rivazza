import fs from "node:fs";
import path from "node:path";

const DEFAULT_AC_PATH =
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\assettocorsa";
const STEAM_LIBRARY_CONFIGS = [
  "C:\\Program Files (x86)\\Steam\\config\\libraryfolders.vdf",
  "C:\\Program Files\\Steam\\config\\libraryfolders.vdf",
];

const discoverAcPath = (): string => {
  if (process.env.AC_PATH) return process.env.AC_PATH;
  for (const vdfPath of STEAM_LIBRARY_CONFIGS) {
    let vdf: string;
    try {
      vdf = fs.readFileSync(vdfPath, "utf8");
    } catch {
      continue;
    }
    // libraryfolders.vdf lists every library (default included) as "path" "X:\\...".
    for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      const library = match[1].replace(/\\\\/g, "\\");
      const candidate = path.join(
        library,
        "steamapps",
        "common",
        "assettocorsa",
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return DEFAULT_AC_PATH;
};

export const AC_PATH = discoverAcPath();
if (fs.existsSync(AC_PATH)) {
  console.log(`[map] using AC install at ${AC_PATH}`);
} else {
  console.warn(
    `[map] AC install not found at ${AC_PATH} — set the AC_PATH env var to your assettocorsa folder`,
  );
}
