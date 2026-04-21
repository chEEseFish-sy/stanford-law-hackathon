import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const backendHost = "127.0.0.1";
const backendPort = "8000";
const frontendHost = "127.0.0.1";
const frontendPort = "5173";
const isWindows = process.platform === "win32";

const pythonExecutableCandidates = [
  path.join(rootDir, ".venv", isWindows ? "Scripts/python.exe" : "bin/python3"),
  path.join(rootDir, ".venv", isWindows ? "Scripts/python.exe" : "bin/python"),
  isWindows ? "python" : "python3",
];

const pythonExecutable = pythonExecutableCandidates.find((candidate) => existsSync(candidate)) ?? pythonExecutableCandidates.at(-1);

const childProcesses = [];
let shuttingDown = false;
let frontendStarted = false;

const terminateChildren = () => {
  shuttingDown = true;
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
};

const exitWithError = (message) => {
  console.error(message);
  terminateChildren();
  process.exit(1);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForBackend = async (retries = 40, intervalMs = 500) => {
  const healthUrl = `http://${backendHost}:${backendPort}/api/health`;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Backend is still starting.
    }
    await sleep(intervalMs);
  }

  throw new Error(`Backend did not become healthy at ${healthUrl}`);
};

process.on("SIGINT", () => {
  terminateChildren();
  process.exit(0);
});

process.on("SIGTERM", () => {
  terminateChildren();
  process.exit(0);
});

const backend = spawn(
  pythonExecutable,
  ["-m", "uvicorn", "backend.api_server:app", "--reload", "--host", backendHost, "--port", backendPort],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

childProcesses.push(backend);

backend.on("exit", (code) => {
  if (!shuttingDown && !frontendStarted && code !== 0) {
    exitWithError(`Backend exited early with code ${code ?? "unknown"}.`);
  }
});

try {
  await waitForBackend();
} catch (error) {
  exitWithError(error instanceof Error ? error.message : "Failed to start backend.");
}

const npmExecutable = isWindows ? "npm.cmd" : "npm";
const frontend = spawn(
  npmExecutable,
  ["run", "dev", "--", "--host", frontendHost, "--port", frontendPort],
  {
    cwd: path.join(rootDir, "frontend"),
    stdio: "inherit",
  },
);

childProcesses.push(frontend);
frontendStarted = true;

frontend.on("exit", (code) => {
  terminateChildren();
  process.exit(code ?? 0);
});
