const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const namespace = "demo-arina18-rules-default-rtdb";
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/, "Rules tests require a local emulator");
const base = `http://${host}`;
const tokenA = "0123456789abcdef0123456789abcdef";
const tokenB = "fedcba9876543210fedcba9876543210";

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}.json?ns=${namespace}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let value = text;
  try { value = JSON.parse(text); } catch {}
  return { status: response.status, ok: response.ok, value };
}

const results = [];
async function allowed(name, path, options, expectedValue) {
  const result = await request(path, options);
  assert.equal(result.ok, true, `${name}: expected allow, got ${result.status} ${JSON.stringify(result.value)}`);
  if (arguments.length === 4) assert.deepEqual(result.value, expectedValue, `${name}: wrong value`);
  results.push({ name, verdict: "allow", status: result.status });
  return result;
}

async function denied(name, path, options) {
  const result = await request(path, options);
  assert.equal(result.ok, false, `${name}: expected deny, got ${result.status} ${JSON.stringify(result.value)}`);
  results.push({ name, verdict: "deny", status: result.status });
  return result;
}

async function main() {
  await allowed("public taken read", "/taken", {}, null);

  await denied("orphan key create", "/keys/g1", { method: "PUT", body: tokenA });
  await denied("orphan taken create", "/taken/g1", { method: "PUT", body: true });
  await denied("false is not a reservation", "/", {
    method: "PATCH",
    body: { "taken/g1": false, "keys/g1": tokenA },
  });
  await denied("invalid token is rejected", "/", {
    method: "PATCH",
    body: { "taken/g1": true, "keys/g1": "too-short" },
  });
  await denied("unknown gift id is rejected", "/", {
    method: "PATCH",
    body: { "taken/g9": true, "keys/g9": tokenA },
  });

  await allowed("atomic booking", "/", {
    method: "PATCH",
    body: { "taken/g1": true, "keys/g1": tokenA },
  });
  await allowed("taken status remains public", "/taken/g1", {}, true);
  await denied("booked key remains private", "/keys/g1", {});
  await denied("root read cannot expose private keys", "/", {});

  await allowed("same-token root PATCH replay", "/", {
    method: "PATCH",
    body: { "taken/g1": true, "keys/g1": tokenA },
  });
  await allowed("same-token key PUT replay", "/keys/g1", { method: "PUT", body: tokenA });
  await denied("different-token owner overwrite", "/", {
    method: "PATCH",
    body: { "taken/g1": true, "keys/g1": tokenB },
  });
  await denied("foreign cancellation marker", "/keys/g1", {
    method: "PUT",
    body: `CANCEL:${tokenB}`,
  });

  await allowed("owner cancellation marker", "/keys/g1", {
    method: "PUT",
    body: `CANCEL:${tokenA}`,
  });
  await allowed("same cancellation marker replay", "/keys/g1", {
    method: "PUT",
    body: `CANCEL:${tokenA}`,
  });
  await denied("one-sided taken delete", "/taken/g1", { method: "DELETE" });
  await allowed("paired release after CANCEL", "/", {
    method: "PATCH",
    body: { "taken/g1": null, "keys/g1": null },
  });
  await allowed("release replay after lost response", "/", {
    method: "PATCH",
    body: { "taken/g1": null, "keys/g1": null },
  });

  await allowed("second gift atomic booking", "/", {
    method: "PATCH",
    body: { "taken/g2": true, "keys/g2": tokenB },
  });
  await denied("one-sided ordinary key delete", "/keys/g2", { method: "DELETE" });
  await denied("one-sided ordinary taken delete", "/taken/g2", { method: "DELETE" });
  await denied("paired release requires CANCEL marker", "/", {
    method: "PATCH",
    body: { "taken/g2": null, "keys/g2": null },
  });
  await allowed("second gift owner marker", "/keys/g2", {
    method: "PUT",
    body: `CANCEL:${tokenB}`,
  });
  await allowed("second gift paired release", "/", {
    method: "PATCH",
    body: { "taken/g2": null, "keys/g2": null },
  });

  const [raceA, raceB] = await Promise.all([
    request("/", { method: "PATCH", body: { "taken/g3": true, "keys/g3": tokenA } }),
    request("/", { method: "PATCH", body: { "taken/g3": true, "keys/g3": tokenB } }),
  ]);
  assert.deepEqual(
    [raceA.ok, raceB.ok].sort(),
    [false, true],
    `concurrent owners: expected exactly one winner, got ${raceA.status}/${raceB.status}`,
  );
  results.push({
    name: "concurrent owners have exactly one winner",
    verdict: "one allow, one deny",
    status: `${raceA.status}/${raceB.status}`,
  });
  const raceWinner = raceA.ok ? tokenA : tokenB;
  await allowed("race winner can mark cancellation", "/keys/g3", {
    method: "PUT",
    body: `CANCEL:${raceWinner}`,
  });
  await allowed("race winner can release", "/", {
    method: "PATCH",
    body: { "taken/g3": null, "keys/g3": null },
  });
  await allowed("database returns to empty public state", "/taken", {}, null);

  const report = { passed: results.length, results };
  fs.writeFileSync(path.join(__dirname, "emulator-results.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
