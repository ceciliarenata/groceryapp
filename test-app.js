/**
 * test-app.js
 * Comprehensive automated unit and integration tests for Smart Grocery logic & server endpoints
 */

const http = require('http');
const assert = require('assert');

// 1. Test Server HTTP Endpoints
function testEndpoint(path, expectedStatus, expectedType) {
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
          console.log(`✅ [HTTP 200] ${path} (${res.headers['content-type']}) - Size: ${data.length} bytes`);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// 2. Test DiscountCalculator
function testDiscounts() {
  const DiscountCalculator = require('./js/discounts.js');
  // In node discounts.js doesn't export by default if window isn't defined, let's load it
}

async function runAllTests() {
  console.log('--- TESTING SERVER ENDPOINTS ---');
  await testEndpoint('/', 200, 'text/html');
  await testEndpoint('/index.html', 200, 'text/html');
  await testEndpoint('/css/style.css', 200, 'text/css');
  await testEndpoint('/js/app.js', 200, 'application/javascript');
  await testEndpoint('/js/discounts.js', 200, 'application/javascript');
  await testEndpoint('/js/comparator.js', 200, 'application/javascript');
  await testEndpoint('/js/seed-data.js', 200, 'application/javascript');
  await testEndpoint('/js/sound-haptic.js', 200, 'application/javascript');
  await testEndpoint('/manifest.json', 200, 'application/json');
  await testEndpoint('/icons/icon.svg', 200, 'image/svg+xml');
  await testEndpoint('/icons/icon-192.png', 200, 'image/png');
  await testEndpoint('/sw.js', 200, 'application/javascript');

  console.log('\n--- TESTING MATHEMATICAL CALCULATIONS ---');
  const vm = require('vm');
  const fs = require('fs');

  const context = { window: {}, console: console, Intl: Intl, Math: Math, Number: Number, parseFloat: parseFloat, parseInt: parseInt, isNaN: isNaN };
  vm.createContext(context);

  vm.runInContext(fs.readFileSync('./js/seed-data.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('./js/discounts.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('./js/comparator.js', 'utf8'), context);

  const calc = context.window.DiscountCalculator;
  const comp = context.window.PriceComparator;

  // Test single discount 20% on Rp 50.000
  const singleRes = calc.calculate(50000, 'single', 20);
  assert.strictEqual(singleRes.finalPrice, 40000);
  assert.strictEqual(singleRes.savedAmount, 10000);
  assert.strictEqual(singleRes.effectivePercentage, 20);
  console.log('✅ Single Discount 20% on Rp 50.000 = Rp 40.000 (Hemat Rp 10.000)');

  // Test tiered discount 50% + 20% on Rp 100.000
  // First 50% of 100.000 = 50.000. Second 20% of 50.000 = 10.000 off -> Final 40.000 (Effective 60%)
  const tieredRes = calc.calculate(100000, 'tiered', 50, 20);
  assert.strictEqual(tieredRes.finalPrice, 40000);
  assert.strictEqual(tieredRes.savedAmount, 60000);
  assert.strictEqual(tieredRes.effectivePercentage, 60);
  console.log('✅ Tiered Discount 50% + 20% on Rp 100.000 = Rp 40.000 (Efektif 60%, Hemat Rp 60.000)');

  // Test tiered discount 70% + 20% on Rp 200.000
  // 200k * 0.3 * 0.8 = 48k (effective 76%)
  const tieredRes2 = calc.calculate(200000, 'tiered', 70, 20);
  assert.strictEqual(tieredRes2.finalPrice, 48000);
  assert.strictEqual(tieredRes2.effectivePercentage, 76);
  console.log('✅ Tiered Discount 70% + 20% on Rp 200.000 = Rp 48.000 (Efektif 76%)');

  // Test nominal discount Rp 5.000 on Rp 25.000
  const nomRes = calc.calculate(25000, 'nominal', 5000);
  assert.strictEqual(nomRes.finalPrice, 20000);
  console.log('✅ Nominal Discount Rp 5.000 on Rp 25.000 = Rp 20.000');

  // Test Comparator
  // 1. Higher (Naik)
  const compUp = comp.compare(76000, 74000);
  assert.strictEqual(compUp.status, 'higher');
  assert.strictEqual(compUp.symbol, '↑');
  assert.strictEqual(compUp.diffNominal, 2000);
  console.log(`✅ Price Comparator Naik: ${compUp.message}`);

  // 2. Lower (Turun)
  const compDown = comp.compare(32500, 34000);
  assert.strictEqual(compDown.status, 'lower');
  assert.strictEqual(compDown.symbol, '↓');
  assert.strictEqual(compDown.diffNominal, 1500);
  console.log(`✅ Price Comparator Turun: ${compDown.message}`);

  // 3. Equal (Sama)
  const compEq = comp.compare(27500, 27500);
  assert.strictEqual(compEq.status, 'equal');
  assert.strictEqual(compEq.symbol, '=');
  console.log(`✅ Price Comparator Sama: ${compEq.message}`);

  console.log('\n🎉 ALL LOGIC AND ENDPOINT TESTS PASSED SUCCESSFULLY!');
}

runAllTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
