# Setup online: Firebase + Vercel

Dikerjakan satu orang (sains data), sekitar 20 menit. Hasilnya: room bisa dipakai antar HP, dan game punya link online untuk juri.

## A. Firebase (room antar perangkat)

1. Buka https://console.firebase.google.com → **Add project** → nama `roket-geprek` → Google Analytics boleh dimatikan → **Create project**.
2. Menu kiri **Build → Authentication** → **Get started** → tab **Sign-in method** → pilih **Anonymous** → **Enable** → **Save**.
3. Menu kiri **Build → Realtime Database** → **Create Database** → lokasi **Singapore (asia-southeast1)** → pilih **Start in locked mode** → **Enable**.
4. Masih di Realtime Database, tab **Rules** → hapus isinya, tempel isi file `database.rules.json` dari repo ini → **Publish**.
5. Klik ikon roda gigi **Project settings** → bagian **Your apps** → klik ikon **</>** (Web) → nama `roket-geprek-web` → **Register app** (Firebase Hosting tidak perlu dicentang).
6. Muncul `firebaseConfig`. Salin nilainya ke file `.env` di folder repo (salin dari `.env.example`):

   | Di firebaseConfig | Di .env |
   |---|---|
   | apiKey | VITE_FIREBASE_API_KEY |
   | authDomain | VITE_FIREBASE_AUTH_DOMAIN |
   | databaseURL | VITE_FIREBASE_DATABASE_URL |
   | projectId | VITE_FIREBASE_PROJECT_ID |
   | appId | VITE_FIREBASE_APP_ID |

   Kalau `databaseURL` tidak muncul, ambil dari halaman Realtime Database (alamat di atas data, berakhiran `firebasedatabase.app`).
7. Jalankan `npm run dev`, buka di laptop dan di HP (alamat "Network"). Lobby harus menulis **Mode koneksi: online (Firebase)**. Buat room di laptop, gabung dari HP.

`.env` jangan di-commit (sudah ada di `.gitignore`). Kunci web Firebase memang terlihat di browser; keamanannya dari Rules di langkah 4.

## B. Vercel (link online)

1. Buka https://vercel.com → **Sign up / Log in with GitHub** (pakai akun yang bisa melihat repo `awaljati/roket-geprek`).
2. **Add New → Project** → pilih repo `roket-geprek` → **Import**. Kalau repo tidak muncul, klik **Adjust GitHub App Permissions** dan beri akses ke repo ini.
3. Framework Preset terdeteksi **Vite**. Build Command `npm run build`, Output Directory `dist` (biarkan default).
4. Buka **Environment Variables**, masukkan 5 variabel yang sama dengan `.env` (nama dan nilainya).
5. **Deploy**. Setelah selesai, dapat link seperti `roket-geprek.vercel.app`.
6. Setiap merge ke `main` otomatis deploy ulang. Pull Request dapat link preview sendiri, enak untuk dites sebelum merge.

## Kalau gagal

| Gejala | Penyebab biasa |
|---|---|
| Lobby masih "lokal" | `.env` belum diisi, atau `npm run dev` belum diulang setelah mengisi |
| Error `permission_denied` | Anonymous sign-in belum diaktifkan, atau Rules belum di-Publish |
| HP tidak bisa membuka alamat | HP dan laptop beda Wi-Fi; pakai link Vercel saja |
| Vercel jalan tapi room tidak | Environment Variables belum diisi di Vercel, lalu **Redeploy** |
