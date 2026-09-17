import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type VersionBump = "major" | "minor" | "patch";

export interface PackageMetadata {
  name: string;
  version: string;
  [key: string]: unknown;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function bumpVersion(version: string, bump: VersionBump): string {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`versi tidak valid atau belum didukung: ${version}`);
  const numbers = match.slice(1).map(Number);
  const major = numbers[0] ?? 0;
  const minor = numbers[1] ?? 0;
  const patchNumber = numbers[2] ?? 0;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patchNumber + 1}`;
}

export async function readPackageJson(path: string): Promise<PackageMetadata> {
  const value = JSON.parse(await readFile(path, "utf8")) as PackageMetadata;
  if (typeof value.name !== "string" || typeof value.version !== "string") {
    throw new Error("package.json harus memiliki name dan version");
  }
  if (!SEMVER.test(value.version))
    throw new Error(`versi tidak valid atau belum didukung: ${value.version}`);
  return value;
}

export async function writePackageJson(path: string, metadata: PackageMetadata): Promise<void> {
  const temporaryPath = resolve(dirname(path), `.package.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function runVersionCommand(
  args: string[],
  packagePath = process.env.VERSION_PACKAGE_PATH ?? resolve(process.cwd(), "package.json"),
  output: (line: string) => void = console.log,
): Promise<void> {
  const command = args[0] ?? "show";
  const metadata = await readPackageJson(packagePath);
  if (command === "show") {
    output(`${metadata.name} ${metadata.version}`);
    return;
  }
  if (command === "dump") {
    output(JSON.stringify({ name: metadata.name, version: metadata.version }));
    return;
  }
  if (command === "bump") {
    const bump = args[1];
    if (bump !== "major" && bump !== "minor" && bump !== "patch") {
      throw new Error("bump harus major, minor, atau patch");
    }
    const next = bumpVersion(metadata.version, bump);
    await writePackageJson(packagePath, { ...metadata, version: next });
    output(`${metadata.version} → ${next}`);
    return;
  }
  throw new Error(`command version tidak dikenal: ${command}`);
}

if (import.meta.main) {
  try {
    await runVersionCommand(Bun.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
