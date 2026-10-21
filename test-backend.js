/**
 * test-backend.js - Automated Verification for Smart Grocery Backend API
 */
const http = require('http');
const assert = require('assert');

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
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Automated Backend Verification...\n');

  // 1. Test Demo Login
  console.log('1. Testing Login with Demo Account...');
  const loginRes = await apiRequest('POST', '/api/auth/login', {
    email: 'demo@grocery.com',
    password: 'Password123!'
  });
  assert.strictEqual(loginRes.status, 200, 'Login demo must return HTTP 200');
  assert.ok(loginRes.data.token, 'Login must return an auth token');
  const demoToken = loginRes.data.token;
  console.log('   ✅ Demo Login Success! Token:', demoToken.substring(0, 15) + '...');

  // 2. Test Failed Login
  console.log('2. Testing Login with Incorrect Password...');
  const badLogin = await apiRequest('POST', '/api/auth/login', {
    email: 'demo@grocery.com',
    password: 'WrongPassword999!'
  });
  assert.strictEqual(badLogin.status, 401, 'Wrong password must return HTTP 401');
  console.log('   ✅ Wrong password correctly rejected (401)');

  // 3. Test Protected Route without Token
  console.log('3. Testing Route Protection (Unauthorized Access)...');
  const unauthRes = await apiRequest('GET', '/api/grocery/items');
  assert.strictEqual(unauthRes.status, 401, 'Accessing items without token must return HTTP 401');
  console.log('   ✅ Route protection active: Unauthenticated access blocked (401)');

  // 4. Test Fetch Items with Demo Token
  console.log('4. Testing Fetch Items for Authenticated User...');
  const itemsRes = await apiRequest('GET', '/api/grocery/items', null, demoToken);
  assert.strictEqual(itemsRes.status, 200);
  assert.ok(Array.isArray(itemsRes.data.items), 'Items should be an array');
  assert.ok(itemsRes.data.items.length >= 6, 'Seed items must be present');
  console.log(`   ✅ Successfully fetched ${itemsRes.data.items.length} grocery items for Demo user`);

  // 5. Test Add Item
  console.log('5. Testing Add Item...');
  const addRes = await apiRequest('POST', '/api/grocery/items', {
    name: 'Beras Pandan Wangi 5 kg',
    category: 'Fruits & Vegetables',
    quantity: 1,
    unit: 'pack',
    price: 85000,
    is_purchased: false,
    notes: 'Aroma wangi pandan asli'
  }, demoToken);
  assert.strictEqual(addRes.status, 201);
  assert.strictEqual(addRes.data.item.name, 'Beras Pandan Wangi 5 kg');
  const createdItemId = addRes.data.item.id;
  console.log('   ✅ Item successfully added! ID:', createdItemId);

  // 6. Test Edit Item & Mark Purchased
  console.log('6. Testing Edit Item & Mark Purchased...');
  const editRes = await apiRequest('PUT', `/api/grocery/items/${createdItemId}`, {
    is_purchased: true,
    price: 84000
  }, demoToken);
  assert.strictEqual(editRes.status, 200);
  assert.strictEqual(editRes.data.item.is_purchased, true);
  assert.strictEqual(editRes.data.item.price, 84000);
  console.log('   ✅ Item successfully edited and marked as purchased!');

  // 7. Test Multi-Device / User Isolation
  console.log('7. Testing Multi-Tenant Data Isolation (User A vs User B)...');
  const userBEmail = 'testuser_' + Date.now() + '@grocery.com';
  const registerB = await apiRequest('POST', '/api/auth/register', {
    name: 'User B Testing',
    email: userBEmail,
    password: 'PasswordUserB123!'
  });
  assert.strictEqual(registerB.status, 201);
  const tokenB = registerB.data.token;

  const itemsUserB = await apiRequest('GET', '/api/grocery/items', null, tokenB);
  assert.strictEqual(itemsUserB.status, 200);
  assert.strictEqual(itemsUserB.data.items.length, 0, 'New user B must have 0 items (data strictly isolated from User A)');
  console.log('   ✅ Data isolation verified! User B cannot see any of Demo User items.');

  // 8. Test Budget Setting
  console.log('8. Testing Budget Management...');
  const budgetRes = await apiRequest('GET', '/api/grocery/budget', null, demoToken);
  assert.strictEqual(budgetRes.status, 200);
  const updateBudget = await apiRequest('PUT', '/api/grocery/budget', { budget_limit: 600000 }, demoToken);
  assert.strictEqual(updateBudget.status, 200);
  assert.strictEqual(updateBudget.data.budget.budget_limit, 600000);
  console.log('   ✅ Budget settings verified & updated to Rp 600.000');

  // 9. Test Delete Item
  console.log('9. Testing Delete Item...');
  const deleteRes = await apiRequest('DELETE', `/api/grocery/items/${createdItemId}`, null, demoToken);
  assert.strictEqual(deleteRes.status, 200);
  console.log('   ✅ Item successfully deleted!');

  console.log('\n🎉 ALL 9 BACKEND API & SECURITY TESTS PASSED PERFECTLY!\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}
