// Payment reconciliation
//
// Reads payments.jsonl and calculates total successful revenue.
// Run:  node reconcile.js

const fs = require("fs");
const readline = require("readline");

function parseAmount(val) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const num = parseFloat(val.replace(/,/g, "").trim());
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

async function reconcile() {
  const dataFile = "payments.jsonl";
  const expectedFile = "expected.txt";

  if (!fs.existsSync(dataFile) || !fs.existsSync(expectedFile)) {
    console.error("Missing payments.jsonl or expected.txt in current directory.");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(dataFile, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  // Track only the latest attempt for each transaction ID
  const latestByTxn = new Map();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let event;
    try {
      // Skips corrupt lines (e.g. invalid control characters or broken JSON)
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Ignore events without a txn_id
    if (!event || typeof event !== "object" || !event.txn_id) {
      continue;
    }

    // Only keep the attempt with the latest timestamp
    const existing = latestByTxn.get(event.txn_id);
    if (!existing || Date.parse(event.ts) > Date.parse(existing.ts)) {
      latestByTxn.set(event.txn_id, event);
    }
  }

  // Count and sum only successful latest attempts
  let count = 0;
  let total = 0;

  for (const event of latestByTxn.values()) {
    if (event.status === "success") {
      count += 1;
      total += parseAmount(event.amount);
    }
  }

  const expected = parseInt(fs.readFileSync(expectedFile, "utf8").trim(), 10);

  if (count !== expected) {
    console.log(`Check failed: counted ${count} successful payments, expected ${expected}.`);
    console.log("Something in the data isn't being handled the way the README describes.");
    process.exitCode = 1;
  } else {
    console.log(`Check passed: ${count} successful payments.`);
    console.log(`Your code: KOYA-${Math.round(total)}`);
  }
}

reconcile().catch((err) => {
  console.error("Unexpected error during reconciliation:", err.message || err);
  process.exit(1);
});
