// offline.js - Simple offline expense tracker with persistence and premium UI

// Utility: format number as Indonesian Rupiah
function formatRupiah(num) {
  const n = Math.round(Number(num) || 0);
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
}

// Application state stored in localStorage
const STORAGE_KEYS = {
  cash: 'offline_cash',
  history: 'offline_history'
};

let cash = 0; // current cash amount
let history = [];

// DOM elements
const elCurrentCash = document.getElementById('currentCash');
const elRemainingCash = document.getElementById('remainingCash');
const elTotalSpent = document.getElementById('totalSpent');
const elHistoryBody = document.getElementById('historyBody');
const elInitialCash = document.getElementById('initialCash');
const elSetCashBtn = document.getElementById('setCashBtn');
const elItemName = document.getElementById('itemName');
const elItemPrice = document.getElementById('itemPrice');
const elAddItemBtn = document.getElementById('addItemBtn');

// Initialize application state from localStorage
function loadState() {
  const cashStored = localStorage.getItem(STORAGE_KEYS.cash);
  cash = cashStored ? Number(cashStored) : 0;

  const histStored = localStorage.getItem(STORAGE_KEYS.history);
  try {
    history = histStored ? JSON.parse(histStored) : [];
    if (!Array.isArray(history)) history = [];
  } catch (e) {
    history = [];
  }
}

// Persist state to localStorage
function saveState() {
  localStorage.setItem(STORAGE_KEYS.cash, cash);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
}

// Render UI based on current state
function render() {
  // Cash displays
  elCurrentCash.textContent = formatRupiah(cash);

  // Calculate totals
  const totalSpent = history.reduce((sum, it) => sum + (Number(it.price) || 0), 0);
  const remaining = cash - totalSpent;

  elTotalSpent.textContent = formatRupiah(totalSpent);
  elRemainingCash.textContent = formatRupiah(remaining >= 0 ? remaining : 0);
  elRemainingCash.style.color = remaining >= 0 ? 'var(--primary-600)' : 'var(--accent-rose)';

  // Populate history table
  elHistoryBody.innerHTML = '';
  history.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'history-row fade-in';
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${entry.name}</td>
      <td>${formatRupiah(entry.price)}</td>
    `;
    elHistoryBody.appendChild(tr);
  });
}

// Event: set / update cash amount
function handleSetCash() {
  const val = Number(elInitialCash.value);
  if (isNaN(val) || val < 0) {
    alert('Masukkan nominal uang kas yang valid');
    return;
  }
  cash = val;
  saveState();
  render();
  elInitialCash.value = '';
}

// Event: add a purchase item
function handleAddItem() {
  const name = elItemName.value.trim();
  const price = Number(elItemPrice.value);
  if (!name) {
    alert('Nama barang tidak boleh kosong');
    return;
  }
  if (isNaN(price) || price < 0) {
    alert('Masukkan harga yang valid');
    return;
  }
  history.push({ name, price });
  saveState();
  render();
  elItemName.value = '';
  elItemPrice.value = '';
}

// Attach listeners after DOM ready
function init() {
  loadState();
  render();

  if (elSetCashBtn) elSetCashBtn.addEventListener('click', handleSetCash);
  if (elAddItemBtn) elAddItemBtn.addEventListener('click', handleAddItem);

  // Optional: enable Enter key for quick add
  elItemPrice && elItemPrice.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleAddItem();
  });
}

document.addEventListener('DOMContentLoaded', init);

/* Simple fade‑in animation for new rows */
const style = document.createElement('style');
style.textContent = `
  .fade-in {opacity: 0; animation: fadeIn 0.4s forwards;}
  @keyframes fadeIn {to {opacity: 1;}}
`;
document.head.appendChild(style);
