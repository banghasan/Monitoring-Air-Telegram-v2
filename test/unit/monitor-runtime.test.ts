import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openMonitorStateRepository } from "../../src/app/monitoring/monitor-runtime.js";
import { StructuredLogger } from "../../src/infrastructure/logging/structured-logger.js";

test("state database yang dapat dibuka dan ditulis melanjutkan startup", () => {
  const directory = mkdtempSync(join(tmpdir(), "air-pantauan-state-"));
  try {
    const logs: string[] = [];
    const repository = openMonitorStateRepository(
      join(directory, "nested", "monitor.sqlite"),
      new StructuredLogger("test", (line) => logs.push(line)),
    );

    expect(repository).toBeDefined();
    expect(logs).toHaveLength(0);
    repository?.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("kegagalan path state dicatat sebagai JSON dan menghentikan inisialisasi", () => {
  const directory = mkdtempSync(join(tmpdir(), "air-pantauan-state-"));
  try {
    const blocker = join(directory, "not-a-directory");
    writeFileSync(blocker, "blocker");
    const logs: string[] = [];
    const repository = openMonitorStateRepository(
      join(blocker, "monitor.sqlite"),
      new StructuredLogger("test", (line) => logs.push(line)),
    );

    expect(repository).toBeUndefined();
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0] ?? "{}")).toMatchObject({
      level: "error",
      event: "state.database.init_failed",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
