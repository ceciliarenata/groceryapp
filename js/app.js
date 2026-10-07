/**
 * app.js
 * Logika Utama Aplikasi Smart Grocery & Budget Safety Tracker (PWA Mobile)
 */

(function () {
  'use strict';

  // =========================================================================
  // STATE MANAGEMENT & LOCAL STORAGE
  // =========================================================================
  const STORAGE_KEYS = {
    CART: 'smartgrocery_cart_v1',
    SETTINGS: 'smartgrocery_settings_v1',
    HISTORY_DB: 'smartgrocery_refdb_v1',
    TRIP_HISTORY: 'smartgrocery_trips_v1'
  };

  const AppState = {
    cart: [],
    settings: {
      budgetCap: 300000,
      cautionThreshold: 75,
      dangerThreshold: 90,
      soundEnabled: true,
      hapticEnabled: true
    },
    historyDb: [],
    tripHistory: [],
    categories: [],
    activeFilter: 'all',     // 'all' | 'pending' | 'checked'
    activeCategory: 'all',   // 'all' | category_id
    activeTab: 'tabCart',
    editingItemId: null,
    discountMode: 'none',

    init() {
      // 1. Muat kategori dari seed data
      this.categories = (window.SEED_DATA && window.SEED_DATA.categories) ? window.SEED_DATA.categories : [];

      // 2. Muat Settings
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        try { this.settings = Object.assign({}, this.settings, JSON.parse(savedSettings)); } catch (e) {}
      } else if (window.SEED_DATA && window.SEED_DATA.settings) {
        this.settings = Object.assign({}, this.settings, window.SEED_DATA.settings);
      }

      // 3. Muat History Database (Harga acuan bulan lalu)
      const savedDb = localStorage.getItem(STORAGE_KEYS.HISTORY_DB);
      if (savedDb) {
        try { this.historyDb = JSON.parse(savedDb); } catch (e) {}
      } else if (window.SEED_DATA && window.SEED_DATA.historicalDatabase) {
        this.historyDb = JSON.parse(JSON.stringify(window.SEED_DATA.historicalDatabase));
      }

      // 4. Muat Riwayat Sesi Belanja
      const savedTrips = localStorage.getItem(STORAGE_KEYS.TRIP_HISTORY);
      if (savedTrips) {
        try { this.tripHistory = JSON.parse(savedTrips); } catch (e) {}
      } else if (window.SEED_DATA && window.SEED_DATA.tripHistory) {
        this.tripHistory = JSON.parse(JSON.stringify(window.SEED_DATA.tripHistory));
      }

      // 5. Muat Sesi Keranjang Aktif
      const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
      if (savedCart) {
        try { this.cart = JSON.parse(savedCart); } catch (e) {}
      } else if (window.SEED_DATA && window.SEED_DATA.initialCart) {
        this.cart = JSON.parse(JSON.stringify(window.SEED_DATA.initialCart));
      }

      this.saveAll();
    },

    saveLocallyOnly() {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(this.cart));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      localStorage.setItem(STORAGE_KEYS.HISTORY_DB, JSON.stringify(this.historyDb));
      localStorage.setItem(STORAGE_KEYS.TRIP_HISTORY, JSON.stringify(this.tripHistory));
    },

    saveAll() {
      this.saveLocallyOnly();
      // Picu sinkronisasi ke Firebase Cloud Firestore
      window.dispatchEvent(new CustomEvent('smartgrocery:save', {
        detail: {
          cart: this.cart,
          settings: this.settings,
          historyDb: this.historyDb,
          tripHistory: this.tripHistory
        }
      }));
    },

    resetToDemoData() {
      if (!window.SEED_DATA) return;
      this.cart = JSON.parse(JSON.stringify(window.SEED_DATA.initialCart));
      this.settings = JSON.parse(JSON.stringify(window.SEED_DATA.settings));
      this.historyDb = JSON.parse(JSON.stringify(window.SEED_DATA.historicalDatabase));
      this.tripHistory = JSON.parse(JSON.stringify(window.SEED_DATA.tripHistory));
      this.saveAll();
    }
  };

  // Helper formatting Rupiah
  function formatRp(num) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(num || 0));
  }

  // Helper safe Lucide re-render with complete offline SVG dictionary fallback
  const SVG_ICONS = {
    'shopping-cart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
    'shield-check': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    'shield': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    'shield-alert': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    'receipt': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>',
    'sliders': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    'shopping-bag': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    'check': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    'check-check': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>',
    'check-circle-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    'pencil': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    'trash-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    'plus-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    'plus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    'tag': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/></svg>',
    'percent': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    'volume-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    'rotate-ccw': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    'alert-triangle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'copy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    'download': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    'upload': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    'x': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    'trending-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
    'sparkles': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
    'cloud-upload': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8"/><path d="m4 14.89 4.14-4.14a2 2 0 0 1 2.83 0L12 11.75"/><path d="m14 13.75 1.03-1.03a2 2 0 0 1 2.83 0L20 14.89"/><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m16 16-4-4-4 4"/></svg>',
    'cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>'
  };

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else {
      // Offline fallback: replace <i> with matching SVGs
      document.querySelectorAll('[data-lucide]').forEach(el => {
        const iconName = el.getAttribute('data-lucide');
        if (SVG_ICONS[iconName]) {
          el.innerHTML = SVG_ICONS[iconName];
        }
      });
    }
  }

  // Toast Notification
  function showToast(message, iconName = 'info') {
    const toast = document.getElementById('toastNotice');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    if (toastIcon) toastIcon.setAttribute('data-lucide', iconName);
    refreshIcons();

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // =========================================================================
  // CALCULATIONS & SAFETY CAP ENGINE
  // =========================================================================
  function calculateItemRow(item) {
    const calc = DiscountCalculator.calculate(
      item.basePrice,
      item.discountType || 'none',
      item.discountValue || 0,
      item.discountTier2 || 0
    );

    const qty = Math.max(0, Number(item.qty) || 0);
    const subtotal = Math.round(qty * calc.finalPrice);
    const totalSaved = Math.round(qty * calc.savedAmount);

    // Cari perbandingan dengan bulan lalu
    const hist = PriceComparator.findHistoricalItem(item.name, AppState.historyDb);
    const comparison = PriceComparator.compare(item.basePrice, hist ? hist.lastPrice : null);

    return {
      discountCalc: calc,
      effectiveUnitPrice: calc.finalPrice,
      subtotal,
      totalSaved,
      comparison,
      historicalItem: hist
    };
  }

  function calculateCartTotals() {
    let totalSpend = 0;
    let totalSavings = 0;
    let checkedCount = 0;
    const categoryTotals = {};

    AppState.cart.forEach(item => {
      const row = calculateItemRow(item);
      totalSpend += row.subtotal;
      totalSavings += row.totalSaved;
      if (item.inCart) checkedCount++;

      const cat = item.category || 'lainnya';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + row.subtotal;
    });

    const budgetCap = AppState.settings.budgetCap || 300000;
    const remaining = budgetCap - totalSpend;
    const percentUsed = budgetCap > 0 ? Math.round((totalSpend / budgetCap) * 100) : 0;

    let zone = 'safe'; // 'safe' | 'warning' | 'danger'
    if (percentUsed >= AppState.settings.dangerThreshold || remaining < 0) {
      zone = 'danger';
    } else if (percentUsed >= AppState.settings.cautionThreshold) {
      zone = 'warning';
    }

    return {
      totalSpend,
      totalSavings,
      budgetCap,
      remaining,
      percentUsed,
      zone,
      totalItems: AppState.cart.length,
      checkedCount,
      categoryTotals
    };
  }

  // =========================================================================
  // UI RENDERERS
  // =========================================================================

  // 1. Render Safety Cap Card
  function renderSafetyCap() {
    const totals = calculateCartTotals();
    const card = document.getElementById('safetyCapCard');
    const badge = document.getElementById('safetyStatusBadge');
    const badgeText = document.getElementById('safetyStatusText');
    const targetText = document.getElementById('capTargetText');
    const totalText = document.getElementById('cartTotalText');
    const remainingText = document.getElementById('cartRemainingText');
    const progressFill = document.getElementById('safetyProgressFill');
    const percentText = document.getElementById('safetyPercentText');
    const savingsText = document.getElementById('safetySavingsText');
    const alertBanner = document.getElementById('safetyAlertBanner');
    const alertMsg = document.getElementById('safetyAlertMsg');
    const navCartCount = document.getElementById('navCartCount');
    const trolleyCheckedBadge = document.getElementById('trolleyCheckedBadge');

    if (!card) return;

    // Reset zone classes
    card.classList.remove('zone-safe', 'zone-warning', 'zone-danger');
    badge.classList.remove('badge-safe', 'badge-warning', 'badge-danger');
    remainingText.classList.remove('remaining-safe', 'remaining-warning', 'remaining-danger');

    card.classList.add(`zone-${totals.zone}`);
    badge.classList.add(`badge-${totals.zone}`);
    remainingText.classList.add(`remaining-${totals.zone}`);

    targetText.textContent = formatRp(totals.budgetCap);
    totalText.textContent = formatRp(totals.totalSpend);
    percentText.textContent = `${totals.percentUsed}% Terpakai`;
    savingsText.textContent = `Hemat ${formatRp(totals.totalSavings)} (Diskon)`;
    navCartCount.textContent = totals.totalItems;
    trolleyCheckedBadge.textContent = `${totals.checkedCount} / ${totals.totalItems} di troli`;

    // Sisa Anggaran text
    if (totals.remaining >= 0) {
      remainingText.textContent = formatRp(totals.remaining);
    } else {
      remainingText.textContent = `-${formatRp(Math.abs(totals.remaining))}`;
    }

    // Status badge text
    if (totals.zone === 'safe') {
      badgeText.textContent = 'Aman';
    } else if (totals.zone === 'warning') {
      badgeText.textContent = 'Waspada';
    } else {
      badgeText.textContent = totals.remaining < 0 ? 'Overbudget' : 'Bahaya';
    }

    // Progress bar fill (cap visual at 100% for bar, but show real % text)
    const visualFill = Math.min(100, Math.max(0, totals.percentUsed));
    progressFill.style.width = `${visualFill}%`;

    // Alert Banner
    if (totals.zone === 'danger') {
      alertBanner.style.display = 'flex';
      alertBanner.classList.remove('warning');
      if (totals.remaining < 0) {
        alertMsg.innerHTML = `🚨 <b>Overbudget!</b> Melebihi batas dompet ${formatRp(Math.abs(totals.remaining))}. Kurangi barang tersier!`;
      } else {
        alertMsg.innerHTML = `⚠️ <b>Hampir Habis!</b> Belanjaan sudah mencapai ${totals.percentUsed}% dari budget dompet kos.`;
      }
    } else if (totals.zone === 'warning') {
      alertBanner.style.display = 'flex';
      alertBanner.classList.add('warning');
      alertMsg.innerHTML = `⚡ <b>Zona Waspada:</b> Sisa anggaran tinggal ${formatRp(totals.remaining)}. Periksa kembali sisa daftar belanja.`;
    } else {
      alertBanner.style.display = 'none';
    }
  }

  // 2. Render Daftar Item Belanja (Keranjang Aktif)
  function renderCartList() {
    const listContainer = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('emptyCartState');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Filter items
    let filtered = AppState.cart.filter(item => {
      // Checklist filter
      if (AppState.activeFilter === 'pending' && item.inCart) return false;
      if (AppState.activeFilter === 'checked' && !item.inCart) return false;
      // Category filter
      if (AppState.activeCategory !== 'all' && item.category !== AppState.activeCategory) return false;
      return true;
    });

    if (AppState.cart.length === 0) {
      emptyState.style.display = 'block';
      listContainer.style.display = 'none';
      return;
    } else {
      emptyState.style.display = 'none';
      listContainer.style.display = 'flex';
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          Tidak ada item dengan filter ini.
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const row = calculateItemRow(item);
      const card = document.createElement('div');
      card.className = `cart-item-card ${item.inCart ? 'is-in-trolley' : ''}`;
      card.setAttribute('data-id', item.id);

      // Category object
      const catObj = AppState.categories.find(c => c.id === item.category);
      const catName = catObj ? catObj.name : 'Item';

      // Discount markup
      let discountBadgeHtml = '';
      let priceCalculationHtml = '';

      if (row.discountCalc.hasDiscount) {
        discountBadgeHtml = `<span class="discount-chip"><i data-lucide="tag" style="width: 10px; height: 10px;"></i> ${row.discountCalc.summaryText}</span>`;
        priceCalculationHtml = `
          <div class="price-calculation-row">
            <span class="original-price-strike">${formatRp(item.basePrice)}</span>
            <span class="effective-unit-price">${formatRp(row.effectiveUnitPrice)}/${item.unit}</span>
          </div>
        `;
      } else {
        priceCalculationHtml = `
          <div class="price-calculation-row">
            <span class="effective-unit-price">${formatRp(item.basePrice)}/${item.unit}</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="cart-item-top">
          <!-- Big Thumb Checklist Button -->
          <button class="trolley-check-btn" title="Tandai sudah masuk troli" data-action="toggle-check" data-id="${item.id}">
            <i data-lucide="check" style="width: 18px; height: 18px; stroke-width: 3;"></i>
          </button>

          <div class="cart-item-details">
            <div class="item-name-row">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <div class="cart-item-actions">
                <button class="btn-item-action" title="Edit" data-action="edit" data-id="${item.id}">
                  <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="btn-item-action delete" title="Hapus" data-action="delete" data-id="${item.id}">
                  <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </div>

            <div class="item-meta-row">
              <span class="item-category-tag">${catName}</span>
              ${discountBadgeHtml}
              ${row.comparison.badgeHtml}
            </div>

            ${priceCalculationHtml}

            ${item.notes ? `<div style="font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 3px;">📝 ${escapeHtml(item.notes)}</div>` : ''}
          </div>
        </div>

        <div class="cart-item-bottom">
          <!-- Big Touch Stepper for One-Hand Trolley Shopping -->
          <div class="qty-stepper">
            <button type="button" class="btn-stepper" data-action="dec-qty" data-id="${item.id}" aria-label="Kurangi kuantitas">−</button>
            <span class="qty-display-value">${item.qty} ${item.unit}</span>
            <button type="button" class="btn-stepper" data-action="inc-qty" data-id="${item.id}" aria-label="Tambah kuantitas">+</button>
          </div>

          <div class="item-subtotal-area">
            <span class="subtotal-label">Subtotal</span>
            <span class="subtotal-value">${formatRp(row.subtotal)}</span>
          </div>
        </div>
      `;

      listContainer.appendChild(card);
    });

    refreshIcons();
  }

  // 3. Render Tab Riwayat (History & Database Acuan)
  function renderHistoryTab() {
    const pastTripsList = document.getElementById('pastTripsList');
    const refDbList = document.getElementById('refDbList');
    const avgSpendText = document.getElementById('historyAvgSpendText');
    const tripCountText = document.getElementById('historyTripCountText');

    if (!pastTripsList || !refDbList) return;

    // Hitung rata-rata pengeluaran historis
    const trips = AppState.tripHistory;
    tripCountText.textContent = `${trips.length} Sesi Belanja`;
    if (trips.length > 0) {
      const sum = trips.reduce((acc, t) => acc + (t.totalSpent || 0), 0);
      avgSpendText.textContent = formatRp(sum / trips.length);
    } else {
      avgSpendText.textContent = 'Rp 0';
    }

    // Render Riwayat Sesi Belanja
    pastTripsList.innerHTML = '';
    if (trips.length === 0) {
      pastTripsList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">
          Belum ada riwayat belanja yang disimpan. Selesaikan belanja aktif untuk mencatat riwayat pertama Anda!
        </div>
      `;
    } else {
      trips.forEach(trip => {
        const tripCard = document.createElement('div');
        tripCard.className = 'history-trip-card';
        const dateStr = new Date(trip.date).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });

        // Items preview chips
        const itemsSample = (trip.items || []).slice(0, 4).map(it => `
          <span class="history-pill">${escapeHtml(it.name)} (${it.qty} ${it.unit || ''})</span>
        `).join('');

        const moreCount = (trip.items || []).length > 4 ? `+${(trip.items || []).length - 4} lainnya` : '';

        tripCard.innerHTML = `
          <div class="history-trip-header">
            <div>
              <div class="trip-title">${escapeHtml(trip.tripName || 'Belanja Bulanan')}</div>
              <div class="trip-date">📅 ${dateStr} • 🏬 ${escapeHtml(trip.storeName || 'Supermarket')}</div>
            </div>
            <div class="trip-spent-badge">${formatRp(trip.totalSpent)}</div>
          </div>
          <div class="trip-meta">
            <span>${trip.items ? trip.items.length : 0} Jenis Barang</span>
            <span style="color: var(--text-muted);">Budget Cap: ${formatRp(trip.budgetCap)}</span>
          </div>
          <div class="history-items-preview">
            ${itemsSample}
            ${moreCount ? `<span class="history-pill" style="color: #38bdf8;">${moreCount}</span>` : ''}
          </div>
          <div class="trip-card-actions">
            <button class="btn-trip-action" data-action="repeat-trip" data-id="${trip.id}">
              <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Salin ke Troli
            </button>
            <button class="btn-trip-action" data-action="delete-trip" data-id="${trip.id}" style="color: var(--danger);">
              <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Hapus
            </button>
          </div>
        `;
        pastTripsList.appendChild(tripCard);
      });
    }

    // Render Database Harga Acuan Bulan Lalu
    renderReferenceDbList();
  }

  function renderReferenceDbList(query = '') {
    const refDbList = document.getElementById('refDbList');
    if (!refDbList) return;

    refDbList.innerHTML = '';
    let items = AppState.historyDb;

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      items = items.filter(it => it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q));
    }

    if (items.length === 0) {
      refDbList.innerHTML = `
        <div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px;">
          Tidak ada produk yang cocok di database acuan.
        </div>
      `;
      return;
    }

    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'ref-db-card';
      const catObj = AppState.categories.find(c => c.id === it.category);
      const catName = catObj ? catObj.name : it.category;

      card.innerHTML = `
        <div>
          <div class="ref-db-name">${escapeHtml(it.name)}</div>
          <div class="ref-db-meta">${catName} • Satuan: ${it.unit}</div>
        </div>
        <div>
          <div class="ref-db-price">${formatRp(it.lastPrice)}</div>
          <div style="font-size: 10px; color: var(--text-muted); text-align: right;">Bln Lalu</div>
        </div>
      `;
      refDbList.appendChild(card);
    });

    refreshIcons();
  }

  // 4. Render Tab Anggaran & Analisis Dompet
  function renderBudgetTab() {
    const inputBudget = document.getElementById('inputSettingBudget');
    const rangeCaution = document.getElementById('rangeCaution');
    const rangeDanger = document.getElementById('rangeDanger');
    const labelCaution = document.getElementById('labelCautionVal');
    const labelDanger = document.getElementById('labelDangerVal');
    const breakdownList = document.getElementById('categoryBreakdownList');

    if (!inputBudget || !breakdownList) return;

    inputBudget.value = AppState.settings.budgetCap;
    rangeCaution.value = AppState.settings.cautionThreshold;
    rangeDanger.value = AppState.settings.dangerThreshold;

    const cap = AppState.settings.budgetCap;
    const cautionRp = Math.round(cap * (AppState.settings.cautionThreshold / 100));
    const dangerRp = Math.round(cap * (AppState.settings.dangerThreshold / 100));

    labelCaution.textContent = `${AppState.settings.cautionThreshold}% (${formatRp(cautionRp)})`;
    labelDanger.textContent = `${AppState.settings.dangerThreshold}% (${formatRp(dangerRp)})`;

    // Render Category Breakdown Bars
    const totals = calculateCartTotals();
    breakdownList.innerHTML = '';

    if (totals.totalSpend === 0) {
      breakdownList.innerHTML = `
        <div style="text-align: center; padding: 14px; color: var(--text-muted); font-size: 12px;">
          Belum ada item di keranjang belanja saat ini.
        </div>
      `;
      return;
    }

    AppState.categories.forEach(cat => {
      const spent = totals.categoryTotals[cat.id] || 0;
      if (spent > 0) {
        const pct = Math.round((spent / totals.totalSpend) * 100);
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        row.innerHTML = `
          <div class="breakdown-info">
            <span style="font-weight: 600; color: #fff;">${cat.name}</span>
            <span style="color: var(--text-secondary);">${formatRp(spent)} (${pct}%)</span>
          </div>
          <div class="breakdown-bar-track">
            <div class="breakdown-bar-fill" style="width: ${pct}%; background: ${cat.color || 'var(--primary)'};"></div>
          </div>
        `;
        breakdownList.appendChild(row);
      }
    });

    refreshIcons();
  }

  // =========================================================================
  // MODAL HANDLERS (ADD/EDIT ITEM & REALTIME COMPARATOR & DISCOUNT)
  // =========================================================================
  function openItemModal(itemId = null) {
    const modal = document.getElementById('modalItemOverlay');
    const title = document.getElementById('modalItemTitle');
    const idInput = document.getElementById('itemIdInput');
    const nameInput = document.getElementById('itemNameInput');
    const catSelect = document.getElementById('itemCategorySelect');
    const unitSelect = document.getElementById('itemUnitSelect');
    const qtyInput = document.getElementById('itemQtyInput');
    const priceInput = document.getElementById('itemBasePriceInput');
    const notesInput = document.getElementById('itemNotesInput');

    AppState.editingItemId = itemId;
    idInput.value = itemId || '';

    if (itemId) {
      // EDIT MODE
      const item = AppState.cart.find(it => it.id === itemId);
      if (!item) return;

      title.textContent = 'Edit Item Belanja';
      nameInput.value = item.name;
      catSelect.value = item.category;
      unitSelect.value = item.unit;
      qtyInput.value = item.qty;
      priceInput.value = item.basePrice;
      notesInput.value = item.notes || '';

      // Set discount
      setDiscountModeUI(item.discountType || 'none');
      if (item.discountType === 'single') {
        document.getElementById('itemDiscountValSingle').value = item.discountValue || '';
      } else if (item.discountType === 'tiered') {
        document.getElementById('itemDiscountTier1').value = item.discountValue || 50;
        document.getElementById('itemDiscountTier2').value = item.discountTier2 || 20;
      } else if (item.discountType === 'nominal') {
        document.getElementById('itemDiscountNominal').value = item.discountValue || '';
      }
    } else {
      // ADD NEW MODE
      title.textContent = 'Tambah Item Belanja';
      nameInput.value = '';
      catSelect.value = 'bahan_pokok';
      unitSelect.value = 'pack';
      qtyInput.value = '1';
      priceInput.value = '';
      notesInput.value = '';
      setDiscountModeUI('none');
    }

    renderAutocompleteSuggestions('');
    updateModalRealtimePreviews();

    modal.classList.add('open');
    setTimeout(() => {
      if (!itemId) nameInput.focus();
    }, 250);
    refreshIcons();
  }

  function closeItemModal() {
    const modal = document.getElementById('modalItemOverlay');
    modal.classList.remove('open');
    AppState.editingItemId = null;
  }

  function setDiscountModeUI(mode) {
    AppState.discountMode = mode;
    const tabBtns = document.querySelectorAll('.discount-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-distype') === mode);
    });

    const fieldSingle = document.getElementById('fieldDiscountSingle');
    const fieldTiered = document.getElementById('fieldDiscountTiered');
    const fieldNominal = document.getElementById('fieldDiscountNominal');

    fieldSingle.style.display = mode === 'single' ? 'block' : 'none';
    fieldTiered.style.display = mode === 'tiered' ? 'block' : 'none';
    fieldNominal.style.display = mode === 'nominal' ? 'block' : 'none';

    updateModalRealtimePreviews();
  }

  // Update realtime previews inside the bottom sheet modal:
  // - Comparator preview (arrow, diff, percentage)
  // - Discount calculation math
  // - Line item subtotal
  function updateModalRealtimePreviews() {
    const nameInput = document.getElementById('itemNameInput');
    const priceInput = document.getElementById('itemBasePriceInput');
    const qtyInput = document.getElementById('itemQtyInput');
    const unitSelect = document.getElementById('itemUnitSelect');

    const compBox = document.getElementById('modalComparatorBox');
    const compText = document.getElementById('modalComparatorText');
    const compBadge = document.getElementById('modalComparatorBadge');
    const refNote = document.getElementById('modalRefPriceNote');

    const unitPriceFinal = document.getElementById('modalFinalUnitPrice');
    const itemCalcSummary = document.getElementById('modalItemSummaryCalculation');
    const itemSubtotalFinal = document.getElementById('modalItemFinalSubtotal');

    const name = (nameInput.value || '').trim();
    const basePrice = Math.max(0, parseFloat(priceInput.value) || 0);
    const qty = Math.max(0, parseFloat(qtyInput.value) || 1);
    const unit = unitSelect.value || 'item';

    // 1. Comparator Logic
    const hist = PriceComparator.findHistoricalItem(name, AppState.historyDb);
    if (hist) {
      refNote.textContent = `Acuan Bln Lalu: ${formatRp(hist.lastPrice)}`;
    } else {
      refNote.textContent = `Acuan Bln Lalu: (Belum ada)`;
    }

    if (basePrice > 0) {
      const comp = PriceComparator.compare(basePrice, hist ? hist.lastPrice : null);
      compBox.className = `comparator-preview-box has-trend`;
      compText.textContent = comp.message;
      compBadge.innerHTML = comp.badgeHtml;
    } else {
      compBox.className = 'comparator-preview-box';
      compText.textContent = 'Ketik harga untuk melihat perbandingan bulan lalu';
      compBadge.innerHTML = '';
    }

    // 2. Discount Calculation Logic
    let distVal1 = 0;
    let distVal2 = 0;

    if (AppState.discountMode === 'single') {
      distVal1 = parseFloat(document.getElementById('itemDiscountValSingle').value) || 0;
    } else if (AppState.discountMode === 'tiered') {
      distVal1 = parseFloat(document.getElementById('itemDiscountTier1').value) || 0;
      distVal2 = parseFloat(document.getElementById('itemDiscountTier2').value) || 0;

      // Update formula preview breakdown
      const eff = (1 - ((1 - (distVal1 / 100)) * (1 - (distVal2 / 100)))) * 100;
      const roundedEff = Math.round(eff * 10) / 10;
      document.getElementById('tieredFormulaEff').textContent = `Efektif Hemat ${roundedEff}%`;
      
      if (basePrice > 0) {
        const after1 = basePrice * (1 - (distVal1 / 100));
        const after2 = after1 * (1 - (distVal2 / 100));
        document.getElementById('tieredFormulaSteps').innerHTML = `
          ${formatRp(basePrice)} dipotong ${distVal1}% → <b>${formatRp(after1)}</b>, lalu dipotong ${distVal2}% → <b>${formatRp(after2)}</b>
        `;
      } else {
        document.getElementById('tieredFormulaSteps').textContent = `Harga dipotong diskon 1, lalu sisanya dipotong diskon 2.`;
      }
    } else if (AppState.discountMode === 'nominal') {
      distVal1 = parseFloat(document.getElementById('itemDiscountNominal').value) || 0;
    }

    const calc = DiscountCalculator.calculate(basePrice, AppState.discountMode, distVal1, distVal2);
    unitPriceFinal.textContent = `${formatRp(calc.finalPrice)} / ${unit}`;

    // 3. Subtotal Line Item
    const subtotal = Math.round(qty * calc.finalPrice);
    itemCalcSummary.textContent = `${qty} ${unit} × ${formatRp(calc.finalPrice)}`;
    itemSubtotalFinal.textContent = formatRp(subtotal);

    refreshIcons();
  }

  // Autocomplete Suggestions from Historical Database
  function renderAutocompleteSuggestions(filterQuery = '') {
    const box = document.getElementById('itemSuggestionsBox');
    if (!box) return;

    box.innerHTML = '';
    let pool = AppState.historyDb;
    if (filterQuery && filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim();
      pool = pool.filter(it => it.name.toLowerCase().includes(q));
    }

    // Tampilkan hingga 6 saran teratas
    const topSugg = pool.slice(0, 6);
    if (topSugg.length === 0) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'flex';
    topSugg.forEach(it => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'suggestion-chip';
      chip.textContent = `${it.name} (${formatRp(it.lastPrice)})`;
      chip.addEventListener('click', () => {
        SoundHaptic.playClick();
        document.getElementById('itemNameInput').value = it.name;
        document.getElementById('itemCategorySelect').value = it.category;
        document.getElementById('itemUnitSelect').value = it.unit;
        // Jika harga belum diisi, sarankan harga bulan lalu
        if (!document.getElementById('itemBasePriceInput').value) {
          document.getElementById('itemBasePriceInput').value = it.lastPrice;
        }
        box.style.display = 'none';
        updateModalRealtimePreviews();
      });
      box.appendChild(chip);
    });
  }

  // Save Item to Cart
  function saveItemFromModal() {
    const name = document.getElementById('itemNameInput').value.trim();
    const category = document.getElementById('itemCategorySelect').value;
    const unit = document.getElementById('itemUnitSelect').value;
    const qty = parseFloat(document.getElementById('itemQtyInput').value) || 1;
    const basePrice = parseFloat(document.getElementById('itemBasePriceInput').value);
    const notes = document.getElementById('itemNotesInput').value.trim();

    if (!name) {
      showToast('Mohon masukkan nama produk!', 'alert-circle');
      document.getElementById('itemNameInput').focus();
      return;
    }
    if (isNaN(basePrice) || basePrice < 0) {
      showToast('Mohon masukkan harga satuan produk!', 'alert-circle');
      document.getElementById('itemBasePriceInput').focus();
      return;
    }

    let distVal1 = 0;
    let distVal2 = 0;
    if (AppState.discountMode === 'single') {
      distVal1 = parseFloat(document.getElementById('itemDiscountValSingle').value) || 0;
    } else if (AppState.discountMode === 'tiered') {
      distVal1 = parseFloat(document.getElementById('itemDiscountTier1').value) || 0;
      distVal2 = parseFloat(document.getElementById('itemDiscountTier2').value) || 0;
    } else if (AppState.discountMode === 'nominal') {
      distVal1 = parseFloat(document.getElementById('itemDiscountNominal').value) || 0;
    }

    if (AppState.editingItemId) {
      // Update existing item
      const index = AppState.cart.findIndex(it => it.id === AppState.editingItemId);
      if (index !== -1) {
        AppState.cart[index] = Object.assign({}, AppState.cart[index], {
          name,
          category,
          unit,
          qty,
          basePrice,
          discountType: AppState.discountMode,
          discountValue: distVal1,
          discountTier2: distVal2,
          notes
        });
        showToast(`Item "${name}" diperbarui`, 'check');
      }
    } else {
      // Tambah item baru
      const newItem = {
        id: 'item_' + Date.now(),
        name,
        category,
        unit,
        qty,
        basePrice,
        discountType: AppState.discountMode,
        discountValue: distVal1,
        discountTier2: distVal2,
        inCart: false,
        notes
      };
      AppState.cart.unshift(newItem);
      showToast(`"${name}" dimasukkan ke keranjang`, 'shopping-bag');
    }

    SoundHaptic.playCartCheck(true);
    AppState.saveAll();
    closeItemModal();
    renderAll();
  }

  // =========================================================================
  // CHECKOUT MODAL HANDLERS
  // =========================================================================
  function openCheckoutModal() {
    const modal = document.getElementById('modalCheckoutOverlay');
    const totals = calculateCartTotals();

    document.getElementById('checkoutTotalItemCount').textContent = `${totals.totalItems} Barang (${totals.checkedCount} sudah di troli)`;
    document.getElementById('checkoutBudgetCap').textContent = formatRp(totals.budgetCap);
    document.getElementById('checkoutTotalSavings').textContent = formatRp(totals.totalSavings);
    document.getElementById('checkoutTotalSpend').textContent = formatRp(totals.totalSpend);

    const remEl = document.getElementById('checkoutRemainingMoney');
    if (totals.remaining >= 0) {
      remEl.textContent = formatRp(totals.remaining);
      remEl.style.color = '#34d399';
    } else {
      remEl.textContent = `Defisit ${formatRp(Math.abs(totals.remaining))}`;
      remEl.style.color = '#f43f5e';
    }

    modal.classList.add('open');
    refreshIcons();
  }

  function closeCheckoutModal() {
    const modal = document.getElementById('modalCheckoutOverlay');
    modal.classList.remove('open');
  }

  function confirmCheckout() {
    const totals = calculateCartTotals();
    if (AppState.cart.length === 0) {
      showToast('Keranjang belanja kosong!', 'alert-circle');
      closeCheckoutModal();
      return;
    }

    const storeName = document.getElementById('checkoutStoreName').value.trim() || 'Supermarket';
    const now = new Date();
    const tripName = `Belanja Bulanan Kos - ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;

    // 1. Buat record riwayat baru
    const newTrip = {
      id: 'trip_' + Date.now(),
      tripName,
      date: now.toISOString(),
      storeName,
      budgetCap: totals.budgetCap,
      totalSpent: totals.totalSpend,
      itemCount: totals.totalItems,
      items: AppState.cart.map(item => {
        const row = calculateItemRow(item);
        return {
          name: item.name,
          category: item.category,
          unit: item.unit,
          qty: item.qty,
          finalPrice: row.effectiveUnitPrice,
          basePrice: item.basePrice
        };
      })
    };

    AppState.tripHistory.unshift(newTrip);

    // 2. OTOMATIS PERBARUI DATABASE HARGA ACUAN UNTUK BULAN DEPAN!
    AppState.cart.forEach(item => {
      const row = calculateItemRow(item);
      const existing = AppState.historyDb.find(h => h.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        existing.lastPrice = row.effectiveUnitPrice;
        existing.lastDate = now.toISOString().split('T')[0];
        existing.unit = item.unit;
        existing.category = item.category;
      } else {
        AppState.historyDb.push({
          id: 'h_' + Date.now() + Math.random().toString(36).substr(2, 4),
          name: item.name,
          category: item.category,
          unit: item.unit,
          lastPrice: row.effectiveUnitPrice,
          lastDate: now.toISOString().split('T')[0]
        });
      }
    });

    // 3. Kosongkan keranjang aktif
    AppState.cart = [];
    AppState.saveAll();

    SoundHaptic.playSuccess();
    closeCheckoutModal();
    showToast('Belanja selesai! Database harga acuan telah diperbarui 🎉', 'check-circle-2');

    // Pindah ke tab riwayat untuk melihat hasil
    switchTab('tabHistory');
    renderAll();
  }

  // =========================================================================
  // QUICK BUDGET MODAL
  // =========================================================================
  function openQuickBudgetModal() {
    const modal = document.getElementById('modalQuickBudgetOverlay');
    document.getElementById('quickBudgetInput').value = AppState.settings.budgetCap;
    modal.classList.add('open');
    refreshIcons();
  }

  function closeQuickBudgetModal() {
    document.getElementById('modalQuickBudgetOverlay').classList.remove('open');
  }

  function saveQuickBudget() {
    const val = parseFloat(document.getElementById('quickBudgetInput').value) || 300000;
    AppState.settings.budgetCap = val;
    AppState.saveAll();
    closeQuickBudgetModal();
    showToast(`Batas dompet disetel ke ${formatRp(val)}`, 'shield-check');
    SoundHaptic.playClick();
    renderAll();
  }

  // =========================================================================
  // TAB SWITCHING & ROUTING
  // =========================================================================
  function switchTab(tabId) {
    AppState.activeTab = tabId;

    // Toggle pages
    document.querySelectorAll('.tab-page').forEach(page => {
      page.classList.toggle('active', page.id === tabId);
    });

    // Toggle nav buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Show/hide floating cart dock (hanya di tab cart)
    const dock = document.getElementById('cartFloatingDock');
    if (dock) {
      dock.style.display = tabId === 'tabCart' ? 'flex' : 'none';
    }

    if (tabId === 'tabHistory') renderHistoryTab();
    if (tabId === 'tabBudget') renderBudgetTab();
    if (tabId === 'tabCart') renderCartList();

    // Scroll to top
    document.getElementById('mainScrollArea').scrollTop = 0;
    refreshIcons();
  }

  // =========================================================================
  // EVENT LISTENERS BINDINGS
  // =========================================================================
  function setupEventListeners() {
    // 1. Navigation bar tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundHaptic.playClick();
        const tabId = btn.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    // 2. Trolley checklist filter pills
    document.querySelectorAll('.btn-filter-pill[data-filter]').forEach(pill => {
      pill.addEventListener('click', () => {
        SoundHaptic.playClick();
        document.querySelectorAll('.btn-filter-pill[data-filter]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        AppState.activeFilter = pill.getAttribute('data-filter');
        renderCartList();
      });
    });

    // 3. Category horizontal chips
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        SoundHaptic.playClick();
        document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        AppState.activeCategory = chip.getAttribute('data-cat');
        renderCartList();
      });
    });

    // 4. Cart List Delegated Click Events (Checklist, Stepper, Edit, Delete)
    const cartList = document.getElementById('cartItemsList');
    cartList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const item = AppState.cart.find(it => it.id === id);
      if (!item) return;

      if (action === 'toggle-check') {
        item.inCart = !item.inCart;
        SoundHaptic.playCartCheck(item.inCart);
        AppState.saveAll();
        renderAll();
      } else if (action === 'inc-qty') {
        item.qty = Math.round((Number(item.qty) + 1) * 10) / 10;
        SoundHaptic.playClick();
        AppState.saveAll();
        renderAll();
      } else if (action === 'dec-qty') {
        if (item.qty > 1) {
          item.qty = Math.round((Number(item.qty) - 1) * 10) / 10;
        } else if (item.qty > 0.1) {
          item.qty = Math.max(0.1, Math.round((Number(item.qty) - 0.5) * 10) / 10);
        } else {
          // Konfirmasi hapus
          if (confirm(`Hapus "${item.name}" dari keranjang?`)) {
            AppState.cart = AppState.cart.filter(it => it.id !== id);
            showToast(`"${item.name}" dihapus`, 'trash');
          }
        }
        SoundHaptic.playClick();
        AppState.saveAll();
        renderAll();
      } else if (action === 'edit') {
        SoundHaptic.playClick();
        openItemModal(id);
      } else if (action === 'delete') {
        SoundHaptic.playClick();
        if (confirm(`Hapus "${item.name}" dari keranjang?`)) {
          AppState.cart = AppState.cart.filter(it => it.id !== id);
          showToast(`"${item.name}" dihapus`, 'trash');
          AppState.saveAll();
          renderAll();
        }
      }
    });

    // 5. FAB & Header buttons
    document.getElementById('btnOpenAddModal').addEventListener('click', () => {
      SoundHaptic.playClick();
      openItemModal(null);
    });

    document.getElementById('btnEmptyAdd')?.addEventListener('click', () => {
      SoundHaptic.playClick();
      openItemModal(null);
    });

    document.getElementById('btnOpenCheckoutModal').addEventListener('click', () => {
      SoundHaptic.playClick();
      openCheckoutModal();
    });

    document.getElementById('btnEditBudgetQuick').addEventListener('click', () => {
      SoundHaptic.playClick();
      openQuickBudgetModal();
    });

    // 6. Modal Item Controls
    document.getElementById('btnCloseItemModal').addEventListener('click', closeItemModal);
    document.getElementById('modalItemOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalItemOverlay') closeItemModal();
    });
    document.getElementById('btnSaveItem').addEventListener('click', saveItemFromModal);

    // Modal Qty Stepper
    document.getElementById('btnModalQtyInc').addEventListener('click', () => {
      const el = document.getElementById('itemQtyInput');
      el.value = Math.max(1, (parseFloat(el.value) || 0) + 1);
      SoundHaptic.playClick();
      updateModalRealtimePreviews();
    });
    document.getElementById('btnModalQtyDec').addEventListener('click', () => {
      const el = document.getElementById('itemQtyInput');
      const cur = parseFloat(el.value) || 1;
      el.value = Math.max(0.1, cur > 1 ? cur - 1 : cur - 0.5);
      SoundHaptic.playClick();
      updateModalRealtimePreviews();
    });

    // Modal Qty Quick Chips
    document.querySelectorAll('[data-addqty]').forEach(btn => {
      btn.addEventListener('click', () => {
        const add = parseFloat(btn.getAttribute('data-addqty')) || 1;
        const el = document.getElementById('itemQtyInput');
        el.value = (parseFloat(el.value) || 0) + add;
        SoundHaptic.playClick();
        updateModalRealtimePreviews();
      });
    });

    // Discount Tabs
    document.querySelectorAll('.discount-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundHaptic.playClick();
        setDiscountModeUI(btn.getAttribute('data-distype'));
      });
    });

    // Discount Single Presets
    document.querySelectorAll('[data-presetdisc]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('itemDiscountValSingle').value = btn.getAttribute('data-presetdisc');
        SoundHaptic.playClick();
        updateModalRealtimePreviews();
      });
    });

    // Discount Tiered Presets (50,20 dll)
    document.querySelectorAll('[data-presettier]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [d1, d2] = btn.getAttribute('data-presettier').split(',');
        document.getElementById('itemDiscountTier1').value = d1;
        document.getElementById('itemDiscountTier2').value = d2;
        SoundHaptic.playClick();
        updateModalRealtimePreviews();
      });
    });

    // Realtime input changes inside item modal
    const liveInputs = [
      'itemNameInput',
      'itemBasePriceInput',
      'itemQtyInput',
      'itemUnitSelect',
      'itemDiscountValSingle',
      'itemDiscountTier1',
      'itemDiscountTier2',
      'itemDiscountNominal'
    ];
    liveInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'itemNameInput') {
            renderAutocompleteSuggestions(el.value);
          }
          updateModalRealtimePreviews();
        });
      }
    });

    // 7. Checkout Modal Buttons
    document.getElementById('btnCloseCheckoutModal').addEventListener('click', closeCheckoutModal);
    document.getElementById('modalCheckoutOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalCheckoutOverlay') closeCheckoutModal();
    });
    document.getElementById('btnConfirmCheckout').addEventListener('click', confirmCheckout);

    // 8. Quick Budget Modal Buttons
    document.getElementById('btnCloseQuickBudgetModal').addEventListener('click', closeQuickBudgetModal);
    document.getElementById('modalQuickBudgetOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalQuickBudgetOverlay') closeQuickBudgetModal();
    });
    document.getElementById('btnSaveQuickBudget').addEventListener('click', saveQuickBudget);

    document.querySelectorAll('[data-qpreset]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('quickBudgetInput').value = btn.getAttribute('data-qpreset');
        SoundHaptic.playClick();
      });
    });

    // 9. Tab Anggaran Settings Controls
    const inputSettingBudget = document.getElementById('inputSettingBudget');
    inputSettingBudget.addEventListener('change', () => {
      const val = Math.max(10000, parseFloat(inputSettingBudget.value) || 300000);
      AppState.settings.budgetCap = val;
      AppState.saveAll();
      showToast(`Batas anggaran diperbarui: ${formatRp(val)}`, 'check');
      renderAll();
    });

    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.getAttribute('data-preset')) || 300000;
        inputSettingBudget.value = val;
        AppState.settings.budgetCap = val;
        AppState.saveAll();
        showToast(`Batas anggaran disetel: ${formatRp(val)}`, 'check');
        SoundHaptic.playClick();
        renderAll();
      });
    });

    const rangeCaution = document.getElementById('rangeCaution');
    const rangeDanger = document.getElementById('rangeDanger');
    rangeCaution.addEventListener('input', () => {
      AppState.settings.cautionThreshold = parseInt(rangeCaution.value, 10);
      AppState.saveAll();
      renderBudgetTab();
      renderSafetyCap();
    });
    rangeDanger.addEventListener('input', () => {
      AppState.settings.dangerThreshold = parseInt(rangeDanger.value, 10);
      AppState.saveAll();
      renderBudgetTab();
      renderSafetyCap();
    });

    // 10. History Actions (Repeat trip, Delete trip)
    const pastTripsList = document.getElementById('pastTripsList');
    pastTripsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const trip = AppState.tripHistory.find(t => t.id === id);
      if (!trip) return;

      if (action === 'repeat-trip') {
        if (confirm(`Salin ${trip.items ? trip.items.length : 0} barang dari "${trip.tripName}" ke keranjang belanja aktif?`)) {
          (trip.items || []).forEach(it => {
            AppState.cart.push({
              id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 4),
              name: it.name,
              category: it.category || 'bahan_pokok',
              unit: it.unit || 'pack',
              qty: it.qty || 1,
              basePrice: it.finalPrice || it.basePrice || 10000,
              discountType: 'none',
              discountValue: 0,
              discountTier2: 0,
              inCart: false,
              notes: 'Disalin dari ' + trip.tripName
            });
          });
          AppState.saveAll();
          showToast('Barang disalin ke keranjang aktif!', 'check-circle-2');
          SoundHaptic.playSuccess();
          switchTab('tabCart');
          renderAll();
        }
      } else if (action === 'delete-trip') {
        if (confirm(`Hapus catatan riwayat "${trip.tripName}"?`)) {
          AppState.tripHistory = AppState.tripHistory.filter(t => t.id !== id);
          AppState.saveAll();
          showToast('Sesi belanja dihapus dari riwayat', 'trash');
          SoundHaptic.playClick();
          renderHistoryTab();
        }
      }
    });

    // Reference DB search
    const searchRefInput = document.getElementById('searchRefInput');
    searchRefInput.addEventListener('input', () => {
      renderReferenceDbList(searchRefInput.value);
    });

    // Add New Reference Product manually
    document.getElementById('btnAddNewRefProduct').addEventListener('click', () => {
      const name = prompt('Nama produk acuan baru:');
      if (!name || !name.trim()) return;
      const priceStr = prompt(`Harga patokan bulan lalu untuk "${name}" (Rp):`, '25000');
      const price = parseFloat(priceStr);
      if (isNaN(price) || price <= 0) return;

      AppState.historyDb.push({
        id: 'h_' + Date.now(),
        name: name.trim(),
        category: 'bahan_pokok',
        unit: 'pack',
        lastPrice: price,
        lastDate: new Date().toISOString().split('T')[0]
      });
      AppState.saveAll();
      showToast(`Harga acuan "${name}" disimpan`, 'check');
      renderReferenceDbList(searchRefInput.value);
    });

    // Firebase Cloud Sync manual trigger
    const btnSync = document.getElementById('btnSyncFirebase');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        SoundHaptic.playClick();
        if (window.FirebaseSync && typeof window.FirebaseSync.pushLocalToCloud === 'function') {
          window.FirebaseSync.pushLocalToCloud();
          showToast('Menyinkronkan data ke Cloud Firestore...', 'cloud-upload');
        } else {
          showToast('Data tersimpan aman di lokal', 'check');
        }
      });
    }

    // Export / Import
    document.getElementById('btnExportData').addEventListener('click', () => {
      const exportObj = {
        cart: AppState.cart,
        settings: AppState.settings,
        historyDb: AppState.historyDb,
        tripHistory: AppState.tripHistory,
        exportDate: new Date().toISOString()
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `smartgrocery_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Data belanja berhasil diekspor!', 'download');
    });

    const fileImportInput = document.getElementById('fileImportInput');
    document.getElementById('btnImportData').addEventListener('click', () => {
      fileImportInput.click();
    });
    fileImportInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported.cart) AppState.cart = imported.cart;
          if (imported.settings) AppState.settings = imported.settings;
          if (imported.historyDb) AppState.historyDb = imported.historyDb;
          if (imported.tripHistory) AppState.tripHistory = imported.tripHistory;
          AppState.saveAll();
          showToast('Data berhasil diimpor!', 'check-circle-2');
          renderAll();
        } catch (err) {
          alert('Format file JSON tidak valid!');
        }
      };
      reader.readAsText(file);
    });

    // Reset Demo Data
    document.getElementById('btnResetData').addEventListener('click', () => {
      if (confirm('Kembalikan semua data ke simulasi demo awal anak kos?')) {
        AppState.resetToDemoData();
        showToast('Data demo berhasil direset!', 'rotate-ccw');
        renderAll();
      }
    });

    // Sound toggle
    const soundBtn = document.getElementById('btnToggleSound');
    soundBtn.addEventListener('click', () => {
      AppState.settings.soundEnabled = !AppState.settings.soundEnabled;
      AppState.saveAll();
      soundBtn.classList.toggle('active', AppState.settings.soundEnabled);
      showToast(AppState.settings.soundEnabled ? 'Efek suara aktif' : 'Efek suara senyap', 'volume-2');
    });

    // Update status bar clock
    function updateClock() {
      const now = new Date();
      const clockEl = document.getElementById('statusBarClock');
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
      }
    }
    updateClock();
    setInterval(updateClock, 30000);
  }

  // Master Render Function
  function renderAll() {
    renderSafetyCap();
    if (AppState.activeTab === 'tabCart') renderCartList();
    if (AppState.activeTab === 'tabHistory') renderHistoryTab();
    if (AppState.activeTab === 'tabBudget') renderBudgetTab();
    refreshIcons();
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose global for Firebase sync module
  window.AppState = AppState;
  window.renderAllUI = renderAll;

  // Initialize Application on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
    setupEventListeners();
    renderAll();
    refreshIcons();
    console.log('[Smart Grocery PWA] Berhasil diinisialisasi untuk belanja anak rantau.');
  });

})();
