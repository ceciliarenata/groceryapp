/**
 * test-e2e-simulation.js
 * End-to-end multi-device and complete user flow simulation
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

async function simulateMultiDeviceSyncFlow() {
  console.log('📱 SIMULATING MULTI-DEVICE SYNCHRONIZATION SCENARIO (LAPTOP & SMARTPHONE)...');

  // Scenario from prompt:
  // 1. Pengguna login di laptop menggunakan akun A.
  const emailA = `cecil_${Date.now()}@mutiarabangsa.sch.id`;
  const registerA = await apiCall('POST', '/api/auth/register', {
    name: 'Cecilia Renata',
    email: emailA,
    password: 'MutiaraBangsaPassword123!'
  });
  assert.strictEqual(registerA.status, 201);
  const laptopToken = registerA.data.token;
  console.log(`   1. ✅ User A logged in on Laptop. Token: ${laptopToken.substring(0, 15)}...`);

  // 2. Pengguna menambahkan barang "Beras 5 kg" ke daftar belanja dan menyimpan harga serta jumlahnya di LAPTOP.
  const addLaptop = await apiCall('POST', '/api/grocery/items', {
    name: 'Beras 5 kg',
    category: 'Fruits & Vegetables',
    quantity: 1,
    unit: 'pack',
    price: 76000,
    is_purchased: false,
    notes: 'Beli kemasan utuh pulen'
  }, laptopToken);
  assert.strictEqual(addLaptop.status, 201);
  const berasItemId = addLaptop.data.item.id;
  console.log(`   2. ✅ Added "Beras 5 kg" on Laptop (Price: Rp 76.000, ID: ${berasItemId})`);

  // 3. Pengguna membuka aplikasi di HP dan login menggunakan akun A yang sama.
  const phoneLogin = await apiCall('POST', '/api/auth/login', {
    email: emailA,
    password: 'MutiaraBangsaPassword123!'
  });
  assert.strictEqual(phoneLogin.status, 200);
  const phoneToken = phoneLogin.data.token;
  console.log(`   3. ✅ User A logged in on Smartphone. Token: ${phoneToken.substring(0, 15)}...`);

  // 4. Barang "Beras 5 kg" harus muncul di HP dengan data yang sama.
  const phoneItems = await apiCall('GET', '/api/grocery/items', null, phoneToken);
  assert.strictEqual(phoneItems.status, 200);
  const foundBeras = phoneItems.data.items.find(i => i.id === berasItemId);
  assert.ok(foundBeras, 'Item "Beras 5 kg" must appear on Phone with exact data');
  assert.strictEqual(foundBeras.name, 'Beras 5 kg');
  assert.strictEqual(foundBeras.price, 76000);
  assert.strictEqual(foundBeras.is_purchased, false);
  console.log(`   4. ✅ Item "Beras 5 kg" successfully synced and retrieved on Smartphone!`);

  // 5. Barang diedit dan ditandai sudah dibeli melalui HP.
  const editPhone = await apiCall('PUT', `/api/grocery/items/${berasItemId}`, {
    quantity: 2,
    is_purchased: true,
    notes: 'Diambil dari rak depan'
  }, phoneToken);
  assert.strictEqual(editPhone.status, 200);
  console.log(`   5. ✅ Item updated on Smartphone (Qty: 2, is_purchased: true)`);

  // 6. Perubahan tersebut harus tersimpan dan terlihat di laptop.
  const laptopCheck = await apiCall('GET', '/api/grocery/items', null, laptopToken);
  const updatedBerasOnLaptop = laptopCheck.data.items.find(i => i.id === berasItemId);
  assert.ok(updatedBerasOnLaptop);
  assert.strictEqual(updatedBerasOnLaptop.quantity, 2);
  assert.strictEqual(updatedBerasOnLaptop.is_purchased, true);
  assert.strictEqual(updatedBerasOnLaptop.notes, 'Diambil dari rak depan');
  console.log(`   6. ✅ Verified on Laptop: Qty updated to 2, status marked purchased (Subtotal: 2 × Rp 76.000 = Rp 152.000)`);

  // 7. Pengguna logout di HP dan login kembali, data pengguna tetap tersedia.
  await apiCall('POST', '/api/auth/logout', null, phoneToken);
  const reLogin = await apiCall('POST', '/api/auth/login', {
    email: emailA,
    password: 'MutiaraBangsaPassword123!'
  });
  assert.strictEqual(reLogin.status, 200);
  const newSessionToken = reLogin.data.token;
  const reCheckItems = await apiCall('GET', '/api/grocery/items', null, newSessionToken);
  assert.strictEqual(reCheckItems.data.items.length, 1);
  assert.strictEqual(reCheckItems.data.items[0].name, 'Beras 5 kg');
  console.log(`   7. ✅ Persistent data verified after Logout and Re-login across devices!`);

  // 8. Isolasi data: Akun lain tidak dapat melihat atau mengakses item milik Akun A.
  const registerOther = await apiCall('POST', '/api/auth/register', {
    name: 'Akun Lain B',
    email: `other_${Date.now()}@grocery.com`,
    password: 'PasswordB123!'
  });
  const tokenOther = registerOther.data.token;
  const itemsOther = await apiCall('GET', '/api/grocery/items', null, tokenOther);
  assert.strictEqual(itemsOther.data.items.length, 0);
  console.log(`   8. ✅ Data isolation verified: Other users have 0 access to User A items!`);

  console.log('\n🎉 MULTI-DEVICE SYNCHRONIZATION & CROSS-PLATFORM FLOW FULLY VERIFIED!\n');
}

simulateMultiDeviceSyncFlow().catch(err => {
  console.error('❌ E2E Simulation failed:', err);
  process.exit(1);
});
