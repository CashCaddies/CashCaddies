/**
 * Windows: free TCP port 3001 (dev server auto-recover). Exits 0 even if nothing is listening.
 */
const { execSync } = require("child_process");

const port = "3001";

try {
  const out = execSync(`netstat -aon | findstr :${port}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 5) continue;
    const state = parts[3];
    const pid = parts[parts.length - 1];
    if (state === "LISTENING" && /^\d+$/.test(pid)) {
      pids.add(pid);
    }
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore", windowsHide: true });
    } catch {
      /* already gone */
    }
  }
} catch {
  /* findstr: no match */
}

process.exit(0);
