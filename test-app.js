/**
 * test-app.js
 * Comprehensive automated unit, integration, and security test suite for Smart Grocery Tracker
 */

const http = require('http');
const assert = require('assert');
const crypto = require('crypto');

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function testStaticEndpoint(path, expectedStatus, expectedType) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          assert.strictEqual(res.statusCode, expectedStatus, `Status for ${path} should be ${expectedStatus}`);
          if (expectedType) {
            assert.ok(
              res.headers['content-type'].includes(expectedType),
              `Content-Type for ${path} should include ${expectedType}, got ${res.headers['content-type']}`
            );
          }
          console.log(`   ✅ [HTTP 200] ${path} (${res.headers['content-type']}) - Size: ${data.length} bytes`);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🛒 SMART GROCERY TRACKER - COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: STATIC ASSETS & PWA VALIDATION
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: STATIC ASSETS & PWA SERVING ---');
  await testStaticEndpoint('/', 200, 'text/html');
  await testStaticEndpoint('/index.html', 200, 'text/html');
  await testStaticEndpoint('/css/style.css', 200, 'text/css');
  await testStaticEndpoint('/js/app.js', 200, 'application/javascript');
  await testStaticEndpoint('/manifest.json', 200, 'application/json');
  await testStaticEndpoint('/sw.js', 200, 'application/javascript');
  console.log('✅ All static assets & PWA files served properly.\n');

  // --------------------------------------------------------------------------
  // SECTION 2: AUTHENTICATION & SECURITY TESTS
  // --------------------------------------------------------------------------
  console.log('--- SECTION 2: AUTHENTICATION & SECURITY TESTS ---');

  // 2.1 Demo Login
  const loginDemo = await apiRequest('POST', '/api/auth/login', {
    email: 'demo@grocery.com',
    password: 'Password123!'
  });
  assert.strictEqual(loginDemo.status, 200, 'Demo login should succeed');
  assert.ok(loginDemo.data.token, 'Demo login must return token');
  const demoToken = loginDemo.data.token;
  console.log('   ✅ 2.1 Demo Login success! User:', loginDemo.data.user.name);

  // 2.2 Wrong password rejection
  const badLogin = await apiRequest('POST', '/api/auth/login', {
    email: 'demo@grocery.com',
    password: 'IncorrectPassword'
  });
  assert.strictEqual(badLogin.status, 401, 'Invalid password must return 401');
  console.log('   ✅ 2.2 Wrong password rejected (HTTP 401)');

  // 2.3 Route protection (Unauthorized request)
  const unauthReq = await apiRequest('GET', '/api/grocery/items');
  assert.strictEqual(unauthReq.status, 401, 'Protected route without token must return 401');
  console.log('   ✅ 2.3 Route protection verified: Unauthorized access blocked (HTTP 401)');

  // 2.4 New User Registration
  const testEmail = `user_${Date.now()}@grocery.com`;
  const regRes = await apiRequest('POST', '/api/auth/register', {
    name: 'Siti Rahmawati',
    email: testEmail,
    password: 'SecurePassword2026!'
  });
  assert.strictEqual(regRes.status, 201, 'Registration should return 201');
  assert.ok(regRes.data.token, 'Registration must return session token');
  const userToken = regRes.data.token;
  console.log('   ✅ 2.4 New user registration success! Email:', testEmail);

  // 2.5 Duplicate email rejection
  const dupReg = await apiRequest('POST', '/api/auth/register', {
    name: 'Duplicate Siti',
    email: testEmail,
    password: 'AnotherPassword!'
  });
  assert.strictEqual(dupReg.status, 409, 'Duplicate email registration must return 409 Conflict');
  console.log('   ✅ 2.5 Duplicate email registration blocked (HTTP 409)');

  // 2.6 Verify /api/auth/me
  const meRes = await apiRequest('GET', '/api/auth/me', null, userToken);
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.data.user.email, testEmail);
  console.log('   ✅ 2.6 Session token validated via /api/auth/me');

  // --------------------------------------------------------------------------
  // SECTION 3: GROCERY ITEMS CRUD & CALCULATION TESTS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: GROCERY ITEMS CRUD & CALCULATIONS ---');

  // 3.1 Add Items
  const item1 = await apiRequest('POST', '/api/grocery/items', {
    name: 'Apel Royal Gala 1 kg',
    category: 'Fruits & Vegetables',
    quantity: 2,
    unit: 'kg',
    price: 45000,
    is_purchased: false,
    notes: 'Segar dan manis'
  }, userToken);
  assert.strictEqual(item1.status, 201);
  const itemId1 = item1.data.item.id;
  assert.strictEqual(item1.data.item.quantity * item1.data.item.price, 90000);
  console.log('   ✅ 3.1 Item 1 added: Apel Royal Gala (2 kg × Rp 45.000 = Rp 90.000)');

  const item2 = await apiRequest('POST', '/api/grocery/items', {
    name: 'Susu UHT Cokelat 1L',
    category: 'Dairy & Eggs',
    quantity: 3,
    unit: 'liter',
    price: 20000,
    is_purchased: false,
    notes: ''
  }, userToken);
  assert.strictEqual(item2.status, 201);
  const itemId2 = item2.data.item.id;
  console.log('   ✅ 3.2 Item 2 added: Susu UHT Cokelat (3 L × Rp 20.000 = Rp 60.000)');

  // 3.2 Fetch Items
  const itemsList = await apiRequest('GET', '/api/grocery/items', null, userToken);
  assert.strictEqual(itemsList.status, 200);
  assert.strictEqual(itemsList.data.items.length, 2);
  console.log('   ✅ 3.3 List items retrieved successfully (Count: 2)');

  // 3.3 Edit Item & Mark Purchased
  const editRes = await apiRequest('PUT', `/api/grocery/items/${itemId1}`, {
    quantity: 3,
    is_purchased: true
  }, userToken);
  assert.strictEqual(editRes.status, 200);
  assert.strictEqual(editRes.data.item.quantity, 3);
  assert.strictEqual(editRes.data.item.is_purchased, true);
  console.log('   ✅ 3.4 Item edited & marked purchased! New subtotal: 3 × Rp 45.000 = Rp 135.000');

  // 3.4 Delete Item
  const delRes = await apiRequest('DELETE', `/api/grocery/items/${itemId2}`, null, userToken);
  assert.strictEqual(delRes.status, 200);
  const itemsAfterDel = await apiRequest('GET', '/api/grocery/items', null, userToken);
  assert.strictEqual(itemsAfterDel.data.items.length, 1);
  console.log('   ✅ 3.5 Item deleted successfully (Remaining: 1)');

  // --------------------------------------------------------------------------
  // SECTION 4: MULTI-TENANT ISOLATION & MULTI-DEVICE PERSISTENCE
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: MULTI-TENANT DATA ISOLATION ---');

  // Register User C
  const emailUserC = `userc_${Date.now()}@grocery.com`;
  const regC = await apiRequest('POST', '/api/auth/register', {
    name: 'User C Isolation',
    email: emailUserC,
    password: 'PasswordUserC123!'
  });
  const tokenC = regC.data.token;

  // Verify User C has 0 items and cannot see Siti's items
  const itemsC = await apiRequest('GET', '/api/grocery/items', null, tokenC);
  assert.strictEqual(itemsC.data.items.length, 0, 'User C should not have any items');

  // Try to edit Siti's item using User C's token (Should be rejected 404/Forbidden)
  const maliciousEdit = await apiRequest('PUT', `/api/grocery/items/${itemId1}`, {
    name: 'Hacked Item'
  }, tokenC);
  assert.strictEqual(maliciousEdit.status, 404, 'User C cannot modify User Siti item');
  console.log('   ✅ 4.1 Data Isolation Verified: User C cannot view or edit User Siti items');

  // --------------------------------------------------------------------------
  // SECTION 5: BUDGET SETTINGS & THRESHOLDS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 5: BUDGET MANAGEMENT & ZONE THRESHOLDS ---');

  const budgetUpdate = await apiRequest('PUT', '/api/grocery/budget', {
    budget_limit: 750000,
    alert_caution_percent: 75,
    alert_danger_percent: 90
  }, userToken);
  assert.strictEqual(budgetUpdate.status, 200);
  assert.strictEqual(budgetUpdate.data.budget.budget_limit, 750000);
  console.log('   ✅ 5.1 Budget limit successfully updated to Rp 750.000');

  // --------------------------------------------------------------------------
  // SECTION 6: SHOPPING HISTORY & CHECKOUT
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 6: SHOPPING HISTORY & CHECKOUT ---');

  const checkoutRes = await apiRequest('POST', '/api/grocery/history', {
    store_name: 'Hypermart Karawaci',
    total_spent: 135000,
    items_snapshot: [
      { name: 'Apel Royal Gala 1 kg', qty: 3, unit: 'kg', price: 45000 }
    ],
    clear_cart: true
  }, userToken);
  assert.strictEqual(checkoutRes.status, 201);
  assert.strictEqual(checkoutRes.data.trip.store_name, 'Hypermart Karawaci');
  assert.strictEqual(checkoutRes.data.trip.total_spent, 135000);
  console.log('   ✅ 6.1 Checkout archived successfully into shopping history!');

  // Verify Cart is cleared
  const cartAfterCheckout = await apiRequest('GET', '/api/grocery/items', null, userToken);
  assert.strictEqual(cartAfterCheckout.data.items.length, 0);
  console.log('   ✅ 6.2 Cart cleared after checkout completed');

  // Verify History list
  const historyList = await apiRequest('GET', '/api/grocery/history', null, userToken);
  assert.strictEqual(historyList.status, 200);
  assert.strictEqual(historyList.data.history.length, 1);
  console.log('   ✅ 6.3 Shopping history retrieved and verified');

  console.log('\n===============================================================');
  console.log('🎉 ALL AUTOMATED UNIT, INTEGRATION, & SECURITY TESTS PASSED! 💯');
  console.log('===============================================================\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
