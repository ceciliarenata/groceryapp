/**
 * discounts.js
 * Modul kalkulator diskon tunggal, diskon bertingkat (tiered discount), dan diskon nominal
 */

const DiscountCalculator = {
  /**
   * Menghitung harga akhir dan penghematan berdasarkan tipe diskon
   * @param {number} basePrice - Harga sebelum diskon
   * @param {string} discountType - 'none' | 'single' | 'tiered' | 'nominal'
   * @param {number} discountValue - Nilai diskon pertama (% atau Rp)
   * @param {number} discountTier2 - Nilai diskon kedua (%) jika bertingkat
   * @returns {Object} { finalPrice, savedAmount, effectivePercentage, summaryText }
   */
  calculate(basePrice, discountType = 'none', discountValue = 0, discountTier2 = 0) {
    basePrice = Math.max(0, Number(basePrice) || 0);
    discountValue = Math.max(0, Number(discountValue) || 0);
    discountTier2 = Math.max(0, Number(discountTier2) || 0);

    if (basePrice === 0 || discountType === 'none' || (!discountValue && !discountTier2)) {
      return {
        basePrice,
        finalPrice: basePrice,
        savedAmount: 0,
        effectivePercentage: 0,
        hasDiscount: false,
        summaryText: 'Tanpa Diskon'
      };
    }

    let finalPrice = basePrice;
    let effectivePercentage = 0;
    let summaryText = '';

    if (discountType === 'single') {
      // Diskon tunggal misal 25%
      const d1 = Math.min(100, discountValue);
      const discountCut = basePrice * (d1 / 100);
      finalPrice = Math.max(0, basePrice - discountCut);
      effectivePercentage = d1;
      summaryText = `Diskon ${d1}%`;
    } else if (discountType === 'tiered') {
      // Diskon bertingkat / bertumpuk: (misal 50% + 20%)
      // Rumus: P_setelah_1 = P * (1 - d1/100)
      //        P_setelah_2 = P_setelah_1 * (1 - d2/100)
      const d1 = Math.min(100, discountValue);
      const d2 = Math.min(100, discountTier2);
      
      const priceAfterFirst = basePrice * (1 - (d1 / 100));
      finalPrice = Math.max(0, priceAfterFirst * (1 - (d2 / 100)));
      
      // Total effective discount = 1 - (1 - d1/100) * (1 - d2/100)
      effectivePercentage = (1 - ((1 - (d1 / 100)) * (1 - (d2 / 100)))) * 100;
      effectivePercentage = Math.round(effectivePercentage * 10) / 10;
      summaryText = `Diskon ${d1}% + ${d2}% (Efektif ${effectivePercentage}%)`;
    } else if (discountType === 'nominal') {
      // Potongan langsung nominal misal Rp 5.000
      const cut = Math.min(basePrice, discountValue);
      finalPrice = Math.max(0, basePrice - cut);
      effectivePercentage = basePrice > 0 ? (cut / basePrice) * 100 : 0;
      effectivePercentage = Math.round(effectivePercentage * 10) / 10;
      summaryText = `Potongan Rp ${this.formatRupiah(cut)}`;
    }

    // Bulatkan finalPrice ke bilangan bulat
    finalPrice = Math.round(finalPrice);
    const savedAmount = Math.max(0, basePrice - finalPrice);

    return {
      basePrice,
      finalPrice,
      savedAmount,
      effectivePercentage,
      hasDiscount: savedAmount > 0,
      summaryText
    };
  },

  /**
   * Helper parsing teks fleksibel, misal "50%+20%" atau "25%"
   */
  parseDiscountString(str) {
    if (!str || typeof str !== 'string') return { type: 'none', v1: 0, v2: 0 };
    const clean = str.replace(/\s+/g, '').replace(/%/g, '');
    if (clean.includes('+')) {
      const parts = clean.split('+');
      return {
        type: 'tiered',
        v1: parseFloat(parts[0]) || 0,
        v2: parseFloat(parts[1]) || 0
      };
    }
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 0) {
      return { type: 'single', v1: val, v2: 0 };
    }
    return { type: 'none', v1: 0, v2: 0 };
  },

  formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID').format(Math.round(amount || 0));
  }
};

if (typeof window !== 'undefined') {
  window.DiscountCalculator = DiscountCalculator;
}
