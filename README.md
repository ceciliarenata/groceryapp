# Smart Grocery & Budget Safety Tracker (PWA Mobile)

Aplikasi Web Mobile (Progressive Web App - PWA) modern bergaya *native smartphone application* untuk siswa rantau / mahasiswa kos yang berbelanja bulanan sambil mendorong troli supermarket.

---

## 📱 Arsitektur & Tampilan Mobile Sesuai Standar

1. **Format Layar Smartphone (Mobile UI)**:
   - Lebar maksimal `430px` (centered di layar monitor desktop dengan simulasi dynamic island dan bezel elegan).
   - Tampilan responsif 100% saat dibuka di layar smartphone nyata (iPhone / Android) dengan dukungan *safe-area insets*.
2. **Navigasi Bawah (Floating Bottom Navigation Bar)**:
   - Menu navigasi melayang (*glassmorphic blur*) dengan ikon Lucide untuk 3 tab utama:
     - 🛒 **Belanja**: Keranjang aktif, status troli, kendali Safety Cap, dan komparator harga.
     - 📜 **Riwayat**: Catatan resmi belanja bulan-bulan sebelumnya dan database harga patokan.
     - 🛡️ **Anggaran**: Konfigurasi batas dompet (Safety Cap), slider batas waspada/bahaya, dan analisis alokasi belanja per kategori.
3. **Ergonomi Belanja Supermarket (Thumb-Friendly)**:
   - Komponen tombol stepper kuantitas (`[-]` dan `[+]`) berukuran besar (ramah sentuhan satu tangan).
   - Checkbox lingkaran besar *"Di Troli"* untuk menandai barang yang sudah masuk ke fisik troli belanja.
   - Tidak ada layout tabel desktop yang melebar ke samping; menggunakan layout kartu (*card layout*) dengan hierarki visual kontras tinggi.
4. **Dukungan PWA (Progressive Web App)**:
   - Mobile viewport: `viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`.
   - Web App Manifest (`manifest.json`): Mode tampilan `standalone`, ikon aplikasi 192x192 & 512x512, warna tema gelap `#090d16`.
   - Service Worker (`sw.js`): Caching offline (*stale-while-revalidate*) untuk dapat dibuka tanpa koneksi internet di lorong supermarket yang minim sinyal.

---

## ✅ Pemenuhan Checklist Kebutuhan Fungsional (SRS)

| Fitur SRS | Implementasi |
| :--- | :--- |
| **Pencatatan Item Belanja Lengkap** | Menyimpan nama produk (dengan *autocomplete* rekomendasi), kategori barang (Bahan Pokok, Makanan, Cuci, Bumbu, Snack), satuan (`kg`, `liter`, `pcs`, `pack`, `pouch`, dll), kuantitas, dan harga satuan. |
| **Perhitungan Kuantitas Otomatis** | Perubahan angka kuantitas (Qty) secara realtime langsung mengalikan harga satuan setelah diskon ke total baris item dan mengupdate total keranjang serta sisa anggaran. |
| **Kalkulator Diskon Bertingkat** | Menghitung diskon tunggal (contoh: `25%`), potongan nominal (contoh: `Rp 5.000`), maupun **diskon bertingkat / bertumpuk** (contoh: `50% + 20%` dengan rumus matematis tepat: $P \times (1 - d_1) \times (1 - d_2)$, penghematan efektif 60%). Dilengkapi breakdown matematika interaktif. |
| **Komparator Harga Realtime vs Bulan Lalu** | Deteksi instan saat nama produk atau harga satuan diinput dengan indikator visual:<br>• **Panah Merah Naik (↑)**: Jika harga naik dibanding bulan lalu (dilengkapi selisih nominal dan persentase).<br>• **Panah Hijau Turun (↓)**: Jika harga turun / promo dibanding bulan lalu.<br>• **Tanda Setara (=)**: Jika harga stabil/sama.<br>• **Bintang (✨)**: Jika item baru (disimpan sebagai acuan). |
| **Pengendali Anggaran (Safety Cap)** | Input batas maksimal dompet dengan meteran visual tiga zona: **Aman (Hijau)**, **Waspada (Kuning)**, dan **Bahaya Berkedip (Merah Menyala)** jika total keranjang mendekati atau melebihi limit. |
| **Riwayat & Database Belanja** | Tombol *Kasir / Selesai* menyimpan data belanja ke penyimpanan data lokal (`localStorage`), dan **secara otomatis memperbarui harga acuan resmi** untuk belanja bulan berikutnya. Mendukung ekspor/impor JSON dan salin daftar barang (*repeat trip*). |

---

## 🚀 Cara Menjalankan Aplikasi Secara Lokal

Aplikasi menggunakan server HTTP Node.js bawaan tanpa dependensi pihak ketiga:

```bash
# 1. Jalankan server lokal
node server.js

# 2. Buka di browser
# http://localhost:3000
```

Untuk memasang ke smartphone (PWA):
1. Buka `http://localhost:3000` (atau IP lokal komputer Anda, misal `http://192.168.1.X:3000`) di browser Chrome (Android) atau Safari (iOS).
2. Pilih menu browser **"Tambahkan ke Layar Utama" (Add to Home Screen)**.
3. Aplikasi akan terpasang di smartphone Anda sebagai aplikasi *native* mandiri tanpa address bar browser.