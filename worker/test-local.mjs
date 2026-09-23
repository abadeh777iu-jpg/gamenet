// تست محلی Worker با شبیه‌سازی Request/Response (Node 20 fetch API)
import worker from './src/index.js';
import { readFileSync } from 'fs';

process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || readFileSync('.dev.vars','utf8').match(/GITHUB_TOKEN=(.*)/)[1].trim();
process.env.GITHUB_REPO = process.env.GITHUB_REPO || 'abadeh777iu-jpg/gamenet';
process.env.GITHUB_BRANCH = 'main';
process.env.ALLOWED_ORIGINS = 'http://localhost';

const env = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_REPO: process.env.GITHUB_REPO,
  GITHUB_BRANCH: process.env.GITHUB_BRANCH,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
};

async function call(method, path, body, auth) {
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost' };
  if (auth) headers.Authorization = 'Bearer ' + auth;
  const req = new Request('https://worker.test' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const email = `test${Date.now()}@example.com`;
const pass = 'test1234';

console.log('1) health', await call('GET', '/api/health'));

console.log('2) register', await call('POST', '/api/register', {
  clubName: 'باشگاه تست', ownerName: 'تست', email, phone: '0912', password: pass,
}));

const login = await call('POST', '/api/login', { email, password: pass });
console.log('3) login', login.status, login.data?.user?.email, 'token?', !!login.data?.token);

const tok = login.data?.token;
const uid = login.data?.user?.id;

console.log('4) push', await call('POST', '/api/push', {
  values: { [`gn_${uid}_tables`]: JSON.stringify([{ id: 1, name: 'میز ۱' }]), gc_theme: 'purple' },
}, tok));

console.log('5) pull', await call('GET', '/api/pull', null, tok));

console.log('6) bootstrap', await call('GET', '/api/bootstrap', null, tok));

console.log('7) bad login', await call('POST', '/api/login', { email, password: 'wrong' }));

console.log('8) no auth push', await call('POST', '/api/push', { values: { gc_theme: 'x' } }));

// isolation check: second user shouldn't see first user's gn_ keys
const email2 = `test2${Date.now()}@example.com`;
await call('POST', '/api/register', { clubName: 'دوم', ownerName: 'دوم', email: email2, phone: '', password: pass });
const login2 = await call('POST', '/api/login', { email: email2, password: pass });
const boot2 = await call('GET', '/api/bootstrap', null, login2.data.token);
const keys2 = Object.keys(boot2.data.values || {});
console.log('9) isolation — user2 keys:', keys2, 'should NOT include', `gn_${uid}_tables`);
const leak = keys2.some(k => k.startsWith('gn_' + uid + '_'));
console.log('   LEAK?' , leak ? 'FAIL' : 'PASS');

console.log('DONE');
