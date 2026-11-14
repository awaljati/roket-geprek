// Koneksi Firebase bersama untuk room dan battle. Hanya dimuat kalau .env berisi konfigurasi Firebase.
const env = import.meta.env || {};
export const hasFirebase = Boolean(env.VITE_FIREBASE_DATABASE_URL);

let ready = null;
export function getFirebase() {
  if (!ready)
    ready = (async () => {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, signInAnonymously } = await import('firebase/auth');
      const db = await import('firebase/database');
      const app =
        getApps()[0] ||
        initializeApp({
          apiKey: env.VITE_FIREBASE_API_KEY,
          authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
          databaseURL: env.VITE_FIREBASE_DATABASE_URL,
          projectId: env.VITE_FIREBASE_PROJECT_ID,
          appId: env.VITE_FIREBASE_APP_ID,
        });
      await signInAnonymously(getAuth(app));
      return { db: db.getDatabase(app), fb: db };
    })();
  return ready;
}
