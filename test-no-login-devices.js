// test-no-login-devices.js - Verify zero login required & 100% distinct data per device
const http = require('http');
const assert = require('assert');

function apiRequest(method, path, body = null, deviceId = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (deviceId) headers['X-Device-Id'] = deviceId;
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
  console.log('📱 TESTING ZERO-LOGIN ARCHITECTURE & STRICT PER-DEVICE ISOLATION');
  console.log('===============================================================\n');

  const devLaptop = `dev_laptop_${Date.now()}`;
  const devPhone = `dev_phone_${Date.now()}`;

  // 1. Device 1 (Laptop) connects directly without any login credentials
  console.log(`1. Device 1 (${devLaptop}) accessing grocery items without login...`);
  const lapItemsInit = await apiRequest('GET', '/api/grocery/items', null, devLaptop);
  assert.strictEqual(lapItemsInit.status, 200, 'Device 1 must access items with HTTP 200 without login');
  console.log('   ✅ Device 1 terhubung langsung tanpa login! Items count:', lapItemsInit.data.items.length);

  // Device 1 sets wallet cash on hand to Rp 700.000
  console.log('   💵 Device 1 menyetel uang kas dipegang menjadi Rp 700.000...');
  const lapWalletSet = await apiRequest('PUT', '/api/grocery/wallet', { action: 'set_cash', amount: 700000 }, devLaptop);
  assert.strictEqual(lapWalletSet.status, 200);
  assert.strictEqual(lapWalletSet.data.wallet.current_cash, 700000);
  console.log('   ✅ Device 1 uang kas tersimpan:', lapWalletSet.data.wallet.current_cash);

  // Device 1 adds "Minyak Goreng 2 Liter" (Rp 38.000)
  const lapAddItem = await apiRequest('POST', '/api/grocery/items', {
    name: 'Minyak Goreng 2 Liter',
    category: 'Household',
    quantity: 1,
    unit: 'pouch',
    price: 38000
  }, devLaptop);
  assert.strictEqual(lapAddItem.status, 201);
  console.log('   ✅ Device 1 menambahkan barang: Minyak Goreng 2 Liter (Rp 38.000)');

  // 2. Device 2 (Phone) connects directly without any login credentials
  console.log(`\n2. Device 2 (${devPhone}) accessing grocery items without login...`);
  const phoneItemsInit = await apiRequest('GET', '/api/grocery/items', null, devPhone);
  assert.strictEqual(phoneItemsInit.status, 200, 'Device 2 must access items with HTTP 200 without login');
  
  // Verify Device 2 does NOT have Device 1's "Minyak Goreng 2 Liter"
  const phoneHasLaptopItem = phoneItemsInit.data.items.some(i => i.name === 'Minyak Goreng 2 Liter');
  assert.strictEqual(phoneHasLaptopItem, false, 'Device 2 must NOT see Device 1 items!');
  console.log('   ✅ Terverifikasi: Device 2 TIDAK melihat barang Device 1! Data 100% terpisah.');

  // Device 2 sets wallet cash on hand to Rp 250.000
  console.log('   💵 Device 2 menyetel uang kas dipegang menjadi Rp 250.000...');
  const phoneWalletSet = await apiRequest('PUT', '/api/grocery/wallet', { action: 'set_cash', amount: 250000 }, devPhone);
  assert.strictEqual(phoneWalletSet.status, 200);
  assert.strictEqual(phoneWalletSet.data.wallet.current_cash, 250000);

  // Device 2 adds "Kopi Kenangan Botol" (Rp 15.000)
  const phoneAddItem = await apiRequest('POST', '/api/grocery/items', {
    name: 'Kopi Kenangan Botol',
    category: 'Snacks & Beverages',
    quantity: 2,
    unit: 'pcs',
    price: 15000
  }, devPhone);
  assert.strictEqual(phoneAddItem.status, 201);
  console.log('   ✅ Device 2 menambahkan barang: Kopi Kenangan Botol (2 × Rp 15.000 = Rp 30.000)');

  // 3. Verify Isolation between Device 1 and Device 2
  console.log('\n3. Verifikasi independensi data antar-perangkat...');
  const lapWalletCheck = await apiRequest('GET', '/api/grocery/wallet', null, devLaptop);
  assert.strictEqual(lapWalletCheck.data.wallet.current_cash, 700000, 'Device 1 cash must remain 700.000');
  console.log('   ✅ Uang kas Device 1 tetap Rp 700.000 (tidak terpengaruh Device 2)!');

  const phoneWalletCheck = await apiRequest('GET', '/api/grocery/wallet', null, devPhone);
  assert.strictEqual(phoneWalletCheck.data.wallet.current_cash, 250000, 'Device 2 cash must remain 250.000');
  console.log('   ✅ Uang kas Device 2 tetap Rp 250.000!');

  // 4. Test Automatic Cash Deduction on Device 1 after Shopping Checkout
  console.log('\n4. Testing pemotongan otomatis uang kas di Device 1...');
  const lapCheckout = await apiRequest('POST', '/api/grocery/history', {
    store_name: 'Supermarket Bintang',
    clear_cart: true
  }, devLaptop);
  assert.strictEqual(lapCheckout.status, 201);
  console.log(`   ✅ Selesai belanja kasir: Uang awal Rp 700.000 - Belanja Rp ${lapCheckout.data.trip.total_spent} -> Sisa Uang Kas: Rp ${lapCheckout.data.trip.cash_after}`);
  
  // Verify Device 2 cash is untouched
  const phoneAfterLapCheckout = await apiRequest('GET', '/api/grocery/wallet', null, devPhone);
  assert.strictEqual(phoneAfterLapCheckout.data.wallet.current_cash, 250000);
  console.log('   ✅ Uang kas Device 2 tetap utuh di Rp 250.000!');

  // 5. Test Device Profile Update
  console.log('\n5. Testing penamaan perangkat (Device Profile)...');
  const updateName = await apiRequest('PUT', '/api/device/profile', { name: 'Laptop Kerja Kantor' }, devLaptop);
  assert.strictEqual(updateName.status, 200);
  assert.strictEqual(updateName.data.device.name, 'Laptop Kerja Kantor');
  console.log('   ✅ Nama perangkat berhasil diubah menjadi:', updateName.data.device.name);

  console.log('\n===============================================================');
  console.log('🎉 ALL ZERO-LOGIN & MULTI-DEVICE ISOLATION TESTS PASSED! 💯');
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
