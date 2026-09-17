import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bumpVersion, runVersionCommand } from "../../scripts/version.js";

test("version bump major minor patch", () => {
  expect(bumpVersion("0.1.0", "patch")).toBe("0.1.1");
  expect(bumpVersion("0.1.9", "minor")).toBe("0.2.0");
  expect(bumpVersion("0.1.9", "major")).toBe("1.0.0");
});

test("version command dump dan bump tidak menyentuh package repository", async () => {
  const directory = await mkdtemp(join(tmpdir(), "air-version-test-"));
  const path = join(directory, "package.json");
  await writeFile(
    path,
    JSON.stringify({ name: "fixture", version: "0.1.0", private: true }, null, 2),
  );
  const output: string[] = [];
  await runVersionCommand(["dump"], path, (line) => output.push(line));
  expect(output[0]).toBe('{"name":"fixture","version":"0.1.0"}');
  await runVersionCommand(["bump", "patch"], path, (line) => output.push(line));
  const result = JSON.parse(await readFile(path, "utf8")) as {
    name: string;
    version: string;
    private: boolean;
  };
  expect(result).toEqual({ name: "fixture", version: "0.1.1", private: true });
  await rm(directory, { recursive: true, force: true });
});
