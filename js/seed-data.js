/**
 * seed-data.js
 * Data awal realistis untuk simulasi belanja bulanan anak rantau / mahasiswa kos
 */

const SEED_DATA = {
  categories: [
    { id: 'bahan_pokok', name: 'Bahan Pokok', icon: 'wheat', color: '#10b981' },
    { id: 'makanan_minuman', name: 'Makanan & Minuman', icon: 'coffee', color: '#3b82f6' },
    { id: 'perlengkapan_kebersihan', name: 'Perlengkapan Cuci & Mandi', icon: 'sparkles', color: '#8b5cf6' },
    { id: 'bumbu_dapur', name: 'Bumbu & Dapur', icon: 'flame', color: '#f59e0b' },
    { id: 'camilan', name: 'Camilan & Snack', icon: 'cookie', color: '#ec4899' },
    { id: 'lainnya', name: 'Lain-lain', icon: 'package', color: '#64748b' }
  ],

  units: ['pcs', 'pack', 'kg', 'liter', 'pouch', 'botol', 'kaleng', 'sachet', 'dus'],

  // Database referensi harga belanja bulan lalu (September 2026)
  historicalDatabase: [
    { id: 'h1', name: 'Beras Ramos 5kg', category: 'bahan_pokok', unit: 'pack', lastPrice: 74000, lastDate: '2026-09-05' },
    { id: 'h2', name: 'Minyak Goreng Sania 2L', category: 'bahan_pokok', unit: 'pouch', lastPrice: 34000, lastDate: '2026-09-05' },
    { id: 'h3', name: 'Telur Ayam 1kg', category: 'bahan_pokok', unit: 'kg', lastPrice: 27500, lastDate: '2026-09-05' },
    { id: 'h4', name: 'Indomie Goreng (Pack isi 5)', category: 'makanan_minuman', unit: 'pack', lastPrice: 15000, lastDate: '2026-09-05' },
    { id: 'h5', name: 'Susu UHT Full Cream 1L', category: 'makanan_minuman', unit: 'pack', lastPrice: 19500, lastDate: '2026-09-05' },
    { id: 'h6', name: 'Deterjen Rinso Molto 750g', category: 'perlengkapan_kebersihan', unit: 'pouch', lastPrice: 21000, lastDate: '2026-09-05' },
    { id: 'h7', name: 'Sabun Cuci Piring Sunlight 700ml', category: 'perlengkapan_kebersihan', unit: 'pouch', lastPrice: 13500, lastDate: '2026-09-05' },
    { id: 'h8', name: 'Pasta Gigi Pepsodent 190g', category: 'perlengkapan_kebersihan', unit: 'pcs', lastPrice: 14500, lastDate: '2026-09-05' },
    { id: 'h9', name: 'Kecap Manis Bango 520ml', category: 'bumbu_dapur', unit: 'pouch', lastPrice: 22500, lastDate: '2026-09-05' },
    { id: 'h10', name: 'Saus Sambal ABC 275ml', category: 'bumbu_dapur', unit: 'botol', lastPrice: 12000, lastDate: '2026-09-05' },
    { id: 'h11', name: 'Biskuit Roma Kelapa 300g', category: 'camilan', unit: 'pack', lastPrice: 10500, lastDate: '2026-09-05' },
    { id: 'h12', name: 'Kopi Kapal Api Spesial Mix 10s', category: 'makanan_minuman', unit: 'pack', lastPrice: 14000, lastDate: '2026-09-05' },
    { id: 'h13', name: 'Shampoo Lifebuoy 170ml', category: 'perlengkapan_kebersihan', unit: 'botol', lastPrice: 18000, lastDate: '2026-09-05' },
    { id: 'h14', name: 'Sabun Mandi Nuvo Family 3x110g', category: 'perlengkapan_kebersihan', unit: 'pack', lastPrice: 9500, lastDate: '2026-09-05' },
    { id: 'h15', name: 'Gula Pasir Gulaku 1kg', category: 'bahan_pokok', unit: 'pack', lastPrice: 17500, lastDate: '2026-09-05' },
    { id: 'h16', name: 'Tisu Paseo 250 Sheet', category: 'lainnya', unit: 'pack', lastPrice: 12000, lastDate: '2026-09-05' },
    { id: 'h17', name: 'Sarden ABC Tomat 155g', category: 'makanan_minuman', unit: 'kaleng', lastPrice: 10500, lastDate: '2026-09-05' }
  ],

  // Sesi keranjang aktif belanja bulanan saat ini (Oktober 2026)
  initialCart: [
    {
      id: 'item_1',
      name: 'Beras Ramos 5kg',
      category: 'bahan_pokok',
      unit: 'pack',
      qty: 1,
      basePrice: 76000, // Naik Rp 2.000 vs bln lalu (74.000)
      discountType: 'none',
      discountValue: 0,
      discountTier2: 0,
      inCart: true,
      notes: 'Bahan pokok utama kos'
    },
    {
      id: 'item_2',
      name: 'Minyak Goreng Sania 2L',
      category: 'bahan_pokok',
      unit: 'pouch',
      qty: 1,
      basePrice: 32500, // Turun Rp 1.500 vs bln lalu (34.000) -> Promo!
      discountType: 'none',
      discountValue: 0,
      discountTier2: 0,
      inCart: true,
      notes: 'Lagi ada promo JSM supermarket'
    },
    {
      id: 'item_3',
      name: 'Telur Ayam 1kg',
      category: 'bahan_pokok',
      unit: 'kg',
      qty: 1,
      basePrice: 27500, // Sama persis (27.500)
      discountType: 'none',
      discountValue: 0,
      discountTier2: 0,
      inCart: true,
      notes: 'Cek jangan ada yang retak'
    },
    {
      id: 'item_4',
      name: 'Susu UHT Full Cream 1L',
      category: 'makanan_minuman',
      unit: 'pack',
      qty: 2,
      basePrice: 22000, // Promo Diskon Bertingkat: 50% + 20%
      discountType: 'tiered',
      discountValue: 50,
      discountTier2: 20,
      inCart: false,
      notes: 'Promo clearance rak susu'
    },
    {
      id: 'item_5',
      name: 'Deterjen Rinso Molto 750g',
      category: 'perlengkapan_kebersihan',
      unit: 'pouch',
      qty: 1,
      basePrice: 24000, // Naik Rp 3.000 vs bln lalu (21.000)
      discountType: 'single',
      discountValue: 10, // Diskon 10%
      discountTier2: 0,
      inCart: true,
      notes: 'Stok cuci baju sebulan'
    },
    {
      id: 'item_6',
      name: 'Sabun Cuci Piring Sunlight 700ml',
      category: 'perlengkapan_kebersihan',
      unit: 'pouch',
      qty: 1,
      basePrice: 13500, // Sama persis
      discountType: 'none',
      discountValue: 0,
      discountTier2: 0,
      inCart: false,
      notes: 'Beli kemasan refill pouch'
    },
    {
      id: 'item_7',
      name: 'Indomie Goreng (Pack isi 5)',
      category: 'makanan_minuman',
      unit: 'pack',
      qty: 2,
      basePrice: 14500, // Turun Rp 500 vs bln lalu (15.000)
      discountType: 'none',
      discountValue: 0,
      discountTier2: 0,
      inCart: true,
      notes: 'Stok darurat akhir bulan'
    }
  ],

  // Pengaturan batas anggaran (Safety Cap) anak kos
  settings: {
    budgetCap: 300000, // Rp 300.000 batas maksimal dompet belanja
    cautionThreshold: 75, // 75% mulai kuning/waspada
    dangerThreshold: 90,  // 90% mulai merah/bahaya
    currency: 'IDR',
    soundEnabled: true,
    hapticEnabled: true
  },

  // Riwayat belanja terdahulu
  tripHistory: [
    {
      id: 'trip_2026_09',
      tripName: 'Belanja Bulanan Kos - September 2026',
      date: '2026-09-05T14:30:00.000Z',
      storeName: 'Super Indo Sudirman',
      budgetCap: 300000,
      totalSpent: 278000,
      itemCount: 10,
      items: [
        { name: 'Beras Ramos 5kg', qty: 1, unit: 'pack', finalPrice: 74000, category: 'bahan_pokok' },
        { name: 'Minyak Goreng Sania 2L', qty: 1, unit: 'pouch', finalPrice: 34000, category: 'bahan_pokok' },
        { name: 'Telur Ayam 1kg', qty: 1, unit: 'kg', finalPrice: 27500, category: 'bahan_pokok' },
        { name: 'Indomie Goreng (Pack isi 5)', qty: 2, unit: 'pack', finalPrice: 15000, category: 'makanan_minuman' },
        { name: 'Deterjen Rinso Molto 750g', qty: 1, unit: 'pouch', finalPrice: 21000, category: 'perlengkapan_kebersihan' },
        { name: 'Sabun Cuci Piring Sunlight 700ml', qty: 1, unit: 'pouch', finalPrice: 13500, category: 'perlengkapan_kebersihan' },
        { name: 'Pasta Gigi Pepsodent 190g', qty: 1, unit: 'pcs', finalPrice: 14500, category: 'perlengkapan_kebersihan' },
        { name: 'Kecap Manis Bango 520ml', qty: 1, unit: 'pouch', finalPrice: 22500, category: 'bumbu_dapur' },
        { name: 'Kopi Kapal Api Spesial Mix 10s', qty: 1, unit: 'pack', finalPrice: 14000, category: 'makanan_minuman' },
        { name: 'Biskuit Roma Kelapa 300g', qty: 2, unit: 'pack', finalPrice: 10500, category: 'camilan' }
      ]
    },
    {
      id: 'trip_2026_08',
      tripName: 'Belanja Bulanan Kos - Agustus 2026',
      date: '2026-08-03T16:15:00.000Z',
      storeName: 'Hypermart Mall',
      budgetCap: 320000,
      totalSpent: 295000,
      itemCount: 9,
      items: [
        { name: 'Beras Ramos 5kg', qty: 1, unit: 'pack', finalPrice: 73000, category: 'bahan_pokok' },
        { name: 'Minyak Goreng Sania 2L', qty: 1, unit: 'pouch', finalPrice: 35000, category: 'bahan_pokok' },
        { name: 'Telur Ayam 1kg', qty: 1.5, unit: 'kg', finalPrice: 28000, category: 'bahan_pokok' }
      ]
    }
  ]
};

// Ekspor ke window jika di browser
if (typeof window !== 'undefined') {
  window.SEED_DATA = SEED_DATA;
}
