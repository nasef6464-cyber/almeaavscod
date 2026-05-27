const BASE = process.env.BASE_URL || "http://localhost:4000";

async function check(label, fn) {
  try {
    await fn();
    console.log(`✅ ${label}`);
    return true;
  } catch (e) {
    console.log(`❌ ${label}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(`\n🛡️ Production Hardening Smoke Tests (base: ${BASE})\n`);

  const results = await Promise.all([
    check("CORS headers present", async () => {
      const res = await fetch(`${BASE}/api/health`, { headers: { Origin: "https://almeaavscod.vercel.app" } });
      if (!res.headers.get("access-control-allow-origin")) throw new Error("Missing CORS header");
    }),

    check("Security headers present (helmet)", async () => {
      const res = await fetch(`${BASE}/api/health`);
      if (!res.headers.get("x-content-type-options")) throw new Error("Missing X-Content-Type-Options");
    }),

    check("JSON parsing rejects invalid body", async () => {
      const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" });
      if (res.status !== 400 && res.status !== 413) throw new Error(`Unexpected status: ${res.status}`);
    }),

    check("Unknown route returns 404 JSON", async () => {
      const res = await fetch(`${BASE}/api/nonexistent-route-12345`);
      const json = await res.json();
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      if (!json.error && !json.message) throw new Error("Expected error/message in body");
    }),

    check("Health endpoint returns 200", async () => {
      const res = await fetch(`${BASE}/api/health`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
    }),
  ]);

  const passed = results.filter(Boolean).length;
  console.log(`\n${"-".repeat(40)}\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main();
