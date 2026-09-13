import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { previewConfig } from "./preview/config.mjs";
import { createPreviewGateway } from "./preview/gateway.mjs";

let config;
try {
  config = previewConfig(process.env);
} catch (error) {
  process.stderr.write("Preview startup refused: " + error.message + "\n");
  process.exit(1);
}

// The child receives its ordinary public configuration, never gateway credentials
// or privileged integration keys. Admin editing continues to use session RLS.
const childEnv = { ...process.env, PORT: String(config.upstreamPort) };
for (const name of Object.keys(childEnv)) {
  if (
    name.startsWith("MG_PREVIEW_") ||
    name.startsWith("FEED_") ||
    name.startsWith("STRIPE_") ||
    name.startsWith("E2E_") ||
    name.startsWith("SEED_ADMIN_") ||
    ["SUPABASE_SERVICE_ROLE_KEY", "JOBS_SECRET", "ESP_API_KEY"].includes(name)
  ) {
    delete childEnv[name];
  }
}
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(config.upstreamPort),
  ],
  { env: childEnv, stdio: "inherit" }
);
let ready = false;
let stopping = false;
const server = createPreviewGateway(config, () => ready);

const probe = setInterval(() => {
  const socket = createConnection({ host: "127.0.0.1", port: config.upstreamPort });
  socket.setTimeout(1000, () => socket.destroy());
  socket.once("connect", () => {
    ready = true;
    clearInterval(probe);
    socket.end();
  });
  socket.once("error", () => socket.destroy());
}, 250);

function stop(code) {
  if (stopping) return;
  stopping = true;
  ready = false;
  clearInterval(probe);
  child.kill("SIGTERM");
  server.close(() => {
    process.exitCode = code;
  });
  setTimeout(() => {
    child.kill("SIGKILL");
    server.closeAllConnections();
    process.exit(code);
  }, 5000).unref();
}
child.on("error", () => stop(1));
child.on("exit", (code) => stop(code || 1));
server.on("error", () => stop(1));
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
server.listen(config.port, "0.0.0.0", () => {
  process.stdout.write("MG protected preview gateway is listening\n");
});
