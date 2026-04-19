import { execSync, spawn } from "node:child_process";

const args = process.argv.slice(2);
const hostArgIndex = args.findIndex((arg) => arg === "--host");
const portArgIndex = args.findIndex((arg) => arg === "--port");
const host = hostArgIndex >= 0 ? args[hostArgIndex + 1] : "127.0.0.1";
const port = portArgIndex >= 0 ? args[portArgIndex + 1] : "5173";
const passthroughArgs = args.filter((arg, index) => {
  if (arg === "--host" || arg === "--port") {
    return false;
  }
  if (hostArgIndex >= 0 && index === hostArgIndex + 1) {
    return false;
  }
  if (portArgIndex >= 0 && index === portArgIndex + 1) {
    return false;
  }
  return true;
});

try {
  const output = execSync(`lsof -ti tcp:${port}`, {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();

  if (output) {
    const pids = [...new Set(output.split("\n").filter(Boolean))];
    for (const pid of pids) {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    console.log(`Released port ${port}: ${pids.join(", ")}`);
  }
} catch {
  // No process is listening on the target port.
}

const vite = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "--host", host, "--port", port, "--strictPort", ...passthroughArgs],
  { stdio: "inherit" },
);

vite.on("exit", (code) => {
  process.exit(code ?? 0);
});
