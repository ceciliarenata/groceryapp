/**
 * comparator.js
 * Modul pembanding harga realtime vs data belanja bulan lalu
 */

const PriceComparator = {
  /**
   * Cari produk di database historis berdasarkan nama
   * @param {string} productName
   * @param {Array} historyDb
   * @returns {Object|null}
   */
  findHistoricalItem(productName, historyDb = []) {
    if (!productName || !historyDb || !historyDb.length) return null;
    const cleanQuery = productName.trim().toLowerCase();

    // 1. Coba exact match
    let match = historyDb.find(item => item.name.toLowerCase() === cleanQuery);
    if (match) return match;

    // 2. Coba partial match (includes)
    match = historyDb.find(item => {
      const name = item.name.toLowerCase();
      return name.includes(cleanQuery) || cleanQuery.includes(name);
    });

    return match || null;
  },

  /**
   * Bandingkan harga sekarang vs harga bulan lalu
   * @param {number} currentPrice - Harga satuan saat ini
   * @param {number|null} lastMonthPrice - Harga bulan lalu (jika ada)
   * @returns {Object} Hasil komparasi lengkap dengan status, simbol, badge, pesan
   */
  compare(currentPrice, lastMonthPrice) {
    currentPrice = Number(currentPrice) || 0;
    
    if (lastMonthPrice === null || lastMonthPrice === undefined || isNaN(lastMonthPrice) || lastMonthPrice <= 0) {
      return {
        status: 'new',
        symbol: '✨',
        arrow: '',
        colorClass: 'trend-new',
        diffNominal: 0,
        diffPercent: 0,
        lastPrice: null,
        message: 'Item baru! Belum ada data bulan lalu.',
        badgeHtml: `<span class="price-trend-badge trend-new"><i data-lucide="sparkles"></i> Item Baru</span>`,
        shortBadgeText: '✨ Item Baru',
        tipText: 'Akan disimpan sebagai harga patokan untuk belanja bulan depan.'
      };
    }

    lastMonthPrice = Number(lastMonthPrice);

    if (currentPrice > lastMonthPrice) {
      const diffNominal = currentPrice - lastMonthPrice;
      const diffPercent = Math.round((diffNominal / lastMonthPrice) * 1000) / 10;

      return {
        status: 'higher',
        symbol: '↑',
        arrow: 'up',
        colorClass: 'trend-up',
        diffNominal,
        diffPercent,
        lastPrice: lastMonthPrice,
        message: `Naik Rp ${this.formatRupiah(diffNominal)} (+${diffPercent}%) vs bln lalu`,
        badgeHtml: `<span class="price-trend-badge trend-up" title="Harga naik dibanding bulan lalu">
          <span class="trend-icon">↑</span> Naik +${diffPercent}%
        </span>`,
        shortBadgeText: `↑ +${diffPercent}%`,
        tipText: `Bulan lalu: Rp ${this.formatRupiah(lastMonthPrice)}. Waspada inflasi/harga naik!`
      };
    } else if (currentPrice < lastMonthPrice) {
      const diffNominal = lastMonthPrice - currentPrice;
      const diffPercent = Math.round((diffNominal / lastMonthPrice) * 1000) / 10;

      return {
        status: 'lower',
        symbol: '↓',
        arrow: 'down',
        colorClass: 'trend-down',
        diffNominal,
        diffPercent,
        lastPrice: lastMonthPrice,
        message: `Turun Rp ${this.formatRupiah(diffNominal)} (-${diffPercent}%) vs bln lalu`,
        badgeHtml: `<span class="price-trend-badge trend-down" title="Harga lebih murah dibanding bulan lalu">
          <span class="trend-icon">↓</span> Promo -${diffPercent}%
        </span>`,
        shortBadgeText: `↓ -${diffPercent}%`,
        tipText: `Bulan lalu: Rp ${this.formatRupiah(lastMonthPrice)}. Hemat Rp ${this.formatRupiah(diffNominal)}!`
      };
    } else {
      return {
        status: 'equal',
        symbol: '=',
        arrow: 'equal',
        colorClass: 'trend-equal',
        diffNominal: 0,
        diffPercent: 0,
        lastPrice: lastMonthPrice,
        message: `Sama dengan harga bulan lalu (Rp ${this.formatRupiah(lastMonthPrice)})`,
        badgeHtml: `<span class="price-trend-badge trend-equal" title="Harga sama persis dengan bulan lalu">
          <span class="trend-icon">=</span> Stabil
        </span>`,
        shortBadgeText: `= Rp ${this.formatRupiah(lastMonthPrice)}`,
        tipText: `Harga stabil, sama persis dengan bulan lalu.`
      };
    }
  },

  formatRupiah(val) {
    return new Intl.NumberFormat('id-ID').format(Math.round(val || 0));
  }
};

if (typeof window !== 'undefined') {
  window.PriceComparator = PriceComparator;
}
