import { readFileSync } from "node:fs";
import { join } from "node:path";

const goldenDir = join(__dirname, "..", "..", "..", "..", "programs", "squads_multisig_program", "tests", "fixtures", "golden");

export type Fixture = { label: string; id: string; bytes: Uint8Array };

/** Parses `<label> <id> <hex>` lines of a golden fixture file. */
export function readFixtures(file: "accounts.txt" | "instructions.txt" | "v3_accounts.txt"): Fixture[] {
  return readFileSync(join(goldenDir, file), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [label = "", id = "", hex = ""] = line.split(/\s+/);
      return { label, id, bytes: Uint8Array.from(Buffer.from(hex, "hex")) };
    });
}

export const toHex = (bytes: ArrayLike<number>) => Buffer.from(Uint8Array.from(bytes)).toString("hex");
