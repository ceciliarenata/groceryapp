/**
 * firebase-sync.js
 * Modul Integrasi Cloud Firestore Hybrid (Offline-first & Realtime Cloud Sync)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot,
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// Konfigurasi Firebase resmi dari pengguna
const firebaseConfig = {
  apiKey: "AIzaSyCkmVKMRc-7vhjT4J-YMpKMjfy7JTfmvEw",
  authDomain: "groceryapp-b84e9.firebaseapp.com",
  projectId: "groceryapp-b84e9",
  storageBucket: "groceryapp-b84e9.firebasestorage.app",
  messagingSenderId: "889917960817",
  appId: "1:889917960817:web:b3fcc46d5a856a677d21d0"
};

const FirebaseSync = {
  app: null,
  db: null,
  userId: 'user_kos_default', // ID dokumen profil siswa rantau
  isOnline: navigator.onLine,
  syncStatus: 'connecting', // 'connected' | 'syncing' | 'offline' | 'error'
  isReceivingRemoteUpdate: false,

  async init() {
    this.updateStatusUI('connecting', 'Menghubungkan ke Firebase...');

    try {
      // 1. Dapatkan atau buat Persistent User ID di perangkat ini
      let storedUid = localStorage.getItem('smartgrocery_user_uid');
      if (!storedUid) {
        storedUid = 'kos_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('smartgrocery_user_uid', storedUid);
      }
      this.userId = storedUid;

      // 2. Inisialisasi Firebase App & Firestore
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);

      console.log('[Firebase] Berhasil menginisialisasi Firestore untuk project:', firebaseConfig.projectId);

      // 3. Setup listener perubahan jaringan (Online/Offline)
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateStatusUI('connected', 'Tersambung (Online)');
        this.pushLocalToCloud(); // Otomatis sync perubahan yang terjadi saat offline
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.updateStatusUI('offline', 'Mode Offline (Lokal)');
      });

      // 4. Hubungkan realtime snapshot listener ke Firestore
      this.listenToCloudChanges();

      // 5. Setup event listener saat aplikasi lokal menyimpan data
      window.addEventListener('smartgrocery:save', (e) => {
        if (!this.isReceivingRemoteUpdate) {
          this.pushLocalToCloud(e.detail);
        }
      });

    } catch (err) {
      console.warn('[Firebase] Inisialisasi offline fallback:', err);
      this.updateStatusUI('offline', 'Lokal (Firebase Offline)');
    }
  },

  /**
   * Mendengarkan perubahan data secara realtime dari Firestore
   */
  listenToCloudChanges() {
    if (!this.db) return;

    const docRef = doc(this.db, 'grocery_users', this.userId);

    onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        console.log('[Firebase] Menerima data terbaru dari Cloud Firestore:', cloudData);

        // Jika ada perubahan dari remote (misal dibuka dari smartphone lain)
        if (window.AppState) {
          this.isReceivingRemoteUpdate = true;
          try {
            if (cloudData.cart && Array.isArray(cloudData.cart)) {
              window.AppState.cart = cloudData.cart;
            }
            if (cloudData.settings) {
              window.AppState.settings = Object.assign({}, window.AppState.settings, cloudData.settings);
            }
            if (cloudData.historyDb && Array.isArray(cloudData.historyDb)) {
              window.AppState.historyDb = cloudData.historyDb;
            }
            if (cloudData.tripHistory && Array.isArray(cloudData.tripHistory)) {
              window.AppState.tripHistory = cloudData.tripHistory;
            }

            // Simpan ke cache lokal
            window.AppState.saveLocallyOnly();
            if (typeof window.renderAllUI === 'function') {
              window.renderAllUI();
            }
            this.updateStatusUI('connected', 'Sinkron Cloud Aktif');
          } finally {
            this.isReceivingRemoteUpdate = false;
          }
        }
      } else {
        // Dokumen belum ada di Firestore -> Unggah data lokal awal
        console.log('[Firebase] Dokumen belum ada di cloud, mengunggah data lokal...');
        this.pushLocalToCloud();
      }
    }, (error) => {
      console.warn('[Firebase Snapshot Warning]:', error.message);
      this.updateStatusUI('offline', 'Lokal (Offline)');
    });
  },

  /**
   * Mengirim data lokal ke Firestore
   */
  async pushLocalToCloud(data = null) {
    if (!this.db || !window.AppState) return;

    const payload = data || {
      cart: window.AppState.cart,
      settings: window.AppState.settings,
      historyDb: window.AppState.historyDb,
      tripHistory: window.AppState.tripHistory,
      updatedAt: new Date().toISOString(),
      device: navigator.userAgent
    };

    this.updateStatusUI('syncing', 'Menyinkronkan...');

    try {
      const docRef = doc(this.db, 'grocery_users', this.userId);
      await setDoc(docRef, payload, { merge: true });
      this.updateStatusUI('connected', 'Tersinkron Cloud');
      console.log('[Firebase] Data berhasil disinkronkan ke Cloud Firestore.');
    } catch (err) {
      console.warn('[Firebase Sync Error]:', err.message);
      // Fallback tetap aman di LocalStorage
      this.updateStatusUI('offline', 'Tersimpan di Lokal');
    }
  },

  /**
   * Memperbarui visual indikator status Cloud Sync di header UI
   */
  updateStatusUI(status, text) {
    this.syncStatus = status;
    const badge = document.getElementById('cloudSyncStatus');
    const badgeText = document.getElementById('cloudStatusText');
    const badgeDot = document.getElementById('cloudStatusDot');

    if (!badge || !badgeText) return;

    badge.className = `cloud-sync-badge status-${status}`;
    badgeText.textContent = text;

    if (badgeDot) {
      if (status === 'connected') {
        badgeDot.style.color = '#34d399';
      } else if (status === 'syncing') {
        badgeDot.style.color = '#38bdf8';
      } else {
        badgeDot.style.color = '#f59e0b';
      }
    }
  }
};

// Ekspos ke window
window.FirebaseSync = FirebaseSync;

// Mulai inisialisasi saat window dimuat
window.addEventListener('DOMContentLoaded', () => {
  FirebaseSync.init();
});
