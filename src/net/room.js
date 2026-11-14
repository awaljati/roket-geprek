// Room dengan kode: Navigator = host (menjalankan fisika), Spesialis = mengirim perintah.
// Kalau .env Firebase kosong -> mode lokal (BroadcastChannel): buka 2 tab di browser yang sama untuk tes.
//
// Pemakaian:
//   const room = await openRoom(code, { onCmd, onState });
//   room.sendCmd('release');        // dari Spesialis
//   room.sendState(snapshot);       // dari Navigator, ~10x per detik
//   room.saveResult(team, level, result);  // untuk battle

export function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const env = import.meta.env || {};
export const hasFirebase = Boolean(env.VITE_FIREBASE_DATABASE_URL);

export async function openRoom(code, handlers) {
  return hasFirebase ? openFirebaseRoom(code, handlers) : openLocalRoom(code, handlers);
}

function openLocalRoom(code, { onCmd, onState }) {
  const ch = new BroadcastChannel('roket-geprek-' + code);
  ch.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'cmd' && onCmd) onCmd(m.cmd);
    if (m.type === 'state' && onState) onState(m.state);
  };
  return {
    mode: 'lokal',
    sendCmd: (cmd) => ch.postMessage({ type: 'cmd', cmd }),
    sendState: (state) => ch.postMessage({ type: 'state', state }),
    saveResult: (team, level, result) => {
      try {
        localStorage.setItem(`room-${code}-${team}-level${level}`, JSON.stringify(result));
      } catch (_) {}
    },
    close: () => ch.close(),
  };
}

async function openFirebaseRoom(code, { onCmd, onState }) {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth, signInAnonymously } = await import('firebase/auth');
  const { getDatabase, ref, push, set, onChildAdded, onValue, off } = await import('firebase/database');

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
  const db = getDatabase(app);
  const cmdsRef = ref(db, `room/${code}/cmds`);
  const stateRef = ref(db, `room/${code}/state`);
  const startedAt = Date.now();

  if (onCmd)
    onChildAdded(cmdsRef, (snap) => {
      const m = snap.val();
      if (m && m.at >= startedAt) onCmd(m.cmd); // abaikan perintah lama
    });
  if (onState) onValue(stateRef, (snap) => snap.val() && onState(snap.val()));

  return {
    mode: 'online',
    sendCmd: (cmd) => push(cmdsRef, { cmd, at: Date.now() }),
    sendState: (state) => set(stateRef, state),
    saveResult: (team, level, result) => set(ref(db, `room/${code}/teams/${team}/level${level}`), result),
    close: () => {
      off(cmdsRef);
      off(stateRef);
    },
  };
}
