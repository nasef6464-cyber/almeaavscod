const BASE = process.env.BASE_URL || "http://localhost:4000";

async function check(endpoint, label) {
  try {
    const res = await fetch(`${BASE}/api${endpoint}`);
    const ok = res.ok;
    const text = await res.text();
    console.log(`${ok ? "✅" : "❌"} ${label} (${res.status}): ${text.slice(0, 120)}`);
    return ok;
  } catch (e) {
    console.log(`❌ ${label}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(`\n🧪 Health Readiness Smoke Tests (base: ${BASE})\n`);
  const results = await Promise.all([
    check("/health", "GET /api/health"),
    check("/health/live", "GET /api/health/live"),
    check("/health/ready", "GET /api/health/ready"),
  ]);
  const passed = results.filter(Boolean).length;
  console.log(`\n${"-".repeat(40)}\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main();
