/**
 * server.js - Smart Grocery Tracker Backend Server
 * 
 * Features:
 * - Built-in secure PBKDF2 password hashing & token authentication
 * - Realtime Server-Sent Events (SSE) for instant cross-device synchronization
 * - RESTful API for Items CRUD, Budget Tracker, & Shopping History
 * - Strict multi-tenant data isolation by user_id
 * - Persistent atomic storage in ./data/database.json
 * - LAN accessible (0.0.0.0) for testing on Laptop, Desktop, Tablet, & Phone
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================================
// DATABASE & SEED INITIALIZATION
// ============================================================================
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const calculated = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(storedHash));
}

let db = {
  users: [],
  sessions: [],
  grocery_items: [],
  budget_settings: [],
  shopping_history: []
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
    } else {
      seedInitialDatabase();
      saveDatabase();
    }
  } catch (err) {
    console.error('[DB] Error loading database:', err.message);
    seedInitialDatabase();
    saveDatabase();
  }
}

function saveDatabase() {
  try {
    const tmpFile = DB_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Error saving database:', err.message);
  }
}

function seedInitialDatabase() {
  console.log('[DB] Seeding initial database with demo account...');
  
  const demoSaltHash = hashPassword('Password123!');
  const demoUserId = 'usr_demo_101';
  
  db.users = [
    {
      id: demoUserId,
      name: 'Budi Pratama',
      email: 'demo@grocery.com',
      salt: demoSaltHash.salt,
      password_hash: demoSaltHash.hash,
      created_at: new Date().toISOString()
    }
  ];

  db.budget_settings = [
    {
      user_id: demoUserId,
      budget_limit: 500000,
      alert_caution_percent: 75,
      alert_danger_percent: 90,
      updated_at: new Date().toISOString()
    }
  ];

  db.grocery_items = [
    {
      id: 'item_seed_1',
      user_id: demoUserId,
      name: 'Beras Premium Ramos 5 kg',
      category: 'Fruits & Vegetables', // Or staple
      quantity: 1,
      unit: 'pack',
      price: 74000,
      is_purchased: true,
      notes: 'Beli kemasan utuh, kualitas pulen',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'item_seed_2',
      user_id: demoUserId,
      name: 'Apel Fuji Segar (1 kg)',
      category: 'Fruits & Vegetables',
      quantity: 1,
      unit: 'kg',
      price: 38000,
      is_purchased: false,
      notes: 'Pilih yang manis dan garing',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'item_seed_3',
      user_id: demoUserId,
      name: 'Dada Ayam Fillet Segar',
      category: 'Meat & Seafood',
      quantity: 2,
      unit: 'pack',
      price: 36000,
      is_purchased: true,
      notes: '500g per pack',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'item_seed_4',
      user_id: demoUserId,
      name: 'Susu UHT Full Cream 1 Liter',
      category: 'Dairy & Eggs',
      quantity: 2,
      unit: 'liter',
      price: 19500,
      is_purchased: false,
      notes: 'Cek tanggal kadaluarsa minimal 6 bulan',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'item_seed_5',
      user_id: demoUserId,
      name: 'Kopi Bubuk Arabica 200g',
      category: 'Snacks & Beverages',
      quantity: 1,
      unit: 'pack',
      price: 28000,
      is_purchased: false,
      notes: 'Medium roast',
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'item_seed_6',
      user_id: demoUserId,
      name: 'Deterjen Cair Konsentrat 800ml',
      category: 'Household',
      quantity: 1,
      unit: 'pouch',
      price: 24500,
      is_purchased: true,
      notes: 'Pouch refill anti bakteri',
      created_at: new Date(Date.now() - 3600000 * 7).toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  db.shopping_history = [
    {
      id: 'trip_seed_1',
      user_id: demoUserId,
      store_name: 'Super Indo Sudirman',
      total_spent: 285000,
      items_count: 5,
      items_snapshot: [
        { name: 'Minyak Goreng 2L', price: 34000, qty: 1, unit: 'pouch' },
        { name: 'Telur Ayam 1 kg', price: 29000, qty: 1, unit: 'kg' },
        { name: 'Bawang Merah 500g', price: 22000, qty: 1, unit: 'pack' },
        { name: 'Sabun Cuci Piring Refill', price: 15500, qty: 1, unit: 'pouch' },
        { name: 'Beras Ramos 10 kg', price: 145000, qty: 1, unit: 'pack' }
      ],
      completed_at: new Date(Date.now() - 86400000 * 7).toISOString()
    }
  ];

  db.sessions = [];
}

loadDatabase();

// ============================================================================
// REALTIME SERVER-SENT EVENTS (SSE) BROADCASTER
// ============================================================================
const sseClients = new Map(); // userId -> Set of res objects

function registerSseClient(userId, res) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  res.on('close', () => {
    if (sseClients.has(userId)) {
      sseClients.get(userId).delete(res);
      if (sseClients.get(userId).size === 0) {
        sseClients.delete(userId);
      }
    }
  });
}

function broadcastSync(userId, action, payload = {}) {
  if (!sseClients.has(userId)) return;
  const clients = sseClients.get(userId);
  const data = JSON.stringify({ action, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    try {
      client.write(`event: sync\ndata: ${data}\n\n`);
    } catch (e) {
      // client disconnected
    }
  }
}

// ============================================================================
// MIME TYPES FOR STATIC SERVING
// ============================================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// ============================================================================
// HELPER UTILITIES
// ============================================================================
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { // 2MB max
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const session = db.sessions.find(s => s.token === token && new Date(s.expires_at) > new Date());
  if (!session) return null;

  const user = db.users.find(u => u.id === session.user_id);
  if (!user) return null;

  return { id: user.id, email: user.email, name: user.name };
}

// ============================================================================
// HTTP REQUEST ROUTER
// ============================================================================
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --------------------------------------------------------------------------
  // AUTHENTICATION ROUTES
  // --------------------------------------------------------------------------
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const { name, email, password } = await parseBody(req);
      
      if (!name || name.trim().length < 2) {
        return jsonResponse(res, 400, { error: 'Nama minimal 2 karakter.' });
      }
      if (!email || !email.includes('@') || !email.includes('.')) {
        return jsonResponse(res, 400, { error: 'Format email tidak valid.' });
      }
      if (!password || password.length < 6) {
        return jsonResponse(res, 400, { error: 'Password minimal 6 karakter.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (db.users.some(u => u.email === normalizedEmail)) {
        return jsonResponse(res, 409, { error: 'Email sudah terdaftar. Silakan gunakan email lain atau login.' });
      }

      const { salt, hash } = hashPassword(password);
      const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
      const newUser = {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        salt,
        password_hash: hash,
        created_at: new Date().toISOString()
      };
      db.users.push(newUser);

      // Create initial budget setting
      db.budget_settings.push({
        user_id: userId,
        budget_limit: 500000,
        alert_caution_percent: 75,
        alert_danger_percent: 90,
        updated_at: new Date().toISOString()
      });

      // Generate session token
      const token = 'tok_' + crypto.randomBytes(24).toString('hex');
      db.sessions.push({
        token,
        user_id: userId,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString() // 30 days
      });

      saveDatabase();
      return jsonResponse(res, 201, {
        message: 'Registrasi berhasil!',
        token,
        user: { id: newUser.id, name: newUser.name, email: newUser.email }
      });
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        return jsonResponse(res, 400, { error: 'Email dan password wajib diisi.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = db.users.find(u => u.email === normalizedEmail);
      if (!user) {
        return jsonResponse(res, 401, { error: 'Email atau password salah.' });
      }

      const isMatch = verifyPassword(password, user.salt, user.password_hash);
      if (!isMatch) {
        return jsonResponse(res, 401, { error: 'Email atau password salah.' });
      }

      // Generate session token
      const token = 'tok_' + crypto.randomBytes(24).toString('hex');
      db.sessions.push({
        token,
        user_id: user.id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString() // 30 days
      });

      saveDatabase();
      return jsonResponse(res, 200, {
        message: 'Login berhasil!',
        token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      db.sessions = db.sessions.filter(s => s.token !== token);
      saveDatabase();
    }
    return jsonResponse(res, 200, { message: 'Logout berhasil.' });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      return jsonResponse(res, 401, { error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
    }
    return jsonResponse(res, 200, { user });
  }

  if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
    try {
      const { email } = await parseBody(req);
      if (!email) return jsonResponse(res, 400, { error: 'Email wajib diisi.' });
      
      const normalizedEmail = email.trim().toLowerCase();
      const user = db.users.find(u => u.email === normalizedEmail);
      if (!user) {
        // Safe response to prevent email enumeration
        return jsonResponse(res, 200, { message: 'Jika email terdaftar, tautan pemulihan kata sandi telah dikirim.' });
      }

      // In local dev/test mode, provide temporary recovery code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      return jsonResponse(res, 200, {
        message: 'Instruksi pemulihan berhasil diproses.',
        recovery_code: resetCode,
        note: 'Gunakan kode verifikasi ini untuk mereset kata sandi Anda.'
      });
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // REALTIME SSE SYNC STREAM
  // --------------------------------------------------------------------------
  if (pathname === '/api/sync/events' && req.method === 'GET') {
    const token = parsedUrl.searchParams.get('token');
    const session = db.sessions.find(s => s.token === token && new Date(s.expires_at) > new Date());
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    registerSseClient(session.user_id, res);
    return;
  }

  // --------------------------------------------------------------------------
  // GROCERY ITEMS CRUD (Protected by User ID)
  // --------------------------------------------------------------------------
  if (pathname === '/api/grocery/items' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    const items = db.grocery_items
      .filter(item => item.user_id === user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return jsonResponse(res, 200, { items });
  }

  if (pathname === '/api/grocery/items' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    try {
      const data = await parseBody(req);
      if (!data.name || data.name.trim().length === 0) {
        return jsonResponse(res, 400, { error: 'Nama barang wajib diisi.' });
      }

      const validCategories = [
        'Fruits & Vegetables',
        'Meat & Seafood',
        'Dairy & Eggs',
        'Snacks & Beverages',
        'Household',
        'Other'
      ];

      const category = validCategories.includes(data.category) ? data.category : 'Other';
      const quantity = Math.max(0.1, parseFloat(data.quantity) || 1);
      const price = Math.max(0, parseFloat(data.price) || 0);
      const unit = data.unit ? data.unit.trim() : 'pcs';

      const newItem = {
        id: 'item_' + crypto.randomBytes(8).toString('hex'),
        user_id: user.id,
        name: data.name.trim(),
        category,
        quantity,
        unit,
        price,
        is_purchased: !!data.is_purchased,
        notes: data.notes ? data.notes.trim() : '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.grocery_items.push(newItem);
      saveDatabase();
      broadcastSync(user.id, 'ITEM_CREATED', newItem);

      return jsonResponse(res, 201, { message: 'Barang berhasil ditambahkan!', item: newItem });
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/grocery/items/') && req.method === 'PUT') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    const itemId = pathname.substring('/api/grocery/items/'.length);
    const itemIndex = db.grocery_items.findIndex(it => it.id === itemId && it.user_id === user.id);

    if (itemIndex === -1) {
      return jsonResponse(res, 404, { error: 'Barang tidak ditemukan atau bukan milik Anda.' });
    }

    try {
      const data = await parseBody(req);
      const existing = db.grocery_items[itemIndex];

      if (data.name !== undefined) existing.name = data.name.trim();
      if (data.category !== undefined) existing.category = data.category;
      if (data.quantity !== undefined) existing.quantity = Math.max(0.1, parseFloat(data.quantity) || 1);
      if (data.unit !== undefined) existing.unit = data.unit.trim();
      if (data.price !== undefined) existing.price = Math.max(0, parseFloat(data.price) || 0);
      if (data.is_purchased !== undefined) existing.is_purchased = !!data.is_purchased;
      if (data.notes !== undefined) existing.notes = data.notes.trim();
      existing.updated_at = new Date().toISOString();

      saveDatabase();
      broadcastSync(user.id, 'ITEM_UPDATED', existing);

      return jsonResponse(res, 200, { message: 'Barang berhasil diperbarui!', item: existing });
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/grocery/items/') && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    const itemId = pathname.substring('/api/grocery/items/'.length);
    const itemIndex = db.grocery_items.findIndex(it => it.id === itemId && it.user_id === user.id);

    if (itemIndex === -1) {
      return jsonResponse(res, 404, { error: 'Barang tidak ditemukan atau bukan milik Anda.' });
    }

    const deleted = db.grocery_items.splice(itemIndex, 1)[0];
    saveDatabase();
    broadcastSync(user.id, 'ITEM_DELETED', { id: itemId });

    return jsonResponse(res, 200, { message: 'Barang berhasil dihapus.', item: deleted });
  }

  // --------------------------------------------------------------------------
  // BUDGET SETTINGS (Protected by User ID)
  // --------------------------------------------------------------------------
  if (pathname === '/api/grocery/budget' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    let budget = db.budget_settings.find(b => b.user_id === user.id);
    if (!budget) {
      budget = {
        user_id: user.id,
        budget_limit: 500000,
        alert_caution_percent: 75,
        alert_danger_percent: 90,
        updated_at: new Date().toISOString()
      };
      db.budget_settings.push(budget);
      saveDatabase();
    }

    return jsonResponse(res, 200, { budget });
  }

  if (pathname === '/api/grocery/budget' && req.method === 'PUT') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    try {
      const data = await parseBody(req);
      let budget = db.budget_settings.find(b => b.user_id === user.id);
      if (!budget) {
        budget = { user_id: user.id };
        db.budget_settings.push(budget);
      }

      if (data.budget_limit !== undefined) budget.budget_limit = Math.max(0, parseFloat(data.budget_limit) || 0);
      if (data.alert_caution_percent !== undefined) budget.alert_caution_percent = parseInt(data.alert_caution_percent, 10);
      if (data.alert_danger_percent !== undefined) budget.alert_danger_percent = parseInt(data.alert_danger_percent, 10);
      budget.updated_at = new Date().toISOString();

      saveDatabase();
      broadcastSync(user.id, 'BUDGET_UPDATED', budget);

      return jsonResponse(res, 200, { message: 'Anggaran berhasil diperbarui!', budget });
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // SHOPPING HISTORY (Protected by User ID)
  // --------------------------------------------------------------------------
  if (pathname === '/api/grocery/history' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    const history = (db.shopping_history || [])
      .filter(h => h.user_id === user.id)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

    return jsonResponse(res, 200, { history });
  }

  if (pathname === '/api/grocery/history' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return jsonResponse(res, 401, { error: 'Unauthorized' });

    try {
      const data = await parseBody(req);
      const itemsSnapshot = Array.isArray(data.items_snapshot) ? data.items_snapshot : [];
      const totalSpent = parseFloat(data.total_spent) || 0;
      const storeName = data.store_name ? data.store_name.trim() : 'Supermarket';

      const trip = {
        id: 'trip_' + crypto.randomBytes(8).toString('hex'),
        user_id: user.id,
        store_name: storeName,
        total_spent: totalSpent,
        items_count: itemsSnapshot.length,
        items_snapshot: itemsSnapshot,
        completed_at: new Date().toISOString()
      };

      if (!db.shopping_history) db.shopping_history = [];
      db.shopping_history.push(trip);

      // Optionally mark all items in active cart as purchased or clear them if requested
      if (data.clear_cart) {
        db.grocery_items = db.grocery_items.filter(item => item.user_id !== user.id);
      } else if (data.mark_all_purchased) {
        db.grocery_items.forEach(item => {
          if (item.user_id === user.id) item.is_purchased = true;
        });
      }

      saveDatabase();
      broadcastSync(user.id, 'HISTORY_ADDED', trip);

      return jsonResponse(res, 201, { message: 'Riwayat belanja berhasil disimpan!', trip });
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // STATIC ASSETS SERVING
  // --------------------------------------------------------------------------
  let reqPath = decodeURI(pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);

  // Security guard against path traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// ============================================================================
// START SERVER
// ============================================================================
server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🛒 Smart Grocery Tracker Server Active!`);
  console.log(`📍 Local access:      http://localhost:${PORT}`);
  
  // Enumerate LAN IPs for easy testing on HP / Tablet
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`📱 Phone / Tablet:   http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log(`======================================================\n`);
});
