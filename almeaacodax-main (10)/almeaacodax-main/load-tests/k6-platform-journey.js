import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

export const errorRate = new Rate("platform_error_rate");
export const quizSubmitTime = new Trend("quiz_submit_time");

const API_BASE = (__ENV.API_BASE || "http://127.0.0.1:10000/api").replace(/\/$/, "");
const STUDENT_EMAIL = __ENV.STUDENT_EMAIL || "";
const STUDENT_PASSWORD = __ENV.STUDENT_PASSWORD || "";
const QUIZ_ID = __ENV.QUIZ_ID || "";
const QUIZ_SOURCE = __ENV.QUIZ_SOURCE || "training";

export const options = {
  scenarios: {
    pilot_100: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "20s",
    },
    scale_500: {
      executor: "ramping-vus",
      startTime: "2m15s",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 200 },
        { duration: "2m", target: 500 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
    scale_1000: {
      executor: "ramping-vus",
      startTime: "6m45s",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 500 },
        { duration: "2m", target: 1000 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "45s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    platform_error_rate: ["rate<0.02"],
    quiz_submit_time: ["p(95)<2000"],
  },
};

function mark(response, label) {
  const ok = check(response, {
    [`${label}: status is 2xx/3xx`]: (res) => res.status >= 200 && res.status < 400,
  });
  errorRate.add(!ok);
  return ok;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

function login() {
  if (!STUDENT_EMAIL || !STUDENT_PASSWORD) return "";

  const response = http.post(
    `${API_BASE}/auth/login`,
    JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
    { headers: authHeaders("") },
  );
  mark(response, "login");

  try {
    return response.json("token") || "";
  } catch (_error) {
    return "";
  }
}

export default function () {
  let token = "";

  group("health and bootstrap", () => {
    mark(http.get(`${API_BASE}/health`), "health");
    mark(http.get(`${API_BASE}/content/bootstrap`), "content bootstrap");
    mark(http.get(`${API_BASE}/taxonomy/bootstrap`), "taxonomy bootstrap");
  });

  group("learner authenticated journey", () => {
    token = login();
    if (!token) return;

    mark(http.get(`${API_BASE}/auth/me`, { headers: authHeaders(token) }), "me");
    mark(http.get(`${API_BASE}/quizzes/results`, { headers: authHeaders(token) }), "student results");
  });

  group("optional quiz submit", () => {
    if (!token || !QUIZ_ID) return;

    const started = Date.now();
    const response = http.post(
      `${API_BASE}/quizzes/${QUIZ_ID}/submit`,
      JSON.stringify({ answers: {}, timeSpentSeconds: 60, source: QUIZ_SOURCE }),
      { headers: authHeaders(token) },
    );
    quizSubmitTime.add(Date.now() - started);
    mark(response, "quiz submit");
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    "load-tests/results/k6-platform-summary.json": JSON.stringify(data, null, 2),
    stdout: [
      "k6 platform journey finished.",
      `API_BASE=${API_BASE}`,
      "Review load-tests/results/k6-platform-summary.json and Render/MongoDB metrics before increasing traffic.",
      "",
    ].join("\n"),
  };
}
