import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptRecord } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, "..", "schemas");

const linkSchema = JSON.parse(
  readFileSync(join(schemasDir, "link.v1.json"), "utf8"),
);
const recordSchema = JSON.parse(
  readFileSync(join(schemasDir, "record.v1.json"), "utf8"),
);

const Ajv2020 = Ajv2020Module.default;
const addFormats = addFormatsModule.default;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

ajv.addSchema(linkSchema);
const validateRecordSchema = ajv.compile(recordSchema);

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateRecord(record: PromptRecord): void {
  const valid = validateRecordSchema(record);
  if (!valid) {
    throw new ValidationError("Invalid record", validateRecordSchema.errors);
  }
}

export { validateRecordSchema };
