import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";

const envPath = path.resolve(".env.mainnet.local");
const sellerAddress = "0x4cc3831eB479aCFb6D44631d4a30814508Cf52d3";

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  if (await fileExists(envPath)) {
    throw new Error(`${envPath} already exists. Refusing to replace a local buyer wallet.`);
  }

  const privateKey = `0x${crypto.randomBytes(32).toString("hex")}`;
  const account = privateKeyToAccount(privateKey);
  const content = [
    "# Local-only controlled Base mainnet x402 buyer wallet.",
    "# This file is ignored by Git. Do not paste the private key into chat.",
    `MAINNET_BUYER_PRIVATE_KEY=${privateKey}`,
    "BASE_MAINNET_RPC_URL=https://mainnet.base.org",
    "MAINNET_PAYMENT_ACK=",
    "MAINNET_MAX_USDC=0.05",
    `MAINNET_EXPECTED_SELLER_ADDRESS=${sellerAddress}`,
    ""
  ].join("\n");

  await fs.writeFile(envPath, content, { encoding: "utf8", mode: 0o600 });

  console.log("Fresh local mainnet buyer wallet created.");
  console.log(`address: ${account.address}`);
  console.log(`env file: ${envPath}`);
  console.log("Private key was written locally and was not printed.");
  console.log("Fund only this public address with the tiny amount needed for the first Base mainnet proof.");
}

run().catch(error => {
  console.error(`Mainnet buyer wallet setup failed: ${error.message}`);
  process.exitCode = 1;
});
