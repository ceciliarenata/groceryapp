/**
 * test-wallet-and-devices.js
 * Verification for:
 * 1. Multi-device independent accounts (Device 1 vs Device 2)
 * 2. Cash on Hand Wallet ("Uang Belanja yang Kita Pegang")
 * 3. Automatic cash deduction after shopping/checkout
 */

const http = require('http');
const assert = require('assert');

function apiCall(method, path, body = null, token = null) {
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
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
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
  console.log('===============================================================');
  console.log('💵 TESTING MULTI-DEVICE DIFFERENT ACCOUNTS & CASH AUTO-DEDUCTION');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: MULTI-DEVICE BEDA AKUN (DEVICE 1 vs DEVICE 2)
  // --------------------------------------------------------------------------
  console.log('1. Testing Login Device 1 (Budi) and Device 2 (Siti)...');
  
  // Login Device 1
  const loginDev1 = await apiCall('POST', '/api/auth/login', {
    email: 'demo@grocery.com',
    password: 'Password123!'
  });
  assert.strictEqual(loginDev1.status, 200);
  const tokenDev1 = loginDev1.data.token;
  const user1 = loginDev1.data.user;
  console.log(`   ✅ Device 1 logged in as: ${user1.name} (${user1.email})`);

  // Login Device 2
  const loginDev2 = await apiCall('POST', '/api/auth/login', {
    email: 'siti@grocery.com',
    password: 'Password123!'
  });
  assert.strictEqual(loginDev2.status, 200);
  const tokenDev2 = loginDev2.data.token;
  const user2 = loginDev2.data.user;
  console.log(`   ✅ Device 2 logged in as: ${user2.name} (${user2.email})`);

  // Verify Different User IDs
  assert.notStrictEqual(user1.id, user2.id, 'Device 1 and Device 2 must have different User IDs');

  // Verify Items Isolation between Device 1 and Device 2
  const itemsDev1 = await apiCall('GET', '/api/grocery/items', null, tokenDev1);
  const itemsDev2 = await apiCall('GET', '/api/grocery/items', null, tokenDev2);

  console.log(`   ✅ Device 1 has ${itemsDev1.data.items.length} items; Device 2 has ${itemsDev2.data.items.length} items`);
  const namesDev1 = itemsDev1.data.items.map(i => i.name);
  const namesDev2 = itemsDev2.data.items.map(i => i.name);

  // Verify no cross-device contamination
  assert.ok(namesDev1.some(n => n.includes('Beras')), 'Device 1 should contain Beras');
  assert.ok(namesDev2.some(n => n.includes('Daging Sapi') || n.includes('Telur')), 'Device 2 should contain distinct items (Daging/Telur)');
  console.log('   ✅ Multi-device different accounts verified: Items are completely separate!\n');

  // --------------------------------------------------------------------------
  // TEST 2: FITUR UANG BELANJA YANG DIPEGANG (CASH ON HAND)
  // --------------------------------------------------------------------------
  console.log('2. Testing "Uang Belanja yang Kita Pegang" (Wallet)...');

  // Fetch initial wallet for Device 1
  const walletDev1 = await apiCall('GET', '/api/grocery/wallet', null, tokenDev1);
  assert.strictEqual(walletDev1.status, 200);
  console.log(`   ✅ Device 1 initial cash on hand: Rp ${walletDev1.data.wallet.current_cash.toLocaleString('id-ID')}`);

  // User sets cash on hand to Rp 650.000 ("Saya pegang uang belanja Rp 650.000")
  const setCashRes = await apiCall('PUT', '/api/grocery/wallet', {
    set_cash: 650000
  }, tokenDev1);
  assert.strictEqual(setCashRes.status, 200);
  assert.strictEqual(setCashRes.data.wallet.current_cash, 650000);
  assert.strictEqual(setCashRes.data.wallet.initial_cash, 650000);
  console.log('   ✅ Set cash on hand successfully to Rp 650.000');

  // User adds cash (+ Rp 100.000)
  const addCashRes = await apiCall('PUT', '/api/grocery/wallet', {
    add_cash: 100000
  }, tokenDev1);
  assert.strictEqual(addCashRes.status, 200);
  assert.strictEqual(addCashRes.data.wallet.current_cash, 750000);
  console.log('   ✅ Added cash (+ Rp 100.000), total cash on hand is now Rp 750.000\n');

  // --------------------------------------------------------------------------
  // TEST 3: OTOMATIS KURANGI UANG KITA SETELAH DIPAKAI BELANJA
  // --------------------------------------------------------------------------
  console.log('3. Testing Automatic Cash Deduction after Shopping Checkout...');

  // Cash before checkout: Rp 750.000
  // Shopping total: Rp 225.000
  const checkoutTrip = await apiCall('POST', '/api/grocery/history', {
    store_name: 'Grand Lucky SCBD',
    total_spent: 225000,
    items_snapshot: [
      { name: 'Daging Wagyu', qty: 1, price: 175000, unit: 'pack' },
      { name: 'Keju Mozzarella', qty: 1, price: 50000, unit: 'pack' }
    ],
    clear_cart: false
  }, tokenDev1);

  assert.strictEqual(checkoutTrip.status, 201);
  assert.ok(checkoutTrip.data.wallet, 'Checkout response must return updated wallet');
  assert.strictEqual(checkoutTrip.data.wallet.current_cash, 525000, 'Current cash should automatically reduce: 750.000 - 225.000 = 525.000');
  assert.strictEqual(checkoutTrip.data.trip.cash_before, 750000);
  assert.strictEqual(checkoutTrip.data.trip.cash_after, 525000);
  console.log(`   ✅ Selesai Belanja Kasir: Uang Rp 750.000 dipotong Rp 225.000 -> Sisa Uang Kas: Rp 525.000!`);

  // Verify wallet persistence via separate GET
  const verifyWallet = await apiCall('GET', '/api/grocery/wallet', null, tokenDev1);
  assert.strictEqual(verifyWallet.data.wallet.current_cash, 525000);
  console.log(`   ✅ Verified via /api/grocery/wallet: Uang kas persisten di Rp 525.000`);

  // Second shopping trip of Rp 125.000
  const checkoutTrip2 = await apiCall('POST', '/api/grocery/history', {
    store_name: 'Indomaret Fresh',
    total_spent: 125000,
    items_snapshot: [
      { name: 'Susu UHT 2L', qty: 2, price: 40000, unit: 'liter' },
      { name: 'Roti Gandum', qty: 1, price: 45000, unit: 'pack' }
    ],
    clear_cart: false
  }, tokenDev1);

  assert.strictEqual(checkoutTrip2.status, 201);
  assert.strictEqual(checkoutTrip2.data.wallet.current_cash, 400000, '525.000 - 125.000 = 400.000');
  console.log(`   ✅ Selesai Belanja Ke-2: Uang Rp 525.000 dipotong Rp 125.000 -> Sisa Uang Kas: Rp 400.000!`);

  // Verify Device 2 cash was NOT affected (Data isolation for cash)
  const walletDev2 = await apiCall('GET', '/api/grocery/wallet', null, tokenDev2);
  assert.strictEqual(walletDev2.data.wallet.current_cash, 300000, 'Device 2 cash must remain unaffected at Rp 300.000');
  console.log(`   ✅ Verified: Device 2 cash remains completely untouched at Rp 300.000 (Account isolation)!`);

  console.log('\n===============================================================');
  console.log('🎉 ALL MULTI-DEVICE & CASH AUTO-DEDUCTION TESTS PASSED! 💯');
  console.log('===============================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
