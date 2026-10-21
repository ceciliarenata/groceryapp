/**
 * SMART GROCERY TRACKER - COMPLETE FRONTEND CONTROLLER
 * 
 * Features:
 * - Multi-Device Independent Authentication & Data Isolation
 * - Cash on Hand Wallet ("Uang Belanja yang Kita Pegang")
 * - Automatic Cash Deduction after Checkout / Kasir
 * - Realtime Cross-Device Server-Sent Events (SSE) Synchronization
 * - Complete CRUD Operations with Optimistic UI updates
 * - Dynamic Dashboard, Metrics, & Category Spending Breakdown
 * - Budget Safety Cap Tracker with Gauge & Zone Alerts
 * - Shopping History Archival & Receipt Breakdown
 * - Modern Green/White UI with Toast Notifications & Modals
 */

// Global Application State
const App = {
  currentUser: null,
  deviceId: null,
  token: null,
  items: [],
  budget: {
    budget_limit: 500000,
    alert_caution_percent: 75,
    alert_danger_percent: 90
  },
  wallet: {
    initial_cash: 500000,
    current_cash: 500000
  },
  history: [],
  activeTab: 'tabDashboard',
  filter: {
    search: '',
    category: 'all',
    status: 'all'
  },
  itemToDelete: null,
  sseEventSource: null
};

let walletModalMode = 'set'; // 'set' | 'add'

// ============================================================================
// DEVICE IDENTIFICATION & ISOLATION (NO LOGIN NEEDED, DISTINCT PER DEVICE)
// ============================================================================
function getDeviceLabel() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  if (/android/i.test(ua)) return 'HP Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone / iPad';
  if (/tablet/i.test(ua)) return 'Tablet';
  if (/windows/i.test(ua)) return 'Laptop / PC Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'MacBook / Mac';
  return 'Perangkat Ini';
}

function ensureDeviceId() {
  let devId = localStorage.getItem('sgt_device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
    localStorage.setItem('sgt_device_id', devId);
  }
  App.deviceId = devId;
  App.token = devId;

  let devName = localStorage.getItem('sgt_device_name');
  if (!devName) {
    devName = `${getDeviceLabel()} (${devId.slice(-4).toUpperCase()})`;
    localStorage.setItem('sgt_device_name', devName);
  }

  App.currentUser = {
    id: devId,
    name: devName,
    email: devId + '@device.local'
  };
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================
function formatRupiah(amount) {
  const num = Math.round(Number(amount) || 0);
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(num);
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

// Category Config
const CATEGORY_META = {
  'Fruits & Vegetables': { emoji: '🍎', label: 'Fruits & Vegetables', class: 'cat-fruits' },
  'Meat & Seafood': { emoji: '🥩', label: 'Meat & Seafood', class: 'cat-meat' },
  'Dairy & Eggs': { emoji: '🥛', label: 'Dairy & Eggs', class: 'cat-dairy' },
  'Snacks & Beverages': { emoji: '☕', label: 'Snacks & Beverages', class: 'cat-snacks' },
  'Household': { emoji: '🧼', label: 'Household', class: 'cat-household' },
  'Other': { emoji: '📦', label: 'Other', class: 'cat-other' }
};

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;

  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-circle';
  if (type === 'warning') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 20px; height: 20px; flex-shrink: 0; color: ${
      type === 'success' ? '#10b981' : type === 'error' ? '#f43f5e' : '#f59e0b'
    };"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons({ root: toast });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// API CLIENT WITH AUTOMATIC DEVICE HEADERS & ERROR HANDLING
// ============================================================================
const API_BASE = (function() {
  if (typeof window === 'undefined') return '';
  // If the frontend is served directly on port 3000, relative paths work directly
  if (window.location.port === '3000') {
    return '';
  }
  // If accessed via Live Server (port 5500, 8080, etc.), file://, or another dev server
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3000`;
})();

async function api(path, options = {}) {
  const url = path.startsWith('/api') ? `${API_BASE}${path}` : path;
  const devId = App.deviceId || localStorage.getItem('sgt_device_id') || 'dev_default';
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': devId,
    ...(options.headers || {})
  };

  if (App.token) {
    headers['Authorization'] = `Bearer ${App.token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    
    // Safely extract text first to prevent raw "Unexpected token '<'"
    const rawText = await res.text();
    let data = null;

    if (rawText && rawText.trim().length > 0) {
      if (rawText.trim().startsWith('<')) {
        // If response is HTML (e.g. 404 from Live Server or static fallback)
        throw new Error(
          'Tidak dapat terhubung ke server API (merespons HTML). Pastikan server "node server.js" sedang aktif di http://localhost:3000.'
        );
      }
      try {
        data = JSON.parse(rawText);
      } catch (jsonErr) {
        throw new Error('Format data dari server tidak valid.');
      }
    }

    if (res.status === 401) {
      // Re-initialize device id without interrupting user
      handleSessionExpired();
      throw new Error((data && data.error) || 'Sesi perangkat telah diperbarui.');
    }

    if (!res.ok) {
      throw new Error((data && data.error) || `Terjadi kesalahan sistem (Kode: ${res.status}).`);
    }

    return data || {};
  } catch (err) {
    if (err.name === 'TypeError' && String(err.message).toLowerCase().includes('fetch')) {
      throw new Error('Tidak dapat terhubung ke server backend. Pastikan "node server.js" sedang berjalan di terminal.');
    }
    if (String(err.message).includes('Unexpected token')) {
      throw new Error('Respon server bukan JSON. Pastikan server backend Node.js (port 3000) sedang berjalan.');
    }
    throw err;
  }
}

function handleSessionExpired() {
  ensureDeviceId();
}

// ============================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) SYNCHRONIZATION
// ============================================================================
function initRealtimeSync() {
  const devId = App.deviceId || localStorage.getItem('sgt_device_id') || 'dev_default';

  if (App.sseEventSource) {
    App.sseEventSource.close();
    App.sseEventSource = null;
  }

  const badge = document.getElementById('syncStatusBadge');
  const badgeText = document.getElementById('syncStatusText');

  try {
    const sse = new EventSource(`${API_BASE}/api/sync/events?device_id=${encodeURIComponent(devId)}`);
    App.sseEventSource = sse;

    sse.addEventListener('connected', () => {
      if (badge) badge.className = 'sync-badge';
      if (badgeText) badgeText.textContent = 'Tersinkronisasi (Real-time)';
    });

    sse.addEventListener('sync', (e) => {
      try {
        const payload = JSON.parse(e.data);
        console.log('[SSE Realtime Sync Received]:', payload.action);
        
        if (badge) badge.className = 'sync-badge syncing';
        if (badgeText) badgeText.textContent = 'Menyinkronkan...';

        fetchDataSilently().then(() => {
          setTimeout(() => {
            if (badge) badge.className = 'sync-badge';
            if (badgeText) badgeText.textContent = 'Tersinkronisasi (Real-time)';
          }, 600);
        });
      } catch (err) {
        console.warn('Error parsing SSE sync:', err);
      }
    });

    sse.onerror = () => {
      if (badge) badge.className = 'sync-badge offline';
      if (badgeText) badgeText.textContent = 'Mode Offline';
    };

  } catch (err) {
    console.warn('SSE not supported or connection error:', err);
  }
}

// ============================================================================
// DATA FETCHING & SYNCHRONIZATION
// ============================================================================
async function fetchAllData() {
  if (!App.token) return;

  try {
    const [itemsRes, budgetRes, historyRes, walletRes] = await Promise.all([
      api('/api/grocery/items'),
      api('/api/grocery/budget'),
      api('/api/grocery/history'),
      api('/api/grocery/wallet')
    ]);

    App.items = itemsRes.items || [];
    if (budgetRes.budget) App.budget = budgetRes.budget;
    App.history = historyRes.history || [];
    if (walletRes.wallet) App.wallet = walletRes.wallet;

    renderAllViews();
  } catch (err) {
    console.error('Fetch all data error:', err);
    showToast(err.message, 'error');
  }
}

async function fetchDataSilently() {
  if (!App.token) return;
  try {
    const [itemsRes, budgetRes, historyRes, walletRes] = await Promise.all([
      api('/api/grocery/items'),
      api('/api/grocery/budget'),
      api('/api/grocery/history'),
      api('/api/grocery/wallet')
    ]);

    App.items = itemsRes.items || [];
    if (budgetRes.budget) App.budget = budgetRes.budget;
    App.history = historyRes.history || [];
    if (walletRes.wallet) App.wallet = walletRes.wallet;

    renderAllViews();
  } catch (err) {
    console.warn('Silent sync error:', err.message);
  }
}

// ============================================================================
// VIEW RENDERING
// ============================================================================
function renderAllViews() {
  renderHeaderUser();
  renderDashboard();
  renderWalletUI();
  renderShoppingList();
  renderBudgetSettings();
  renderHistory();
  if (window.lucide) window.lucide.createIcons();
}

function renderHeaderUser() {
  const badge = document.getElementById('userProfileBadge');
  const loginTrigger = document.getElementById('btnLoginTrigger');
  const avatar = document.getElementById('userAvatarText');
  const name = document.getElementById('headerUserName');

  if (badge) badge.style.display = 'flex';
  if (loginTrigger) loginTrigger.style.display = 'none';
  if (avatar) avatar.innerHTML = '<i data-lucide="smartphone" style="width: 14px; height: 14px;"></i>';
  if (name) name.textContent = (App.currentUser && App.currentUser.name) || 'Perangkat Ini';
  if (window.lucide) window.lucide.createIcons({ root: badge });
}

// ----------------------------------------------------------------------------
// 1. DASHBOARD & WALLET VIEW
// ----------------------------------------------------------------------------
function renderDashboard() {
  const totalItems = App.items.length;
  const purchasedItems = App.items.filter(i => i.is_purchased).length;
  const pendingItems = totalItems - purchasedItems;

  const totalCost = App.items.reduce((acc, it) => {
    return acc + (Number(it.quantity) || 1) * (Number(it.price) || 0);
  }, 0);

  // Update Metrics
  const elTotal = document.getElementById('dashTotalItems');
  const elPurchased = document.getElementById('dashPurchasedItems');
  const elPurchasedPct = document.getElementById('dashPurchasedPercent');
  const elPending = document.getElementById('dashPendingItems');
  const elCost = document.getElementById('dashTotalCost');
  const badgeCartTotal = document.getElementById('badgeCartTotal');

  if (elTotal) elTotal.textContent = `${totalItems}`;
  if (elPurchased) elPurchased.textContent = `${purchasedItems}`;
  if (elPurchasedPct) {
    const pct = totalItems > 0 ? Math.round((purchasedItems / totalItems) * 100) : 0;
    elPurchasedPct.textContent = `${pct}% dari total barang`;
  }
  if (elPending) elPending.textContent = `${pendingItems}`;
  if (elCost) elCost.textContent = formatRupiah(totalCost);
  if (badgeCartTotal) badgeCartTotal.textContent = `${totalItems}`;

  // Update Budget Health Card
  const budgetCap = Number(App.budget.budget_limit) || 500000;
  const remaining = budgetCap - totalCost;
  const usedPercent = budgetCap > 0 ? Math.round((totalCost / budgetCap) * 100) : 0;

  const elCap = document.getElementById('dashBudgetCap');
  const elRem = document.getElementById('dashBudgetRemaining');
  const elFill = document.getElementById('dashBudgetProgressFill');
  const elPctText = document.getElementById('dashBudgetPercentText');
  const elLimitInfo = document.getElementById('dashBudgetLimitInfo');
  const elStatusBadge = document.getElementById('dashBudgetStatusBadge');
  const alertBanner = document.getElementById('dashBudgetAlertBanner');
  const alertMsg = document.getElementById('dashBudgetAlertMsg');

  if (elCap) elCap.textContent = formatRupiah(budgetCap);
  if (elRem) {
    elRem.textContent = formatRupiah(remaining);
    elRem.className = `budget-stat-val ${remaining >= 0 ? 'safe' : 'danger'}`;
  }
  if (elLimitInfo) elLimitInfo.textContent = `Batas: ${formatRupiah(budgetCap)}`;

  const cautionPct = App.budget.alert_caution_percent || 75;
  const dangerPct = App.budget.alert_danger_percent || 90;

  let zoneClass = 'gauge-safe';
  let badgeStatusHtml = '● Aman';
  let badgeStatusClass = 'badge-safe';

  if (usedPercent >= 100) {
    zoneClass = 'gauge-danger';
    badgeStatusHtml = '⚠️ Melebihi Anggaran';
    badgeStatusClass = 'badge-danger';
    if (alertBanner && alertMsg) {
      alertBanner.style.display = 'flex';
      alertBanner.className = 'budget-alert-box alert-danger';
      alertMsg.textContent = `Peringatan Kritis: Total belanja ${formatRupiah(totalCost)} telah melebihi batas anggaran (${usedPercent}%)!`;
    }
  } else if (usedPercent >= dangerPct) {
    zoneClass = 'gauge-danger';
    badgeStatusHtml = '⚠️ Zona Bahaya';
    badgeStatusClass = 'badge-danger';
    if (alertBanner && alertMsg) {
      alertBanner.style.display = 'flex';
      alertBanner.className = 'budget-alert-box alert-danger';
      alertMsg.textContent = `Peringatan: Belanja mencapai ${usedPercent}% batas dompet. Segera prioritaskan barang esensial!`;
    }
  } else if (usedPercent >= cautionPct) {
    zoneClass = 'gauge-caution';
    badgeStatusHtml = '● Zona Waspada';
    badgeStatusClass = 'badge-caution';
    if (alertBanner && alertMsg) {
      alertBanner.style.display = 'flex';
      alertBanner.className = 'budget-alert-box alert-warning';
      alertMsg.textContent = `Waspada: Belanja sudah ${usedPercent}% dari batas dompet Anda.`;
    }
  } else {
    if (alertBanner) alertBanner.style.display = 'none';
  }

  if (elFill) {
    elFill.style.width = `${Math.min(100, usedPercent)}%`;
    elFill.className = `budget-gauge-fill ${zoneClass}`;
  }
  if (elPctText) elPctText.textContent = `${usedPercent}% Terpakai`;
  if (elStatusBadge) {
    elStatusBadge.className = `budget-status-badge ${badgeStatusClass}`;
    elStatusBadge.textContent = badgeStatusHtml;
  }

  // Category Breakdown Bars
  renderCategoryBreakdown(totalCost);
}

// ----------------------------------------------------------------------------
// FITUR WAJIB: UANG BELANJA YANG DIPEGANG (WALLET & CASH ON HAND)
// ----------------------------------------------------------------------------
function renderWalletUI() {
  const currentCash = Number(App.wallet.current_cash) || 0;
  const initialCash = Number(App.wallet.initial_cash) || currentCash;
  const totalCartCost = App.items.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);
  const remainingCash = currentCash - totalCartCost;
  const usedCashPercent = currentCash > 0 ? Math.round((totalCartCost / currentCash) * 100) : 0;

  // 1. Update Dashboard Wallet Card
  const elDashCash = document.getElementById('dashWalletCash');
  const elDashRemaining = document.getElementById('dashWalletRemaining');
  const elDashFill = document.getElementById('dashWalletProgressFill');
  const elDashPctText = document.getElementById('dashWalletPercentText');
  const elDashInitialInfo = document.getElementById('dashWalletInitialInfo');
  const elDashStatusBadge = document.getElementById('dashWalletStatusBadge');
  const elDashDeficitBanner = document.getElementById('dashWalletDeficitBanner');
  const elDashDeficitMsg = document.getElementById('dashWalletDeficitMsg');

  if (elDashCash) elDashCash.textContent = formatRupiah(currentCash);
  if (elDashRemaining) {
    elDashRemaining.textContent = formatRupiah(remainingCash);
    elDashRemaining.className = `budget-stat-val ${remainingCash >= 0 ? 'safe' : 'danger'}`;
  }
  if (elDashInitialInfo) elDashInitialInfo.textContent = `Modal Kas Awal: ${formatRupiah(initialCash)}`;
  if (elDashPctText) elDashPctText.textContent = `${usedCashPercent}% Terpakai Belanja`;

  if (elDashFill) {
    elDashFill.style.width = `${Math.min(100, usedCashPercent)}%`;
    elDashFill.className = `budget-gauge-fill ${remainingCash >= 0 ? (usedCashPercent >= 80 ? 'gauge-caution' : 'gauge-safe') : 'gauge-danger'}`;
  }

  if (elDashStatusBadge) {
    if (remainingCash < 0) {
      elDashStatusBadge.className = 'budget-status-badge badge-danger';
      elDashStatusBadge.textContent = '🚨 Uang Kurang!';
    } else if (usedCashPercent >= 80) {
      elDashStatusBadge.className = 'budget-status-badge badge-caution';
      elDashStatusBadge.textContent = '⚠️ Uang Menipis';
    } else {
      elDashStatusBadge.className = 'budget-status-badge badge-safe';
      elDashStatusBadge.textContent = '● Uang Cukup';
    }
  }

  if (elDashDeficitBanner && elDashDeficitMsg) {
    if (remainingCash < 0) {
      elDashDeficitBanner.style.display = 'flex';
      elDashDeficitMsg.textContent = `Peringatan Defisit: Uang belanja yang Anda pegang kurang ${formatRupiah(Math.abs(remainingCash))}! Kurangi barang atau tambah uang kas.`;
    } else {
      elDashDeficitBanner.style.display = 'none';
    }
  }

  // 2. Update Shopping List Cash Tracker Bar
  const elShopCash = document.getElementById('shopBarCashHolding');
  const elShopCart = document.getElementById('shopBarCartTotal');
  const elShopRemaining = document.getElementById('shopBarCashRemaining');
  const elShopDeficitAlert = document.getElementById('shoppingCashDeficitAlert');
  const elShopDeficitMsg = document.getElementById('shoppingCashDeficitMsg');

  if (elShopCash) elShopCash.textContent = formatRupiah(currentCash);
  if (elShopCart) elShopCart.textContent = formatRupiah(totalCartCost);
  if (elShopRemaining) {
    elShopRemaining.textContent = formatRupiah(remainingCash);
    elShopRemaining.style.color = remainingCash >= 0 ? 'var(--primary-600)' : 'var(--accent-rose)';
  }

  if (elShopDeficitAlert && elShopDeficitMsg) {
    if (remainingCash < 0) {
      elShopDeficitAlert.style.display = 'flex';
      elShopDeficitMsg.textContent = `🚨 Peringatan Defisit: Total belanjaan (${formatRupiah(totalCartCost)}) melebihi uang kas yang Anda pegang (${formatRupiah(currentCash)}) sebesar ${formatRupiah(Math.abs(remainingCash))}!`;
    } else {
      elShopDeficitAlert.style.display = 'none';
    }
  }

  // 3. Update Checkout Modal Preview
  const elCheckCashBefore = document.getElementById('checkoutCashBefore');
  const elCheckCashAfter = document.getElementById('checkoutCashAfter');
  if (elCheckCashBefore) elCheckCashBefore.textContent = formatRupiah(currentCash);
  if (elCheckCashAfter) {
    elCheckCashAfter.textContent = formatRupiah(Math.max(0, remainingCash));
    elCheckCashAfter.style.color = remainingCash >= 0 ? 'var(--primary-600)' : 'var(--accent-rose)';
  }
}

function renderCategoryBreakdown(totalCost) {
  const container = document.getElementById('dashCategoryBarsList');
  if (!container) return;

  const categories = [
    'Fruits & Vegetables',
    'Meat & Seafood',
    'Dairy & Eggs',
    'Snacks & Beverages',
    'Household',
    'Other'
  ];

  const catSums = {};
  categories.forEach(c => catSums[c] = 0);

  App.items.forEach(it => {
    const cat = categories.includes(it.category) ? it.category : 'Other';
    const subtotal = (Number(it.quantity) || 1) * (Number(it.price) || 0);
    catSums[cat] += subtotal;
  });

  container.innerHTML = categories.map(cat => {
    const meta = CATEGORY_META[cat] || { emoji: '📦', label: cat };
    const amount = catSums[cat];
    const pct = totalCost > 0 ? Math.round((amount / totalCost) * 100) : 0;

    return `
      <div class="category-bar-item">
        <div class="category-bar-label-row">
          <span class="category-bar-name">
            <span>${meta.emoji}</span>
            <span>${meta.label}</span>
          </span>
          <span class="category-bar-amount">${formatRupiah(amount)} (${pct}%)</span>
        </div>
        <div class="category-progress-track">
          <div class="category-progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------------------------------
// 2. SHOPPING LIST VIEW
// ----------------------------------------------------------------------------
function renderShoppingList() {
  const container = document.getElementById('itemsCardsContainer');
  const emptyCard = document.getElementById('emptyStateCard');
  const filterInfo = document.getElementById('itemsListFilterInfo');
  const listTotal = document.getElementById('itemsListTotalBottom');
  const dockSummary = document.getElementById('dockItemsSummaryText');
  const dockTotal = document.getElementById('dockTotalCost');

  if (!container) return;

  // Apply Search & Filters
  const search = App.filter.search.trim().toLowerCase();
  const cat = App.filter.category;
  const status = App.filter.status;

  const filtered = App.items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search)) return false;
    if (cat !== 'all' && item.category !== cat) return false;
    if (status === 'pending' && item.is_purchased) return false;
    if (status === 'purchased' && !item.is_purchased) return false;
    return true;
  });

  const totalCost = App.items.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);
  const purchasedCount = App.items.filter(it => it.is_purchased).length;

  if (listTotal) listTotal.textContent = formatRupiah(totalCost);
  if (dockTotal) dockTotal.textContent = formatRupiah(totalCost);
  if (dockSummary) dockSummary.textContent = `${App.items.length} Barang (${purchasedCount} sudah dibeli)`;

  if (filterInfo) {
    if (search || cat !== 'all' || status !== 'all') {
      filterInfo.textContent = `(Menampilkan ${filtered.length} dari ${App.items.length} barang)`;
    } else {
      filterInfo.textContent = `(Menampilkan semua ${App.items.length} barang)`;
    }
  }

  // Handle Empty State
  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyCard) {
      emptyCard.style.display = 'block';
      const emptyTitle = document.getElementById('emptyStateTitle');
      const emptyDesc = document.getElementById('emptyStateDesc');
      if (search || cat !== 'all' || status !== 'all') {
        if (emptyTitle) emptyTitle.textContent = 'Tidak Ada Barang yang Cocok';
        if (emptyDesc) emptyDesc.textContent = 'Coba ubah kata kunci pencarian atau bersihkan filter kategori.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'Daftar Belanja Masih Kosong';
        if (emptyDesc) emptyDesc.textContent = 'Mulai tambahkan kebutuhan belanja bulanan atau harian Anda dengan tombol di bawah.';
      }
    }
    return;
  }

  if (emptyCard) emptyCard.style.display = 'none';

  // Render Item Cards
  container.innerHTML = filtered.map(item => {
    const meta = CATEGORY_META[item.category] || { emoji: '📦', label: item.category, class: 'cat-other' };
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const subtotal = qty * price;
    const isPurchased = !!item.is_purchased;

    return `
      <div class="grocery-item-card ${isPurchased ? 'is-purchased' : ''}" data-id="${item.id}">
        
        <!-- Left: Checkbox + Details -->
        <div class="item-left-group">
          <button class="custom-checkbox-btn" onclick="toggleItemPurchased('${item.id}')" title="${isPurchased ? 'Tandai belum dibeli' : 'Tandai sudah dibeli'}">
            ${isPurchased ? '<i data-lucide="check" style="width: 16px; height: 16px;"></i>' : ''}
          </button>
          
          <div class="item-details-wrap">
            <span class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <div class="item-meta-row">
              <span class="category-tag-badge ${meta.class}">
                ${meta.emoji} ${meta.label}
              </span>
              <span class="item-price-unit-text">
                ${formatRupiah(price)} / ${escapeHtml(item.unit || 'pcs')}
              </span>
            </div>
            ${item.notes ? `<div class="item-notes-text">📝 ${escapeHtml(item.notes)}</div>` : ''}
          </div>
        </div>

        <!-- Right: Stepper + Subtotal + Actions -->
        <div class="item-right-group">
          
          <!-- Stepper -->
          <div class="qty-stepper-box">
            <button class="btn-qty-step" onclick="updateItemQuantity('${item.id}', -1)" title="Kurangi">−</button>
            <span class="qty-number-display">${qty}</span>
            <button class="btn-qty-step" onclick="updateItemQuantity('${item.id}', 1)" title="Tambah">+</button>
          </div>

          <!-- Subtotal -->
          <div class="item-subtotal-box">
            <div class="subtotal-label">Subtotal:</div>
            <div class="subtotal-amount">${formatRupiah(subtotal)}</div>
          </div>

          <!-- Action Buttons (Edit & Delete) -->
          <div class="item-action-btns">
            <button class="btn-icon-action" onclick="openEditItemModal('${item.id}')" title="Edit Barang">
              <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
            </button>
            <button class="btn-icon-action danger" onclick="promptDeleteItem('${item.id}')" title="Hapus Barang">
              <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
            </button>
          </div>

        </div>

      </div>
    `;
  }).join('');
}

// ----------------------------------------------------------------------------
// 3. BUDGET SETTINGS VIEW
// ----------------------------------------------------------------------------
function renderBudgetSettings() {
  const inputBudget = document.getElementById('inputSettingBudget');
  const sliderCaution = document.getElementById('sliderCaution');
  const sliderDanger = document.getElementById('sliderDanger');

  if (inputBudget && document.activeElement !== inputBudget) {
    inputBudget.value = App.budget.budget_limit || 500000;
  }
  if (sliderCaution) sliderCaution.value = App.budget.alert_caution_percent || 75;
  if (sliderDanger) sliderDanger.value = App.budget.alert_danger_percent || 90;

  updateBudgetSliderLabels();
}

function updateBudgetSliderLabels() {
  const budgetVal = Number(document.getElementById('inputSettingBudget')?.value) || 500000;
  const cautionPct = Number(document.getElementById('sliderCaution')?.value) || 75;
  const dangerPct = Number(document.getElementById('sliderDanger')?.value) || 90;

  const lblCaution = document.getElementById('labelCautionVal');
  const lblDanger = document.getElementById('labelDangerVal');

  if (lblCaution) {
    const nominal = Math.round((cautionPct / 100) * budgetVal);
    lblCaution.textContent = `${cautionPct}% (${formatRupiah(nominal)})`;
  }
  if (lblDanger) {
    const nominal = Math.round((dangerPct / 100) * budgetVal);
    lblDanger.textContent = `${dangerPct}% (${formatRupiah(nominal)})`;
  }
}

// ----------------------------------------------------------------------------
// 4. SHOPPING HISTORY VIEW
// ----------------------------------------------------------------------------
function renderHistory() {
  const container = document.getElementById('historyTripsContainer');
  const elTotalTrips = document.getElementById('histTotalTrips');
  const elTotalSpend = document.getElementById('histTotalSpend');
  const elAvgSpend = document.getElementById('histAvgSpend');

  const trips = App.history || [];
  const totalCount = trips.length;
  const totalSpend = trips.reduce((acc, t) => acc + (Number(t.total_spent) || 0), 0);
  const avgSpend = totalCount > 0 ? Math.round(totalSpend / totalCount) : 0;

  if (elTotalTrips) elTotalTrips.textContent = `${totalCount} Sesi`;
  if (elTotalSpend) elTotalSpend.textContent = formatRupiah(totalSpend);
  if (elAvgSpend) elAvgSpend.textContent = formatRupiah(avgSpend);

  if (!container) return;

  if (trips.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="padding: 2.5rem 1rem;">
        <div class="empty-state-icon">
          <i data-lucide="receipt" style="width: 32px; height: 32px;"></i>
        </div>
        <h3>Belum Ada Riwayat Belanja</h3>
        <p>Setelah selesai berbelanja di kasir supermarket, klik tombol "Selesai Belanja / Kasir" untuk mencatat sesi ke riwayat dan otomatis memotong uang kas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = trips.map(trip => {
    const items = Array.isArray(trip.items_snapshot) ? trip.items_snapshot : [];

    return `
      <div class="history-trip-card">
        <div class="trip-card-header">
          <div>
            <div class="trip-store-title">
              <i data-lucide="store" style="width: 18px; height: 18px; color: var(--primary-600);"></i>
              <span>${escapeHtml(trip.store_name || 'Supermarket')}</span>
            </div>
            <div class="trip-date-badge">
              <i data-lucide="calendar" style="width: 13px; height: 13px; display: inline-block;"></i>
              ${formatDateIndo(trip.completed_at)}
            </div>
          </div>
          <div class="trip-amount-badge">
            <div class="trip-amount-number">${formatRupiah(trip.total_spent)}</div>
            <div class="trip-items-count">${trip.items_count || items.length} Barang Dibeli</div>
            ${trip.cash_before !== undefined && trip.cash_after !== undefined ? `
              <div style="font-size: 0.72rem; color: #059669; font-weight: 700; margin-top: 3px;">
                💵 Kas: ${formatRupiah(trip.cash_before)} ➔ ${formatRupiah(trip.cash_after)}
              </div>
            ` : ''}
          </div>
        </div>

        ${items.length > 0 ? `
          <div class="trip-snapshot-items">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Rincian Barang:</div>
            ${items.map(it => `
              <div class="snapshot-item-row">
                <span>• ${escapeHtml(it.name)} (${it.qty || it.quantity || 1} ${escapeHtml(it.unit || 'pcs')})</span>
                <b>${formatRupiah((it.qty || it.quantity || 1) * (it.price || 0))}</b>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ============================================================================
// CRUD OPERATIONS (ITEMS)
// ============================================================================
async function toggleItemPurchased(itemId) {
  const item = App.items.find(i => i.id === itemId);
  if (!item) return;

  const nextStatus = !item.is_purchased;
  item.is_purchased = nextStatus;
  renderAllViews();

  try {
    await api(`/api/grocery/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_purchased: nextStatus })
    });
    showToast(`Barang ditandai ${nextStatus ? 'sudah dibeli' : 'belum dibeli'}.`, 'success');
  } catch (err) {
    item.is_purchased = !nextStatus;
    renderAllViews();
    showToast(err.message, 'error');
  }
}

async function updateItemQuantity(itemId, delta) {
  const item = App.items.find(i => i.id === itemId);
  if (!item) return;

  const currentQty = Number(item.quantity) || 1;
  const nextQty = Math.max(0.1, Number((currentQty + delta).toFixed(2)));

  if (nextQty === currentQty) return;

  item.quantity = nextQty;
  renderAllViews();

  try {
    await api(`/api/grocery/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: nextQty })
    });
  } catch (err) {
    item.quantity = currentQty;
    renderAllViews();
    showToast(err.message, 'error');
  }
}

function openAddItemModal() {
  document.getElementById('modalItemTitle').textContent = 'Tambah Barang ke Daftar';
  document.getElementById('itemFormId').value = '';
  document.getElementById('inputItemName').value = '';
  document.getElementById('selectItemCategory').value = 'Fruits & Vegetables';
  document.getElementById('selectItemUnit').value = 'pcs';
  document.getElementById('inputItemQty').value = '1';
  document.getElementById('inputItemPrice').value = '';
  document.getElementById('inputItemNotes').value = '';
  
  updateModalSubtotalPreview();
  document.getElementById('itemModalBackdrop').classList.add('active');
  setTimeout(() => document.getElementById('inputItemName').focus(), 150);
}

function openEditItemModal(itemId) {
  const item = App.items.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('modalItemTitle').textContent = 'Edit Informasi Barang';
  document.getElementById('itemFormId').value = item.id;
  document.getElementById('inputItemName').value = item.name || '';
  document.getElementById('selectItemCategory').value = item.category || 'Fruits & Vegetables';
  document.getElementById('selectItemUnit').value = item.unit || 'pcs';
  document.getElementById('inputItemQty').value = item.quantity || 1;
  document.getElementById('inputItemPrice').value = item.price || 0;
  document.getElementById('inputItemNotes').value = item.notes || '';

  updateModalSubtotalPreview();
  document.getElementById('itemModalBackdrop').classList.add('active');
  setTimeout(() => document.getElementById('inputItemName').focus(), 150);
}

function closeItemModal() {
  document.getElementById('itemModalBackdrop').classList.remove('active');
}

function updateModalSubtotalPreview() {
  const qty = parseFloat(document.getElementById('inputItemQty')?.value) || 1;
  const price = parseFloat(document.getElementById('inputItemPrice')?.value) || 0;
  const unit = document.getElementById('selectItemUnit')?.value || 'pcs';
  const subtotal = qty * price;

  const formulaEl = document.getElementById('modalFormulaPreview');
  const subtotalEl = document.getElementById('modalSubtotalPreview');

  if (formulaEl) formulaEl.textContent = `${qty} ${unit} × ${formatRupiah(price)}`;
  if (subtotalEl) subtotalEl.textContent = formatRupiah(subtotal);
}

async function handleSaveItemForm(e) {
  e.preventDefault();
  
  const id = document.getElementById('itemFormId').value.trim();
  const name = document.getElementById('inputItemName').value.trim();
  const category = document.getElementById('selectItemCategory').value;
  const unit = document.getElementById('selectItemUnit').value;
  const quantity = parseFloat(document.getElementById('inputItemQty').value) || 1;
  const price = parseFloat(document.getElementById('inputItemPrice').value) || 0;
  const notes = document.getElementById('inputItemNotes').value.trim();

  if (!name) {
    showToast('Nama barang wajib diisi!', 'warning');
    return;
  }

  const payload = { name, category, unit, quantity, price, notes };

  try {
    if (id) {
      const res = await api(`/api/grocery/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const idx = App.items.findIndex(i => i.id === id);
      if (idx !== -1) App.items[idx] = res.item;
      showToast('Barang berhasil diperbarui!', 'success');
    } else {
      const res = await api('/api/grocery/items', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      App.items.unshift(res.item);
      showToast('Barang baru berhasil ditambahkan!', 'success');
    }

    closeItemModal();
    renderAllViews();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// DELETE CONFIRMATION DIALOG
// ----------------------------------------------------------------------------
function promptDeleteItem(itemId) {
  const item = App.items.find(i => i.id === itemId);
  if (!item) return;

  App.itemToDelete = item;
  const promptTitle = document.getElementById('deleteItemPromptTitle');
  const promptDesc = document.getElementById('deleteItemPromptDesc');

  if (promptTitle) promptTitle.textContent = `Hapus "${item.name}"?`;
  if (promptDesc) {
    promptDesc.textContent = `Apakah Anda yakin ingin menghapus "${item.name}" dari daftar belanja? Tindakan ini tidak dapat dibatalkan.`;
  }

  document.getElementById('deleteConfirmBackdrop').classList.add('active');
}

function closeDeleteModal() {
  App.itemToDelete = null;
  document.getElementById('deleteConfirmBackdrop').classList.remove('active');
}

async function handleConfirmDelete() {
  if (!App.itemToDelete) return;
  const itemId = App.itemToDelete.id;
  const itemName = App.itemToDelete.name;

  try {
    await api(`/api/grocery/items/${itemId}`, { method: 'DELETE' });
    App.items = App.items.filter(i => i.id !== itemId);
    closeDeleteModal();
    renderAllViews();
    showToast(`Barang "${itemName}" berhasil dihapus.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================================
// WALLET MANAGEMENT (UANG BELANJA YANG DIPEGANG)
// ============================================================================
function openWalletModal() {
  const currentCash = Number(App.wallet?.current_cash) || 500000;
  const totalCartCost = App.items.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);

  const displayEl = document.getElementById('modalWalletCurrentCashDisplay');
  const spentEl = document.getElementById('modalWalletSpentDisplay');
  const inputEl = document.getElementById('inputWalletAmount');

  if (displayEl) displayEl.textContent = formatRupiah(currentCash);
  if (spentEl) spentEl.textContent = `Terpakai Belanja: ${formatRupiah(totalCartCost)}`;
  if (inputEl) inputEl.value = currentCash;

  setWalletModalMode('set');
  document.getElementById('walletModalBackdrop')?.classList.add('active');
  setTimeout(() => inputEl?.focus(), 150);
}

function closeWalletModal() {
  document.getElementById('walletModalBackdrop')?.classList.remove('active');
}

function setWalletModalMode(mode) {
  walletModalMode = mode;
  const btnSet = document.getElementById('btnWalletTabSet');
  const btnAdd = document.getElementById('btnWalletTabAdd');
  const labelInput = document.getElementById('labelWalletInput');
  const inputEl = document.getElementById('inputWalletAmount');

  if (mode === 'set') {
    btnSet?.classList.add('active');
    btnAdd?.classList.remove('active');
    if (labelInput) labelInput.textContent = 'Nominal Uang Belanja yang Dipegang Sekarang (Rp) *';
    if (inputEl) inputEl.value = Number(App.wallet?.current_cash) || 500000;
  } else {
    btnSet?.classList.remove('active');
    btnAdd?.classList.add('active');
    if (labelInput) labelInput.textContent = 'Nominal Uang Kas yang Ditambahkan / Top Up (Rp) *';
    if (inputEl) inputEl.value = 100000;
  }
}

async function handleSaveWalletModal() {
  const amount = parseFloat(document.getElementById('inputWalletAmount')?.value) || 0;
  if (amount <= 0 && walletModalMode === 'add') {
    showToast('Masukkan nominal uang yang valid!', 'warning');
    return;
  }

  const payload = walletModalMode === 'set' ? { set_cash: amount } : { add_cash: amount };

  try {
    const res = await api('/api/grocery/wallet', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.wallet) {
      App.wallet = res.wallet;
    }

    closeWalletModal();
    renderAllViews();
    showToast(`Uang belanja yang dipegang berhasil diatur ke ${formatRupiah(App.wallet.current_cash)}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================
async function handleSaveBudgetSettings() {
  const budgetLimit = parseFloat(document.getElementById('inputSettingBudget').value) || 500000;
  const caution = parseInt(document.getElementById('sliderCaution').value, 10) || 75;
  const danger = parseInt(document.getElementById('sliderDanger').value, 10) || 90;

  try {
    const res = await api('/api/grocery/budget', {
      method: 'PUT',
      body: JSON.stringify({
        budget_limit: budgetLimit,
        alert_caution_percent: caution,
        alert_danger_percent: danger
      })
    });

    App.budget = res.budget;
    renderAllViews();
    showToast('Pengaturan batas anggaran berhasil disimpan!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================================
// CHECKOUT & SHOPPING HISTORY (WITH AUTOMATIC CASH DEDUCTION)
// ============================================================================
function openCheckoutModal() {
  if (App.items.length === 0) {
    showToast('Keranjang belanja Anda masih kosong.', 'warning');
    return;
  }

  const totalCost = App.items.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);
  const currentCash = Number(App.wallet.current_cash) || 0;
  const remainingCash = currentCash - totalCost;

  document.getElementById('checkoutTotalCount').textContent = `${App.items.length} Item`;
  document.getElementById('checkoutCashBefore').textContent = formatRupiah(currentCash);
  document.getElementById('checkoutTotalSpent').textContent = `- ${formatRupiah(totalCost)}`;
  
  const cashAfterEl = document.getElementById('checkoutCashAfter');
  if (cashAfterEl) {
    cashAfterEl.textContent = formatRupiah(Math.max(0, remainingCash));
    cashAfterEl.style.color = remainingCash >= 0 ? 'var(--primary-600)' : 'var(--accent-rose)';
  }

  document.getElementById('checkoutModalBackdrop').classList.add('active');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModalBackdrop').classList.remove('active');
}

async function handleConfirmCheckout() {
  const totalCost = App.items.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.price) || 0), 0);
  const storeName = document.getElementById('checkoutStoreName').value.trim() || 'Supermarket';
  const clearCart = document.getElementById('checkClearCartAfter').checked;

  const itemsSnapshot = App.items.map(it => ({
    name: it.name,
    qty: it.quantity,
    unit: it.unit,
    price: it.price,
    category: it.category
  }));

  try {
    const res = await api('/api/grocery/history', {
      method: 'POST',
      body: JSON.stringify({
        store_name: storeName,
        total_spent: totalCost,
        items_snapshot: itemsSnapshot,
        clear_cart: clearCart,
        mark_all_purchased: !clearCart
      })
    });

    if (!App.history) App.history = [];
    App.history.unshift(res.trip);

    // Otomatis update uang kas di state!
    if (res.wallet) {
      App.wallet = res.wallet;
    }

    if (clearCart) {
      App.items = [];
    } else {
      App.items.forEach(it => it.is_purchased = true);
    }

    closeCheckoutModal();
    renderAllViews();
    showToast(`🎉 Pembayaran di ${storeName} berhasil! Uang kas otomatis terpotong menjadi ${formatRupiah(App.wallet.current_cash)}.`, 'success');

    // Beralih ke tab riwayat
    switchTab('tabHistory');
  } catch (err) {
    showToast(err.message, 'error');
  }
}



// ============================================================================
// TAB NAVIGATION
// ============================================================================
function switchTab(tabId) {
  App.activeTab = tabId;

  document.querySelectorAll('.tab-content-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });

  document.querySelectorAll('.nav-tab-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  if (window.lucide) window.lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================================
async function initApp() {
  console.log('🚀 Initializing Smart Grocery Tracker...');

  // Setup Tab Navigation Listeners
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  document.getElementById('brandHomeLink')?.addEventListener('click', () => switchTab('tabDashboard'));

  // Quick Action Buttons in Dashboard
  document.getElementById('btnDashQuickAdd')?.addEventListener('click', openAddItemModal);
  document.getElementById('btnDashGoShopping')?.addEventListener('click', () => switchTab('tabShoppingList'));
  document.getElementById('btnDashEditBudget')?.addEventListener('click', () => switchTab('tabBudget'));

  // Wallet Modal Triggers
  document.getElementById('btnOpenWalletModal')?.addEventListener('click', openWalletModal);
  document.getElementById('btnShopQuickWallet')?.addEventListener('click', openWalletModal);
  document.getElementById('btnCloseWalletModal')?.addEventListener('click', closeWalletModal);
  document.getElementById('btnCancelWalletModal')?.addEventListener('click', closeWalletModal);
  document.getElementById('btnSaveWalletModal')?.addEventListener('click', handleSaveWalletModal);

  document.getElementById('btnWalletTabSet')?.addEventListener('click', () => setWalletModalMode('set'));
  document.getElementById('btnWalletTabAdd')?.addEventListener('click', () => setWalletModalMode('add'));

  document.querySelectorAll('[data-walletpreset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.walletpreset;
      const input = document.getElementById('inputWalletAmount');
      if (input && preset) {
        input.value = preset;
      }
    });
  });

  // Shopping List Search & Filter Listeners
  const searchInput = document.getElementById('searchItemInput');
  searchInput?.addEventListener('input', (e) => {
    App.filter.search = e.target.value;
    renderShoppingList();
    if (window.lucide) window.lucide.createIcons();
  });

  document.querySelectorAll('.filter-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.filter.category = btn.dataset.cat;
      renderShoppingList();
      if (window.lucide) window.lucide.createIcons();
    });
  });

  document.querySelectorAll('.status-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.filter.status = btn.dataset.status;
      renderShoppingList();
      if (window.lucide) window.lucide.createIcons();
    });
  });

  // Item Modal Listeners
  document.getElementById('btnOpenAddModal')?.addEventListener('click', openAddItemModal);
  document.getElementById('btnEmptyAdd')?.addEventListener('click', openAddItemModal);
  document.getElementById('btnDockAdd')?.addEventListener('click', openAddItemModal);
  document.getElementById('btnCloseItemModal')?.addEventListener('click', closeItemModal);
  document.getElementById('btnCancelItemModal')?.addEventListener('click', closeItemModal);
  document.getElementById('formGroceryItem')?.addEventListener('submit', handleSaveItemForm);

  const inputQty = document.getElementById('inputItemQty');
  const inputPrice = document.getElementById('inputItemPrice');
  const selectUnit = document.getElementById('selectItemUnit');
  inputQty?.addEventListener('input', updateModalSubtotalPreview);
  inputPrice?.addEventListener('input', updateModalSubtotalPreview);
  selectUnit?.addEventListener('change', updateModalSubtotalPreview);

  document.getElementById('btnModalQtyDec')?.addEventListener('click', () => {
    const cur = parseFloat(inputQty.value) || 1;
    inputQty.value = Math.max(0.1, Number((cur - 1).toFixed(2)));
    updateModalSubtotalPreview();
  });
  document.getElementById('btnModalQtyInc')?.addEventListener('click', () => {
    const cur = parseFloat(inputQty.value) || 1;
    inputQty.value = Number((cur + 1).toFixed(2));
    updateModalSubtotalPreview();
  });

  document.querySelectorAll('[data-addqty]').forEach(btn => {
    btn.addEventListener('click', () => {
      const add = parseFloat(btn.dataset.addqty) || 1;
      const cur = parseFloat(inputQty.value) || 0;
      inputQty.value = Number((cur + add).toFixed(2));
      updateModalSubtotalPreview();
    });
  });

  // Delete Modal Listeners
  document.getElementById('btnCancelDelete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btnCancelDeleteX')?.addEventListener('click', closeDeleteModal);
  document.getElementById('btnConfirmDelete')?.addEventListener('click', handleConfirmDelete);

  // Checkout Modal Listeners
  document.getElementById('btnOpenCheckoutModal')?.addEventListener('click', openCheckoutModal);
  document.getElementById('btnDockCheckout')?.addEventListener('click', openCheckoutModal);
  document.getElementById('btnCloseCheckoutModal')?.addEventListener('click', closeCheckoutModal);
  document.getElementById('btnCancelCheckout')?.addEventListener('click', closeCheckoutModal);
  document.getElementById('btnConfirmCheckout')?.addEventListener('click', handleConfirmCheckout);

  // Budget Settings Listeners
  document.getElementById('btnSaveBudgetSettings')?.addEventListener('click', handleSaveBudgetSettings);
  document.getElementById('inputSettingBudget')?.addEventListener('input', updateBudgetSliderLabels);
  document.getElementById('sliderCaution')?.addEventListener('input', updateBudgetSliderLabels);
  document.getElementById('sliderDanger')?.addEventListener('input', updateBudgetSliderLabels);

  document.querySelectorAll('.preset-budget-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset) {
        document.getElementById('inputSettingBudget').value = preset;
        updateBudgetSliderLabels();
      }
    });
  });



  // Device Settings Modal Listeners
  document.getElementById('userProfileBadge')?.addEventListener('click', openDeviceModal);
  document.getElementById('btnDeviceSettings')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openDeviceModal();
  });
  document.getElementById('btnCloseDeviceModal')?.addEventListener('click', closeDeviceModal);
  document.getElementById('btnCancelDeviceModal')?.addEventListener('click', closeDeviceModal);
  document.getElementById('btnSaveDeviceModal')?.addEventListener('click', handleSaveDeviceName);
  document.getElementById('btnResetDeviceData')?.addEventListener('click', handleResetDeviceData);

  // ==========================================================================
  // INITIALIZE APPLICATION DIRECTLY (NO LOGIN REQUIRED - 100% DISTINCT PER DEVICE)
  // ==========================================================================
  ensureDeviceId();
  initRealtimeSync();
  await fetchAllData();
  renderAllViews();

  if (window.lucide) window.lucide.createIcons();
}

// Device Modal Actions
function openDeviceModal() {
  const backdrop = document.getElementById('deviceModalBackdrop');
  const inputName = document.getElementById('inputDeviceName');
  const displayId = document.getElementById('displayDeviceId');
  if (inputName) inputName.value = (App.currentUser && App.currentUser.name) || '';
  if (displayId) displayId.value = App.deviceId || localStorage.getItem('sgt_device_id') || '';
  if (backdrop) backdrop.classList.add('active');
  if (window.lucide) window.lucide.createIcons();
}

function closeDeviceModal() {
  document.getElementById('deviceModalBackdrop')?.classList.remove('active');
}

async function handleSaveDeviceName() {
  const input = document.getElementById('inputDeviceName');
  const newName = input ? input.value.trim() : '';
  if (!newName) {
    showToast('Nama perangkat tidak boleh kosong.', 'warning');
    return;
  }
  localStorage.setItem('sgt_device_name', newName);
  if (App.currentUser) App.currentUser.name = newName;
  try {
    await api('/api/device/profile', {
      method: 'PUT',
      body: JSON.stringify({ name: newName })
    });
  } catch (e) {
    // Local update is already saved
  }
  renderHeaderUser();
  closeDeviceModal();
  showToast(`Nama perangkat disimpan: ${newName}`, 'success');
}

function handleResetDeviceData() {
  if (confirm('Apakah Anda yakin ingin membuat profil perangkat baru? Perangkat ini akan mendapatkan daftar belanja dan dompet kas baru yang terpisah.')) {
    const newId = 'dev_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
    localStorage.setItem('sgt_device_id', newId);
    localStorage.removeItem('sgt_device_name');
    location.reload();
  }
}

// Expose functions globally for HTML event handlers
window.toggleItemPurchased = toggleItemPurchased;
window.updateItemQuantity = updateItemQuantity;
window.openEditItemModal = openEditItemModal;
window.promptDeleteItem = promptDeleteItem;
window.switchTab = switchTab;
window.openWalletModal = openWalletModal;
window.openDeviceModal = openDeviceModal;

document.addEventListener('DOMContentLoaded', initApp);
