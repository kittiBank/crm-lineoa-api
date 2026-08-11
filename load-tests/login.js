import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke load test: POST /api/v1/auth/login — 30 requests total
//
// Prerequisites:
//   brew install k6
//   pnpm run obs:up          # Grafana http://localhost:3030 (admin/admin)
//   pnpm run start:dev       # API must be running
//   pnpm run db:seed         # seed user user@example.com / 123456
//
// Run:
//   pnpm run loadtest:login
//   BASE_URL=http://localhost:3001 k6 run load-tests/login.js
//
// Grafana: CRM Monitor dashboard → API RPS, p95 latency, error rate

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL || 'user@example.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || '123456';

export const options = {
  scenarios: {
    login: {
      executor: 'shared-iterations',
      vus: 5, // concurrent users
      iterations: 50, // total requests
      maxDuration: '1m', // max duration of the test
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95th percentile of response time
    http_req_failed: ['rate<0.05'], // failure rate
    checks: ['rate>0.95'], // success rate
  },
};

export default function () {
  const payload = JSON.stringify({
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, params);

  check(res, {
    'login status 200': (r) => r.status === 200,
    'has accessToken': (r) => {
      try {
        return Boolean(JSON.parse(r.body).accessToken);
      } catch {
        return false;
      }
    },
  });

  sleep(0.3);
}
