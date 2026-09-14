import { previewConfig } from "./preview/config.mjs";

try {
  previewConfig(process.env);
  process.stdout.write("✓ isolated preview configuration is ready\n");
} catch (error) {
  process.stderr.write("Preview preflight failed: " + error.message + "\n");
  process.exitCode = 1;
}
