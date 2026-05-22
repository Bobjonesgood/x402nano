import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_FILE = "data/production-lead-pack.starter.json";
const requiredFields = [
  "id",
  "businessName",
  "industry",
  "location",
  "estimatedJobValue",
  "buyingIntent",
  "painPoints",
  "recommendedOpener",
  "confidenceScore",
  "sourceType",
  "sourceUrls",
  "sourceEvidence",
  "reviewedAt"
];

function isFilledArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validateRecord(record, index) {
  if (!record || typeof record !== "object") {
    return `record ${index + 1} is not an object`;
  }

  for (const field of requiredFields) {
    const value = record[field];
    if (field === "painPoints" || field === "sourceUrls" || field === "sourceEvidence") {
      if (!isFilledArray(value)) return `record ${index + 1} ${field} must be a non-empty array`;
      continue;
    }

    if (value === undefined || value === "") return `record ${index + 1} is missing ${field}`;
  }

  if (typeof record.confidenceScore !== "number" || record.confidenceScore < 0 || record.confidenceScore > 100) {
    return `record ${index + 1} confidenceScore must be a number from 0 to 100`;
  }

  return "";
}

async function run() {
  const file = path.resolve(process.env.LEAD_PACK_FILE?.trim() || DEFAULT_FILE);
  const raw = await fs.readFile(file, "utf8");
  const records = JSON.parse(raw);

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("lead pack must be a non-empty JSON array");
  }

  const validationError = records.map(validateRecord).find(Boolean);
  if (validationError) {
    throw new Error(validationError);
  }

  console.log("Production lead pack validated.");
  console.log(`file: ${file}`);
  console.log(`records: ${records.length}`);
  console.log(`reviewed: ${records.map(record => record.reviewedAt).join(", ")}`);
  console.log("\nSet this Render environment value for PREMIUM_LEAD_PACK_JSON:\n");
  console.log(JSON.stringify(records));
}

run().catch(error => {
  console.error(`Lead pack preparation failed: ${error.message}`);
  process.exitCode = 1;
});
