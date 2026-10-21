# Smart Grocery Tracker 🛒✨

Aplikasi web modern **Smart Grocery Tracker** untuk mengelola daftar belanja kebutuhan sehari-hari, mencatat barang, memantau pengeluaran, mengendalikan batas anggaran (*budget safety cap*), dan menyinkronkan data antar-perangkat secara *real-time* (Laptop, Komputer Desktop, Tablet, dan Smartphone).

---

## 🌟 Fitur Utama & Kepatuhan Evaluasi

### 1. Autentikasi Pengguna & Keamanan Data (Auth)
- **Registrasi Akun Baru**: Formulir pendaftaran dengan validasi nama, format email, dan panjang kata sandi (minimal 6 karakter).
- **Login Email & Password**: Sistem login aman dengan token sesi persisten.
- **Enkripsi Kata Sandi Standar Industri**: Password di-*hash* menggunakan algoritma kriptografis **PBKDF2** (100.000 iterasi, SHA-512, dan garam unik 32-byte). Password tidak pernah disimpan dalam format teks biasa (*plaintext*).
- **Proteksi Halaman (Guarded Routes)**: Endpoint API dan antarmuka belanja terlindungi dari akses tanpa autentikasi (HTTP 401 Unauthorized).
- **Fitur Lupa Password**: Dialog pemulihan kata sandi dengan kode verifikasi reset.
- **Akun Demo Bawaan**: Tersedia tombol 1-klik *"Coba Langsung dengan Akun Demo (Budi)"* untuk pengujian instan.
- **Logout Aman**: Menghapus token sesi dari peramban dan membatalkan otorisasi backend.

---

### 2. Sinkronisasi Antar-Perangkat Real-Time (Cross-Device Sync)
- **Satu Akun untuk Semua Perangkat**: Akun yang sama dapat diakses secara bersamaan dari Laptop, Desktop, Tablet, dan Smartphone.
- **Server-Sent Events (SSE)**: Setiap penambahan, pengeditan, atau penghapusan barang disiarkan secara instan ke seluruh tab dan perangkat yang sedang terbuka.
- **Isolasi Data (Multi-Tenant)**: Setiap data belanjaan memiliki `user_id` pemilik. Pengguna A tidak dapat melihat, mengubah, atau menghapus barang milik Pengguna B.
- **Akses Jaringan Lokal (LAN)**: Server backend secara otomatis mendengarkan pada `0.0.0.0:3000` dan menampilkan alamat IP lokal (contoh: `http://192.168.0.210:3000`), memungkinkan pengujian langsung menggunakan peramban HP di jaringan Wi-Fi yang sama.
- **Dukungan Supabase PostgreSQL**: Dilengkapi dengan skema database lengkap (`supabase-schema.sql`) dengan **Row Level Security (RLS)** untuk opsi penggunaan backend cloud Supabase.

---

### 3. Dashboard Interaktif & Analisis Belanja
- **4 Kartu Ringkasan Metrik**:
  1. **Total Barang**: Jumlah seluruh kebutuhan dalam daftar belanja.
  2. **Sudah Dibeli**: Jumlah dan persentase barang yang telah masuk keranjang.
  3. **Belum Dibeli**: Jumlah barang yang masih harus dicari.
  4. **Estimasi Total Biaya**: Akumulasi subtotal harga seluruh barang.
- **Indikator Kesehatan Anggaran**: Meteran visual (*progress gauge*) dengan 3 zona:
  - 🟢 **Zona Aman**: Pengeluaran masih di bawah ambang waspada.
  - 🟡 **Zona Waspada**: Pengeluaran mendekati batas anggaran (default: $\ge 75\%$).
  - 🔴 **Zona Bahaya / Melebihi Anggaran**: Pengeluaran kritis atau melebihi limit dengan banner peringatan berkedip.
- **Alokasi Belanja per Kategori**: Visualisasi persentase dan nominal pengeluaran untuk 6 kategori utama.

---

### 4. Daftar Belanja Modern (Shopping List)
- **6 Kategori Standar**:
  - 🍎 **Fruits & Vegetables** (Buah & Sayuran)
  - 🥩 **Meat & Seafood** (Daging & Makanan Laut)
  - 🥛 **Dairy & Eggs** (Susu, Olahan Susu & Telur)
  - ☕ **Snacks & Beverages** (Minuman & Camilan)
  - 🧼 **Household** (Kebutuhan & Kebersihan Rumah Tangga)
  - 📦 **Other** (Lainnya)
- **Pencarian Real-Time**: Kolom pencarian instan berdasarkan nama produk.
- **Filter Kategori & Status**: Filter cepat berdasarkan kategori atau status pembelian (*Semua*, *⏳ Belum Dibeli*, *✅ Sudah Dibeli*).
- **Perhitungan Otomatis**: Subtotal ($qty \times price$) dihitung secara dinamis pada setiap baris barang dan modal input.
- **Tombol Stepper Kuantitas**: Tombol `[-]` dan `[+]` ukuran besar untuk menambah/mengurangi jumlah barang secara cepat saat mendorong troli supermarket.
- **Tandai Sudah Dibeli**: Kotak centang dengan animasi coret (*strike-through*) dan pembaruan instan ke database.
- **Dialog Konfirmasi Hapus**: Dialog konfirmasi sebelum penghapusan barang untuk mencegah kehilangan data yang tidak disengaja.

---

### 5. Pengendali Anggaran (Budget Tracker) & Uang Kas Dipegang (Cash Wallet)
- **Fitur Uang Belanja yang Dipegang (Cash on Hand)**:
  - Input jumlah uang fisik/kas yang Anda bawa ke supermarket/pasar (contoh: Rp 500.000).
  - Tombol pintas penambahan cepat: **+Rp 50.000**, **+Rp 100.000**, **+Rp 200.000**, **+Rp 500.000**.
  - **Bar Pelacak Uang Kas Real-Time** pada layar daftar belanja: Menampilkan uang dipegang, total belanjaan saat ini, dan sisa uang kas langsung saat barang ditambahkan.
  - **Peringatan Defisit Kas Otomatis**: Jika total belanjaan melebihi uang kas yang dipegang, muncul peringatan merah *"Uang belanjaan Anda kurang Rp X. Segera kurangi barang atau tambah uang kas!"*.
- **Pemotongan Uang Kas Otomatis Saat Selesai Belanja (Checkout)**:
  - Saat menekan *"Selesai Belanja / Kasir"*, struk menampilkan rincian: Uang Dipegang Awal, Total Belanja, dan Sisa Uang Kas.
  - Ketika pembayaran dikonfirmasi, sistem secara otomatis memotong uang kas Anda (`current_cash = current_cash - total_spent`) dan menyiarkan pembaruan secara *real-time*.
- **Pengendali Anggaran Bulanan (Budget Safety Cap)**:
  - Atur batas dompet belanja (*budget limit*) sesuai kemampuan finansial.
  - Tombol *preset* cepat: **Rp 200rb**, **Rp 300rb**, **Rp 500rb**, **Rp 750rb**, **Rp 1.000.000**.
  - Slider penyesuaian persentase **Ambang Waspada (Kuning)** dan **Ambang Bahaya (Merah)** lengkap dengan pratinjau nominal Rupiah.
  - Kartu tips belanja cerdas & hemat untuk kebutuhan harian.

---

### 6. Riwayat Belanja & Struk Kasir (Shopping History)
- Tombol **"Kasir / Selesai Belanja"** untuk menyelesaikan sesi belanja.
- Menyimpan snapshot rincian barang, nama supermarket/toko, tanggal belanja, uang kas sebelum, total belanja, dan sisa uang kas setelah dipotong.
- Opsi untuk mengosongkan keranjang aktif setelah pembayaran selesai.
- Rangkuman total belanja historis dan rata-rata pengeluaran per sesi.

---

## 💻 Panduan Menjalankan Aplikasi Secara Lokal

Aplikasi menggunakan Node.js bawaan tanpa memerlukan instalasi dependensi luar (`zero external dependencies`):

### 1. Menjalankan Server
Buka terminal / PowerShell di direktori proyek:
```bash
node server.js
```

### 2. Mengakses Aplikasi
Buka peramban (Chrome / Edge / Firefox / Safari):
- **Di Komputer / Laptop**: [http://localhost:3000](http://localhost:3000)
- **Di Smartphone / Tablet (Wi-Fi yang sama)**: Buka alamat IP LAN yang tercetak di terminal (contoh: `http://192.168.0.210:3000`).

---

## 📱 Bebas Tanpa Login & Otomatis Beda Tiap Perangkat (Zero-Login Device Architecture)

Sesuai kebutuhan pengguna, **aplikasi kini langsung dapat digunakan tanpa perlu login atau memasukkan password sama sekali**:

1. **Otomatis Terisolasi Tiap Perangkat**:
   - Ketika Anda membuka aplikasi di **Laptop** (`http://localhost:3000`), laptop otomatis memiliki ID perangkat dan data belanjaannya sendiri.
   - Ketika Anda membuka aplikasi di **HP / Smartphone** (`http://192.168.0.210:3000`), HP Anda otomatis memiliki ID perangkat dan data belanjaannya sendiri.
   - Daftar belanjaan, uang kas dipegang, dan anggaran di Laptop **tidak akan pernah bercampur** dengan HP.
2. **Tanpa Form Login yang Mengganggu**:
   - Langsung masuk ke Dashboard dan Daftar Belanja tanpa pop-up login.
   - Tidak ada batasan email, tidak ada kendala format password.
3. **Pengaturan & Ganti Perangkat**:
   - Klik lencana perangkat di sudut kanan atas (ikon 📱) untuk melihat ID perangkat, mengganti nama perangkat, atau membuat profil baru.

---

## 🧪 Rangkaian Pengujian Otomatis

Proyek ini dilengkapi dengan 5 berkas pengujian otomatis:

### 1. Pengujian Bebas Tanpa Login & Isolasi Antar-Perangkat (`test-no-login-devices.js`)
Menguji koneksi langsung tanpa login, pemisahan data 100% antar-device, dan pemotongan otomatis uang kas saat checkout:
```bash
node test-no-login-devices.js
```

### 2. Pengujian Dompet Kas & Multi-Device (`test-wallet-and-devices.js`)
Menguji penyesuaian uang belanja yang dipegang dan pemotongan otomatis uang kas saat checkout:
```bash
node test-wallet-and-devices.js
```

### 3. Pengujian Keamanan JSON & Endpoint Bebas (`test-free-auth.js`)
Menguji kebebasan username/password dan menjamin tidak ada respons error HTML yang memicu `"Unexpected token '<'"`:
```bash
node test-free-auth.js
```

### 4. Pengujian Unit, Integrasi & Keamanan (`test-app.js`)
Menguji penyajian aset statis, PWA, route protection, CRUD 6 kategori, dan riwayat checkout:
```bash
node test-app.js
```

### 5. Pengujian Sinkronisasi Multi-Perangkat (`test-e2e-simulation.js`)
Mensimulasikan skenario sinkronisasi real-time multi-perangkat:
```bash
node test-e2e-simulation.js
```

---

## 🗄️ Skema Database Supabase & PostgreSQL (RLS)

Jika ingin menghubungkan aplikasi ke layanan cloud Supabase, berkas [`supabase-schema.sql`](supabase-schema.sql) telah disediakan:

1. Buka dashboard proyek Supabase Anda: **SQL Editor**.
2. Salin seluruh isi berkas `supabase-schema.sql`.
3. Jalankan script SQL. Skema ini mencakup:
   - Tabel `public.profiles` dengan trigger pembuatan otomatis.
   - Tabel `public.grocery_items` dengan 6 kategori valid dan foreign key ke `auth.users`.
   - Tabel `public.budget_settings` untuk target limit dan ambang batas.
   - Tabel `public.wallets` untuk saldo uang belanja kas dipegang.
   - Tabel `public.shopping_history` dengan snapshot JSONB, `cash_before`, dan `cash_after`.
   - Kebijakan **Row Level Security (RLS)** aktif pada semua tabel (`auth.uid() = user_id`).
4. Konfigurasikan file `.env` berdasarkan template [`.env.example`](.env.example).

---

## 📱 Panduan Pemasangan sebagai PWA (Mobile App)

1. Buka alamat aplikasi di Chrome (Android) atau Safari (iOS).
2. Tekan menu opsi peramban (titik tiga atau tombol Share).
3. Pilih **"Tambahkan ke Layar Utama" (Add to Home Screen)**.
4. Aplikasi akan terpasang di smartphone layaknya aplikasi *native* mandiri tanpa address bar peramban.

---

## 📂 Struktur Berkas Proyek

```
c:\Users\Student\groceryapp/
├── index.html                   # Halaman utama aplikasi (Dashboard, Belanja, Anggaran, Dompet Kas, Riwayat)
├── css/
│   └── style.css                # Desain modern responsif (Hijau Segar, Putih Bersih, Grid Desktop & Mobile)
├── js/
│   └── app.js                   # Pengendali utama (State, API, SSE Real-time, Dompet Kas, Auto-Deduction)
├── server.js                    # Server backend Node.js (PBKDF2 Auth, REST API, Wallet & Auto-Deduction, SSE)
├── data/
│   └── database.json            # Penyimpanan persisten backend (Users, Items, Budget, Wallets, History)
├── test-wallet-and-devices.js   # Test suite uang belanja dipegang, pemotongan otomatis, dan multi-device
├── test-app.js                  # Test suite komprehensif (Unit, Integrasi, Security, Static Assets)
├── test-e2e-simulation.js       # Test skenario sinkronisasi multi-perangkat (Laptop & Smartphone)
├── supabase-schema.sql          # Skema database PostgreSQL & Supabase lengkap dengan RLS
├── .env.example                 # Contoh konfigurasi environment variables
├── manifest.json                # Web App Manifest untuk dukungan PWA
├── sw.js                        # Service Worker untuk caching & dukungan offline
└── README.md                    # Dokumentasi lengkap proyek
```