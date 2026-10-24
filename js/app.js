/**
 * Smart Grocery & Budget Safety Tracker
 * app.js – Complete Frontend Controller
 *
 * Features:
 *  - No login: Device ID auto-created, stored in localStorage
 *  - Firebase Firestore cloud sync (each device gets its own document)
 *  - Budget safety tracker with gauge + zone alerts
 *  - Wallet: "Uang yang dipegang" with auto-deduct on checkout
 *  - Shopping list CRUD with categories + search + filter
 *  - Shopping history per session
 *  - PWA-ready (offline-first via localStorage cache)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const State = {
  deviceId: '',
  deviceName: '',
  items: [],       // { id, name, qty, unit, price, category, notes, purchased, createdAt }
  settings: {
    budgetLimit:    500000,
    cautionPct:     75,
    dangerPct:      90,
  },
  wallet: {
    initial: 500000,
    current: 500000,
  },
  history: [],     // { id, store, total, walletBefore, walletAfter, items, date }
  activeTab: 'Belanja',
  filterCat: 'all',
  filterStatus: 'all',
  searchQ: '',
  editingItemId: null,
  deletingItemId: null,
  walletMode: 'set',  // 'set' | 'add' | 'sub'
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE IDENTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
function initDevice() {
  let id = localStorage.getItem('sgt_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    localStorage.setItem('sgt_device_id', id);
  }
  State.deviceId = id;

  let name = localStorage.getItem('sgt_device_name');
  if (!name) {
    const ua = navigator.userAgent;
    if (/android/i.test(ua))         name = 'HP Android';
    else if (/iphone|ipad/i.test(ua)) name = 'iPhone/iPad';
    else if (/windows/i.test(ua))     name = 'Laptop Windows';
    else if (/mac/i.test(ua))         name = 'MacBook';
    else                               name = 'Perangkat';
    name += ' (' + id.slice(-4).toUpperCase() + ')';
    localStorage.setItem('sgt_device_name', name);
  }
  State.deviceName = name;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE CACHE
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = () => `sgt_data_${State.deviceId}`;

function saveLocal() {
  const payload = {
    items:    State.items,
    settings: State.settings,
    wallet:   State.wallet,
    history:  State.history,
  };
  localStorage.setItem(STORAGE_KEY(), JSON.stringify(payload));
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY());
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (d.items)    State.items    = d.items;
    if (d.settings) State.settings = Object.assign(State.settings, d.settings);
    if (d.wallet)   State.wallet   = Object.assign(State.wallet, d.wallet);
    if (d.history)  State.history  = d.history;
    return true;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE SYNC
// ─────────────────────────────────────────────────────────────────────────────
let _fbReady = false;
let _fbUnsubscribe = null;
let _pendingSync = false;
let _receivingRemote = false;

function initFirebase() {
  const db = window._firestore;
  if (!db) { setSyncStatus('offline'); return; }

  _fbReady = true;
  setSyncStatus('syncing');

  const docRef = window._firestoreDoc(db, 'grocery_devices', State.deviceId);

  // Listen to real-time updates
  _fbUnsubscribe = window._firestoreSnapshot(docRef, (snap) => {
    if (_receivingRemote) return;
    if (snap.exists()) {
      _receivingRemote = true;
      try {
        const d = snap.data();
        if (d.items)    State.items    = d.items;
        if (d.settings) State.settings = Object.assign({}, State.settings, d.settings);
        if (d.wallet)   State.wallet   = Object.assign({}, State.wallet, d.wallet);
        if (d.history)  State.history  = d.history;
        saveLocal();
        renderAll();
        setSyncStatus('connected');
      } finally {
        _receivingRemote = false;
      }
    } else {
      // First time this device – push local data up
      pushToCloud();
    }
  }, (err) => {
    console.warn('[Firebase]', err.message);
    setSyncStatus('offline');
  });

  window.addEventListener('online',  () => { setSyncStatus('connected'); pushToCloud(); });
  window.addEventListener('offline', () => setSyncStatus('offline'));
}

function pushToCloud() {
  if (!_fbReady || _receivingRemote) return;
  const db = window._firestore;
  if (!db) { saveLocal(); return; }

  setSyncStatus('syncing');
  const docRef = window._firestoreDoc(db, 'grocery_devices', State.deviceId);
  const payload = {
    items:     State.items,
    settings:  State.settings,
    wallet:    State.wallet,
    history:   State.history,
    updatedAt: new Date().toISOString(),
    deviceName: State.deviceName,
  };

  window._firestoreSet(docRef, payload, { merge: true })
    .then(() => setSyncStatus('connected'))
    .catch(err => { console.warn('[Firebase push]', err.message); setSyncStatus('offline'); });
}

function saveAndSync() {
  saveLocal();
  if (_pendingSync) return;
  _pendingSync = true;
  setTimeout(() => {
    pushToCloud();
    _pendingSync = false;
  }, 800);
}

function setSyncStatus(status) {
  const badge = document.getElementById('syncBadge');
  const text  = document.getElementById('syncText');
  if (!badge || !text) return;
  badge.className = 'sync-badge ' + status;
  const labels = { connected: 'Sinkron', syncing: 'Menyimpan...', offline: 'Offline' };
  text.textContent = labels[status] || status;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────
function rp(n) {
  return 'Rp\u00a0' + new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0));
}

function fmtDate(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────
function totalCart() {
  return State.items.reduce((s, i) => s + (i.qty * i.price), 0);
}

function totalPurchased() {
  return State.items.filter(i => i.purchased).reduce((s, i) => s + (i.qty * i.price), 0);
}

function totalUnpurchased() {
  return State.items.filter(i => !i.purchased).reduce((s, i) => s + (i.qty * i.price), 0);
}

function budgetPct() {
  if (!State.settings.budgetLimit) return 0;
  return Math.min((totalCart() / State.settings.budgetLimit) * 100, 999);
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY META
// ─────────────────────────────────────────────────────────────────────────────
const CAT_META = {
  'Makanan & Minuman': { icon: 'utensils',    color: '#f59e0b' },
  'Sayur & Buah':      { icon: 'leaf',         color: '#10b981' },
  'Daging & Protein':  { icon: 'beef',         color: '#ef4444' },
  'Susu & Telur':      { icon: 'egg',          color: '#f97316' },
  'Bumbu & Rempah':    { icon: 'flame',        color: '#dc2626' },
  'Kebersihan':        { icon: 'sparkles',     color: '#3b82f6' },
  'Lainnya':           { icon: 'package',      color: '#8b5cf6' },
};

function catIcon(cat) {
  return (CAT_META[cat] || CAT_META['Lainnya']).icon;
}
function catColor(cat) {
  return (CAT_META[cat] || CAT_META['Lainnya']).color;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
function toast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: 'check-circle',
    error:   'x-circle',
    warning: 'alert-triangle',
    info:    'info',
  };

  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
  container.appendChild(t);
  lucide.createIcons({ nodes: [t] });

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-8px)';
    t.style.transition = '.3s ease';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: ALL
// ─────────────────────────────────────────────────────────────────────────────
function renderAll() {
  renderWalletHero();
  renderBudgetSafetyBar();
  renderItemList();
  renderCheckoutBar();
  renderBudgetTab();
  renderHistoryTab();
  updateNavBadge();
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: WALLET HERO
// ─────────────────────────────────────────────────────────────────────────────
function renderWalletHero() {
  const cart   = totalCart();
  const remain = State.wallet.current - cart;

  setText('walletCurrentAmount', rp(State.wallet.current));
  setText('walletSubText', `Sisa dari ${rp(State.wallet.initial)} awal`);
  setText('walletCartTotal', rp(cart));

  const remEl = document.getElementById('walletRemainder');
  if (remEl) {
    remEl.textContent = rp(remain);
    remEl.className = 'wallet-stat-value ' + (remain < 0 ? 'over' : 'safe');
  }
  setText('walletItemCount', State.items.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: BUDGET SAFETY BAR (always visible)
// ─────────────────────────────────────────────────────────────────────────────
function renderBudgetSafetyBar() {
  const pct    = budgetPct();
  const cart   = totalCart();
  const limit  = State.settings.budgetLimit;
  const fill   = document.getElementById('bsbFill');
  const amount = document.getElementById('bsbAmount');

  if (!fill || !amount) return;

  const displayPct = Math.min(pct, 100);
  fill.style.width = displayPct + '%';

  // Zone color
  fill.className = 'bsb-fill';
  if (pct >= State.settings.dangerPct)   fill.classList.add('zone-danger');
  else if (pct >= State.settings.cautionPct) fill.classList.add('zone-caution');
  else if (pct >= 100) fill.classList.add('zone-over');

  amount.textContent = `${rp(cart)} / ${rp(limit)}`;
  amount.className = 'bsb-amount ' + (pct >= State.settings.dangerPct ? 'danger' : '');
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: ITEM LIST
// ─────────────────────────────────────────────────────────────────────────────
function renderItemList() {
  const container = document.getElementById('itemList');
  if (!container) return;

  let items = [...State.items];

  // Search filter
  if (State.searchQ) {
    const q = State.searchQ.toLowerCase();
    items = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.notes || '').toLowerCase().includes(q)
    );
  }

  // Category filter
  if (State.filterCat !== 'all') {
    items = items.filter(i => i.category === State.filterCat);
  }

  // Status filter
  if (State.filterStatus === 'purchased')   items = items.filter(i => i.purchased);
  if (State.filterStatus === 'unpurchased') items = items.filter(i => !i.purchased);

  // Sort: unpurchased first, then by creation
  items.sort((a, b) => {
    if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="shopping-basket"></i>
        <h3>Keranjang Kosong</h3>
        <p>Tekan tombol <strong>+</strong> untuk menambah barang belanjaan</p>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  container.innerHTML = items.map(item => {
    const subtotal = item.qty * item.price;
    const color = catColor(item.category);
    return `
      <div class="item-card ${item.purchased ? 'purchased' : ''}" data-id="${item.id}">
        <button class="item-check ${item.purchased ? 'checked' : ''}"
                onclick="togglePurchased('${item.id}')" aria-label="Tandai dibeli">
          <i data-lucide="check"></i>
        </button>
        <div class="item-body">
          <div class="item-name">${escHtml(item.name)}</div>
          <div class="item-meta">
            <span class="item-cat-badge" style="background:${color}18; color:${color};">${escHtml(item.category)}</span>
            <span class="item-qty">${item.qty} ${escHtml(item.unit)}</span>
            ${item.notes ? `<span class="item-qty">· ${escHtml(item.notes)}</span>` : ''}
          </div>
        </div>
        <div class="item-actions">
          <div class="item-price">${rp(item.price)}</div>
          <div class="item-subtotal">${item.qty > 1 ? `Total: ${rp(subtotal)}` : ''}</div>
          <div style="display:flex; gap:5px; margin-top:4px;">
            <button class="item-action-btn btn-edit" onclick="openEditItem('${item.id}')" title="Edit">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="item-action-btn btn-delete" onclick="confirmDelete('${item.id}', '${escHtml(item.name)}')" title="Hapus">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: CHECKOUT BAR
// ─────────────────────────────────────────────────────────────────────────────
function renderCheckoutBar() {
  const bar = document.getElementById('checkoutBar');
  if (!bar) return;

  const purchasedItems = State.items.filter(i => i.purchased);
  if (purchasedItems.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const total = purchasedItems.reduce((s, i) => s + i.qty * i.price, 0);
  setText('checkoutTotalDisplay', rp(total));
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: BUDGET TAB
// ─────────────────────────────────────────────────────────────────────────────
function renderBudgetTab() {
  const pct    = budgetPct();
  const cart   = totalCart();
  const limit  = State.settings.budgetLimit;

  setText('budgetLimitDisplay', rp(limit));

  // Gauge
  const gaugeFill = document.getElementById('budgetGaugeFill');
  if (gaugeFill) {
    const w = Math.min(pct, 100);
    gaugeFill.style.width = w + '%';
    gaugeFill.className = 'budget-gauge-fill';
    if (pct >= 100)                         gaugeFill.classList.add('over');
    else if (pct >= State.settings.dangerPct)   gaugeFill.classList.add('danger');
    else if (pct >= State.settings.cautionPct)  gaugeFill.classList.add('caution');
  }

  setText('budgetPctLabel',  pct.toFixed(1) + '% terpakai');
  setText('budgetSpentLabel', `${rp(cart)} dari ${rp(limit)}`);

  // Sync inputs only when not being actively edited by user
  const blInp = document.getElementById('budgetLimitInput');
  const bcInp = document.getElementById('budgetCautionInput');
  const bdInp = document.getElementById('budgetDangerInput');
  if (blInp && document.activeElement !== blInp) setVal('budgetLimitInput', limit);
  if (bcInp && document.activeElement !== bcInp) setVal('budgetCautionInput', State.settings.cautionPct);
  if (bdInp && document.activeElement !== bdInp) setVal('budgetDangerInput', State.settings.dangerPct);

  // Category breakdown
  renderCategoryBreakdown();
}

function renderCategoryBreakdown() {
  const container = document.getElementById('catBreakdown');
  if (!container) return;

  const totals = {};
  State.items.forEach(i => {
    if (!totals[i.category]) totals[i.category] = 0;
    totals[i.category] += i.qty * i.price;
  });

  const total = totalCart();
  const cats  = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);

  if (cats.length === 0) {
    container.innerHTML = `<p style="color: var(--c-muted); font-size: 13px; text-align: center; padding: 20px 0;">Belum ada barang di keranjang</p>`;
    return;
  }

  container.innerHTML = cats.map(cat => {
    const pct  = total > 0 ? (totals[cat] / total * 100) : 0;
    const color = catColor(cat);
    return `
      <div class="cat-item">
        <div class="cat-item-header">
          <div class="cat-item-name">
            <i data-lucide="${catIcon(cat)}" style="color:${color};"></i>
            ${escHtml(cat)}
          </div>
          <div class="cat-item-amount">${rp(totals[cat])}</div>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct.toFixed(1)}%; background:${color};"></div>
        </div>
      </div>`;
  }).join('');

  lucide.createIcons({ nodes: [container] });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: HISTORY TAB
// ─────────────────────────────────────────────────────────────────────────────
function renderHistoryTab() {
  const trips   = State.history;
  const totalSp = trips.reduce((s, t) => s + (t.total || 0), 0);
  const avg     = trips.length > 0 ? totalSp / trips.length : 0;

  setText('histTotalTrips',  trips.length);
  setText('histTotalSpent',  rp(totalSp));
  setText('histAvgSpend',    rp(avg));

  const container = document.getElementById('tripList');
  if (!container) return;

  if (trips.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="receipt"></i>
        <h3>Belum Ada Riwayat</h3>
        <p>Riwayat akan muncul setelah kamu menyelesaikan belanja (kasir)</p>
      </div>`;
    lucide.createIcons({ nodes: [container] });
    return;
  }

  const sorted = [...trips].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = sorted.map(trip => `
    <div class="trip-card">
      <div class="trip-card-header" onclick="toggleTripDetail('${trip.id}')">
        <div>
          <div class="trip-store">${escHtml(trip.store || 'Tidak diketahui')}</div>
          <div class="trip-date">${fmtDate(trip.date)}</div>
        </div>
        <div>
          <div class="trip-total">${rp(trip.total)}</div>
          <div class="trip-items-count">${(trip.items || []).length} item(s)</div>
        </div>
      </div>
      <div class="trip-items-detail" id="tripDetail_${trip.id}">
        ${(trip.items || []).map(it => `
          <div class="trip-item-row">
            <span class="trip-item-name">${escHtml(it.name)} (${it.qty} ${it.unit})</span>
            <span class="trip-item-price">${rp(it.qty * it.price)}</span>
          </div>`).join('')}
        <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top: 1px solid var(--c-border);">
          <span style="font-size:12px; color:var(--c-muted); font-weight:600;">Uang sebelum: ${rp(trip.walletBefore)}</span>
          <span style="font-size:12px; color:var(--c-primary-dark); font-weight:700;">Sisa: ${rp(trip.walletAfter)}</span>
        </div>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER: NAV BADGE
// ─────────────────────────────────────────────────────────────────────────────
function updateNavBadge() {
  const count = State.items.filter(i => !i.purchased).length;
  const badge = document.getElementById('navBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM CRUD
// ─────────────────────────────────────────────────────────────────────────────
function generateId() {
  return 'item_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function openAddItem() {
  State.editingItemId = null;
  setText('itemModalTitle', 'Tambah Barang');
  setVal('itemEditId', '');
  setVal('itemName', '');
  setVal('itemQty', 1);
  setVal('itemUnit', 'pcs');
  setVal('itemPrice', '');
  setVal('itemCategory', 'Makanan & Minuman');
  setVal('itemNotes', '');
  setText('itemSubtotalPreview', 'Rp 0');
  openModal('itemModal');
  setTimeout(() => document.getElementById('itemName')?.focus(), 350);
}

function openEditItem(id) {
  const item = State.items.find(i => i.id === id);
  if (!item) return;
  State.editingItemId = id;
  setText('itemModalTitle', 'Edit Barang');
  setVal('itemEditId', id);
  setVal('itemName', item.name);
  setVal('itemQty', item.qty);
  setVal('itemUnit', item.unit);
  setVal('itemPrice', item.price);
  setVal('itemCategory', item.category);
  setVal('itemNotes', item.notes || '');
  setText('itemSubtotalPreview', rp(item.qty * item.price));
  openModal('itemModal');
}

function saveItem() {
  const name  = (getVal('itemName') || '').trim();
  const qty   = parseFloat(getVal('itemQty')) || 1;
  const unit  = getVal('itemUnit') || 'pcs';
  const price = parseFloat(getVal('itemPrice')) || 0;
  const cat   = getVal('itemCategory') || 'Lainnya';
  const notes = (getVal('itemNotes') || '').trim();

  if (!name) { toast('Nama barang wajib diisi!', 'error'); return; }
  if (price < 0) { toast('Harga tidak boleh negatif', 'error'); return; }

  const editId = getVal('itemEditId');

  if (editId) {
    // Update
    const idx = State.items.findIndex(i => i.id === editId);
    if (idx > -1) {
      State.items[idx] = Object.assign(State.items[idx], { name, qty, unit, price, category: cat, notes });
      toast(`✅ ${name} diperbarui!`);
    }
  } else {
    // Add new
    const newItem = {
      id: generateId(),
      name, qty, unit, price,
      category: cat,
      notes,
      purchased: false,
      createdAt: new Date().toISOString(),
    };
    State.items.push(newItem);
    toast(`🛒 ${name} ditambahkan!`);
  }

  saveAndSync();
  renderAll();
  closeModal('itemModal');

  // Show budget warning if over
  const pct = budgetPct();
  if (pct >= State.settings.dangerPct) {
    setTimeout(() => toast(`🚨 Anggaran sudah ${pct.toFixed(0)}%! Hampir habis!`, 'error', 4000), 500);
  } else if (pct >= State.settings.cautionPct) {
    setTimeout(() => toast(`⚠️ Anggaran ${pct.toFixed(0)}% – hati-hati!`, 'warning', 3000), 500);
  }
}

function togglePurchased(id) {
  const item = State.items.find(i => i.id === id);
  if (!item) return;
  item.purchased = !item.purchased;
  saveAndSync();
  renderAll();
}

function confirmDelete(id, name) {
  State.deletingItemId = id;
  setText('deleteItemName', name);
  openModal('deleteModal');
}

function deleteItem() {
  const id = State.deletingItemId;
  if (!id) return;
  const item = State.items.find(i => i.id === id);
  State.items = State.items.filter(i => i.id !== id);
  saveAndSync();
  renderAll();
  closeModal('deleteModal');
  toast(`🗑️ ${item?.name || 'Barang'} dihapus`, 'warning');
}

// ─────────────────────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────────────────────
function openWalletModal() {
  const currentVal = State.wallet.current || 0;
  setVal('walletAmountInput', currentVal > 0 ? currentVal : '');
  setText('walletCurrentDisplay', rp(currentVal));
  setText('walletAfterPreview', rp(currentVal));
  switchWalletMode('set');
  openModal('walletModal');
  setTimeout(() => {
    const inp = document.getElementById('walletAmountInput');
    if (inp) {
      inp.focus();
      inp.select();
    }
  }, 250);
}

function switchWalletMode(mode) {
  State.walletMode = mode;
  const labels = {
    set: 'Total Uang yang Dibawa (Rp)',
    add: 'Jumlah yang Ditambah (Rp)',
    sub: 'Jumlah yang Dikurangi (Rp)',
  };
  setText('walletInputLabel', labels[mode] || labels.set);
  document.querySelectorAll('.wallet-mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  if (mode === 'set') {
    const cur = State.wallet.current || 0;
    setVal('walletAmountInput', cur > 0 ? cur : '');
  } else {
    setVal('walletAmountInput', '');
  }
  updateWalletPreview();
}

function updateWalletPreview() {
  const raw = getVal('walletAmountInput');
  const amount = parseFloat(raw) || 0;
  let after = State.wallet.current;
  if (State.walletMode === 'set') {
    after = raw === '' ? State.wallet.current : amount;
  } else if (State.walletMode === 'add') {
    after = State.wallet.current + amount;
  } else if (State.walletMode === 'sub') {
    after = State.wallet.current - amount;
  }
  setText('walletAfterPreview', rp(after));
}

function saveWallet() {
  const raw = getVal('walletAmountInput');
  if (raw === '' || isNaN(Number(raw))) {
    toast('Silakan masukkan jumlah uang yang valid!', 'error');
    return;
  }
  const amount = parseFloat(raw);
  let newVal = State.wallet.current;

  if (State.walletMode === 'set') {
    if (amount < 0) { toast('Jumlah tidak boleh negatif', 'error'); return; }
    State.wallet.initial = amount;
    State.wallet.current = amount;
    newVal = amount;
  } else if (State.walletMode === 'add') {
    if (amount <= 0) { toast('Jumlah yang ditambah harus lebih dari 0', 'error'); return; }
    State.wallet.current += amount;
    State.wallet.initial  = Math.max(State.wallet.initial, State.wallet.current);
    newVal = State.wallet.current;
  } else if (State.walletMode === 'sub') {
    if (amount <= 0) { toast('Jumlah yang dikurangi harus lebih dari 0', 'error'); return; }
    State.wallet.current = Math.max(0, State.wallet.current - amount);
    newVal = State.wallet.current;
  }

  saveAndSync();
  renderAll();
  closeModal('walletModal');
  toast(`💰 Uang belanja berhasil disimpan: ${rp(newVal)}!`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKOUT
// ─────────────────────────────────────────────────────────────────────────────
function openCheckout() {
  const purchasedItems = State.items.filter(i => i.purchased);
  if (purchasedItems.length === 0) {
    toast('Tandai barang yang sudah dibeli terlebih dahulu!', 'warning');
    return;
  }

  const total = purchasedItems.reduce((s, i) => s + i.qty * i.price, 0);
  const pct   = State.settings.budgetLimit > 0 ? (total / State.settings.budgetLimit * 100) : 0;
  const walletAfter = State.wallet.current - total;

  // Populate receipt
  const receipt = document.getElementById('checkoutReceipt');
  if (receipt) {
    receipt.innerHTML = purchasedItems.map(i => `
      <div class="receipt-row">
        <span class="name">${escHtml(i.name)} (${i.qty} ${i.unit})</span>
        <span class="price">${rp(i.qty * i.price)}</span>
      </div>`).join('');
  }
  setText('checkoutReceiptTotal', rp(total));
  setText('checkoutWalletBefore', rp(State.wallet.current));
  setText('checkoutWalletAfter', rp(walletAfter));
  setVal('checkoutStore', '');

  // Budget warning
  const banner = document.getElementById('checkoutWarningBanner');
  const bannerText = document.getElementById('checkoutWarningText');
  if (banner && bannerText) {
    if (walletAfter < 0) {
      banner.style.display = 'flex';
      banner.className = 'budget-warning-banner over';
      bannerText.textContent = `⚠️ Uang tidak cukup! Kurang ${rp(Math.abs(walletAfter))}`;
    } else if (pct >= State.settings.dangerPct) {
      banner.style.display = 'flex';
      banner.className = 'budget-warning-banner caution';
      bannerText.textContent = `🚨 Total belanja (${pct.toFixed(0)}%) mendekati batas anggaran!`;
    } else {
      banner.style.display = 'none';
    }
  }

  openModal('checkoutModal');
}

function confirmCheckout() {
  const purchasedItems = State.items.filter(i => i.purchased);
  if (purchasedItems.length === 0) { closeModal('checkoutModal'); return; }

  const total = purchasedItems.reduce((s, i) => s + i.qty * i.price, 0);
  const store = (getVal('checkoutStore') || '').trim() || 'Supermarket';

  const trip = {
    id:          'trip_' + Date.now().toString(36),
    store,
    total,
    walletBefore: State.wallet.current,
    walletAfter:  State.wallet.current - total,
    items:        purchasedItems.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, price: i.price })),
    date:         new Date().toISOString(),
  };

  // Deduct wallet
  State.wallet.current -= total;

  // Remove purchased items from cart
  State.items = State.items.filter(i => !i.purchased);

  // Add to history
  State.history.unshift(trip);

  saveAndSync();
  renderAll();
  closeModal('checkoutModal');

  toast(`🎉 Belanja selesai! ${rp(total)} terbayar, sisa ${rp(trip.walletAfter)}`, 'success', 5000);
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
function saveBudget() {
  const limit   = parseFloat(getVal('budgetLimitInput'))   || 0;
  const caution = parseFloat(getVal('budgetCautionInput')) || 75;
  const danger  = parseFloat(getVal('budgetDangerInput'))  || 90;

  if (limit < 0) { toast('Anggaran tidak boleh negatif', 'error'); return; }
  if (caution >= danger) { toast('Ambang bahaya harus lebih besar dari hati-hati', 'error'); return; }

  State.settings.budgetLimit  = limit;
  State.settings.cautionPct   = caution;
  State.settings.dangerPct    = danger;

  saveAndSync();
  renderAll();
  toast('✅ Anggaran berhasil disimpan!');
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function toggleTripDetail(id) {
  const el = document.getElementById('tripDetail_' + id);
  if (el) el.classList.toggle('open');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function openDeviceModal() {
  setText('deviceNameDisplay', State.deviceName);
  setText('deviceIdDisplay', 'ID: ' + State.deviceId);
  setVal('deviceNameInput', State.deviceName);
  openModal('deviceModal');
}

function saveDeviceName() {
  const name = (getVal('deviceNameInput') || '').trim();
  if (!name) { toast('Nama perangkat tidak boleh kosong', 'error'); return; }
  State.deviceName = name;
  localStorage.setItem('sgt_device_name', name);
  saveAndSync();
  closeModal('deviceModal');
  toast('✅ Nama perangkat disimpan!');
}

function clearAllData() {
  if (!confirm('Reset SEMUA data perangkat ini? (items, history, wallet) Tidak dapat dibatalkan!')) return;
  State.items   = [];
  State.history = [];
  State.wallet  = { initial: 500000, current: 500000 };
  State.settings = { budgetLimit: 500000, cautionPct: 75, dangerPct: 90 };
  saveAndSync();
  renderAll();
  closeModal('deviceModal');
  toast('🗑️ Semua data direset!', 'warning');
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
function switchTab(tabName) {
  State.activeTab = tabName;

  // Update views
  ['Belanja', 'Riwayat', 'Anggaran'].forEach(t => {
    const view = document.getElementById('tab' + t);
    if (view) view.classList.toggle('active', t === tabName);
  });

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // FAB visibility
  const fab = document.getElementById('fabAddItem');
  if (fab) fab.style.display = tabName === 'Belanja' ? 'flex' : 'none';

  // Scroll to top
  document.getElementById('appContent')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE SUBTOTAL PREVIEW IN ITEM MODAL
// ─────────────────────────────────────────────────────────────────────────────
function updateItemSubtotalPreview() {
  const qty   = parseFloat(getVal('itemQty'))   || 0;
  const price = parseFloat(getVal('itemPrice')) || 0;
  setText('itemSubtotalPreview', rp(qty * price));
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Expose globals for inline onclick handlers
window.togglePurchased   = togglePurchased;
window.openEditItem      = openEditItem;
window.confirmDelete     = confirmDelete;
window.toggleTripDetail  = toggleTripDetail;

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────────
function bindEvents() {
  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // FAB
  document.getElementById('fabAddItem')?.addEventListener('click', openAddItem);

  // Item modal
  document.getElementById('itemModalClose')?.addEventListener('click', () => closeModal('itemModal'));
  document.getElementById('itemSaveBtn')?.addEventListener('click', saveItem);
  document.getElementById('itemQty')?.addEventListener('input', updateItemSubtotalPreview);
  document.getElementById('itemPrice')?.addEventListener('input', updateItemSubtotalPreview);

  // Wallet modal & Hero Card tap
  document.getElementById('editWalletBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openWalletModal();
  });
  document.getElementById('walletHeroCard')?.addEventListener('click', () => {
    openWalletModal();
  });
  document.getElementById('walletModalClose')?.addEventListener('click', () => closeModal('walletModal'));
  document.getElementById('walletSaveBtn')?.addEventListener('click', saveWallet);
  document.getElementById('walletAmountInput')?.addEventListener('input', updateWalletPreview);
  document.querySelectorAll('.wallet-mode-tab').forEach(btn => {
    btn.addEventListener('click', () => switchWalletMode(btn.dataset.mode));
  });

  // Wallet preset chips
  document.querySelectorAll('#walletPresets .preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      if (val) {
        setVal('walletAmountInput', val);
        updateWalletPreview();
      }
    });
  });

  // Top Budget Safety Bar tap -> opens Anggaran tab
  document.getElementById('budgetSafetyBar')?.addEventListener('click', () => {
    switchTab('Anggaran');
  });

  // Budget preset chips
  document.querySelectorAll('#budgetPresets .preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      if (val) {
        setVal('budgetLimitInput', val);
      }
    });
  });

  // Checkout
  document.getElementById('checkoutBtn')?.addEventListener('click', openCheckout);
  document.getElementById('checkoutModalClose')?.addEventListener('click', () => closeModal('checkoutModal'));
  document.getElementById('checkoutCancelBtn')?.addEventListener('click', () => closeModal('checkoutModal'));
  document.getElementById('checkoutConfirmBtn')?.addEventListener('click', confirmCheckout);

  // Delete
  document.getElementById('deleteModalClose')?.addEventListener('click', () => closeModal('deleteModal'));
  document.getElementById('deleteCancelBtn')?.addEventListener('click', () => closeModal('deleteModal'));
  document.getElementById('deleteConfirmBtn')?.addEventListener('click', deleteItem);

  // Budget
  document.getElementById('saveBudgetBtn')?.addEventListener('click', saveBudget);

  // Device modal
  document.getElementById('deviceBadgeBtn')?.addEventListener('click', openDeviceModal);
  document.getElementById('deviceModalClose')?.addEventListener('click', () => closeModal('deviceModal'));
  document.getElementById('deviceSaveBtn')?.addEventListener('click', saveDeviceName);
  document.getElementById('clearDataBtn')?.addEventListener('click', clearAllData);

  // Search
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    State.searchQ = e.target.value;
    renderItemList();
  });

  // Category chips
  document.getElementById('categoryChips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    State.filterCat = chip.dataset.cat;
    document.querySelectorAll('#categoryChips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.cat === State.filterCat);
    });
    renderItemList();
  });

  // Status chips
  document.getElementById('statusChips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (!chip) return;
    State.filterStatus = chip.dataset.status;
    document.querySelectorAll('#statusChips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.status === State.filterStatus);
    });
    renderItemList();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDevice();
  loadLocal();
  bindEvents();

  // Initialize Lucide icons
  lucide.createIcons();

  renderAll();

  // Wait for Firebase to be ready (loaded via module script)
  if (window._firestore) {
    initFirebase();
  } else {
    window.addEventListener('firebase-ready', initFirebase, { once: true });
    // Fallback timeout: if firebase doesn't load in 5s, show offline
    setTimeout(() => {
      if (!_fbReady) setSyncStatus('offline');
    }, 5000);
  }
});
