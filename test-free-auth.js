// test-free-auth.js - Verify free username, free password, auto_create, and no HTML errors
const http = require('http');
const assert = require('assert');

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          rawText: data
        });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('===============================================================');
  console.log('🧪 TESTING FREE USERNAME, FREE PASSWORD & JSON RESPONSE SAFETY');
  console.log('===============================================================\n');

  // Test 1: Register with completely free username (no email format) and short password (e.g. "123")
  const freeUsername = `user_${Date.now()}`;
  console.log(`1. Testing registration with free username "${freeUsername}" & short password "123"...`);
  const regRes = await apiRequest('POST', '/api/auth/register', {
    name: 'Pengguna Bebas',
    email: freeUsername, // No @, no domain
    password: '123'      // Only 3 characters!
  });
  assert.strictEqual(regRes.status, 201, 'Registration should succeed with HTTP 201');
  assert.ok(regRes.data.token, 'Must return token');
  console.log('   ✅ Registrasi bebas berhasil! Token:', regRes.data.token.substring(0, 15) + '...');

  // Test 2: Login with free username and short password
  console.log('\n2. Testing login with free username & short password "123"...');
  const loginRes = await apiRequest('POST', '/api/auth/login', {
    email: freeUsername,
    password: '123'
  });
  assert.strictEqual(loginRes.status, 200, 'Login should succeed with HTTP 200');
  assert.ok(loginRes.data.token, 'Must return token');
  console.log('   ✅ Login bebas berhasil! User:', loginRes.data.user.name);

  // Test 3: Wrong password returns clean JSON 401, not HTML
  console.log('\n3. Testing wrong password error response...');
  const badLogin = await apiRequest('POST', '/api/auth/login', {
    email: freeUsername,
    password: 'wrong'
  });
  assert.strictEqual(badLogin.status, 401, 'Should return HTTP 401');
  assert.ok(badLogin.headers['content-type'].includes('application/json'), 'Content-type must be JSON');
  assert.ok(badLogin.data && badLogin.data.error, 'Must have JSON error message');
  console.log('   ✅ Wrong password returned clean JSON 401:', badLogin.data.error);

  // Test 4: Auto-create account during login (seamless 1-click access)
  const autoUser = `auto_${Date.now()}`;
  console.log(`\n4. Testing auto-create login with new user "${autoUser}" & password "a"...`);
  const autoRes = await apiRequest('POST', '/api/auth/login', {
    email: autoUser,
    password: 'a',
    auto_create: true
  });
  assert.strictEqual(autoRes.status, 200, 'Auto create login should succeed with HTTP 200');
  assert.ok(autoRes.data.token, 'Must return token');
  console.log('   ✅ Auto-create login berhasil! User dibuat otomatis:', autoRes.data.user.name);

  // Test 5: Verify unmatched API endpoints return JSON 404, NEVER HTML
  console.log('\n5. Testing unmatched API route response (checking for NO HTML error)...');
  const notFoundApi = await apiRequest('GET', '/api/unmatched/endpoint');
  assert.strictEqual(notFoundApi.status, 404, 'Should return HTTP 404');
  assert.ok(notFoundApi.headers['content-type'].includes('application/json'), 'Content-type must be JSON');
  assert.strictEqual(notFoundApi.rawText.startsWith('<'), false, 'Response must NOT start with HTML "<"');
  assert.ok(notFoundApi.data && notFoundApi.data.error, 'Must return JSON error object');
  console.log('   ✅ Unmatched API route returned clean JSON 404, no HTML:', notFoundApi.data.error);

  console.log('\n===============================================================');
  console.log('🎉 ALL FREE AUTH & JSON ERROR SAFETY TESTS PASSED! 💯');
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
