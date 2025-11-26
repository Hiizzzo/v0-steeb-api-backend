import admin, { db } from './firebase.js';

const LOG_PREFIX = '[GlobalStats]';
const statsDocRef = db.collection('global_stats').doc('general_stats');

const statsState = {
  total: 0,
  white: 0,
  dark: 0,
  shiny: 0
};

const userTypeCache = new Map();
let listenerStarted = false;
let listenerBootstrapped = false;
let unsubscribeListener = null;
let pendingWriteTimer = null;

const normalizeTipoUsuario = (tipoUsuario) => {
  if (!tipoUsuario) return 'white';
  const value = String(tipoUsuario).toLowerCase();
  if (value === 'black') return 'dark';
  if (value === 'dark' || value === 'shiny') return value;
  return 'white';
};

const logCurrentStats = (context) => {
  console.log(
    `${LOG_PREFIX} ${context}: total=${statsState.total} | white=${statsState.white} | dark=${statsState.dark} | shiny=${statsState.shiny}`
  );
};

const persistStats = async (reason) => {
  await statsDocRef.set(
    {
      '0_lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
      '1_totalUsers': statsState.total,
      '2_whiteUsers': statsState.white,
      '3_darkUsers': statsState.dark,
      '4_shinyUsers': statsState.shiny
    },
    { merge: true }
  );
  logCurrentStats(`persisted (${reason})`);
};

const schedulePersist = (reason) => {
  if (pendingWriteTimer) return;
  pendingWriteTimer = setTimeout(() => {
    pendingWriteTimer = null;
    persistStats(reason).catch((error) => {
      console.error(`${LOG_PREFIX} failed to persist stats`, error);
    });
  }, 500);
};

const resetStateFromSnapshot = (snapshot) => {
  statsState.total = 0;
  statsState.white = 0;
  statsState.dark = 0;
  statsState.shiny = 0;
  userTypeCache.clear();

  snapshot.forEach((doc) => {
    const tipo = normalizeTipoUsuario(doc.data()?.tipoUsuario);
    userTypeCache.set(doc.id, tipo);
    statsState.total += 1;
    statsState[tipo] += 1;
  });

  logCurrentStats('bootstrap completed');
  return persistStats('bootstrap');
};

const decrementCounter = (tipo) => {
  if (!statsState[tipo]) return;
  statsState[tipo] = Math.max(0, statsState[tipo] - 1);
};

const applyChange = (change) => {
  const userId = change.doc.id;

  if (change.type === 'removed') {
    const previousTipo = userTypeCache.get(userId);
    if (!previousTipo) return false;

    userTypeCache.delete(userId);
    statsState.total = Math.max(0, statsState.total - 1);
    decrementCounter(previousTipo);
    return true;
  }

  const nextTipo = normalizeTipoUsuario(change.doc.data()?.tipoUsuario);
  const previousTipo = userTypeCache.get(userId);

  if (!previousTipo) {
    // Nuevo usuario (o uno que no estaba cacheado)
    userTypeCache.set(userId, nextTipo);
    statsState.total += 1;
    statsState[nextTipo] += 1;
    return true;
  }

  if (previousTipo !== nextTipo) {
    decrementCounter(previousTipo);
    statsState[nextTipo] += 1;
    userTypeCache.set(userId, nextTipo);
    return true;
  }

  return false;
};

export const startGlobalStatsWatcher = async () => {
  if (listenerStarted) return;
  if (process.env.DISABLE_GLOBAL_STATS_WATCHER === 'true') {
    console.log(`${LOG_PREFIX} disabled via env flag`);
    return;
  }

  listenerStarted = true;
  listenerBootstrapped = false;

  const restartListener = () => {
    if (unsubscribeListener) {
      try {
        unsubscribeListener();
      } catch {
        // ignore
      }
      unsubscribeListener = null;
    }
    listenerStarted = false;
    listenerBootstrapped = false;
    console.log(`${LOG_PREFIX} listener will restart in 5s`);
    setTimeout(() => {
      startGlobalStatsWatcher().catch((error) => {
        console.error(`${LOG_PREFIX} failed to restart listener`, error);
      });
    }, 5000);
  };

  unsubscribeListener = db.collection('users').onSnapshot(
    (snapshot) => {
      if (!listenerBootstrapped) {
        listenerBootstrapped = true;
        resetStateFromSnapshot(snapshot).catch((error) => {
          console.error(`${LOG_PREFIX} failed to bootstrap stats`, error);
          restartListener();
        });
        return;
      }

      let changed = false;
      snapshot.docChanges().forEach((change) => {
        if (applyChange(change)) changed = true;
      });

      if (changed) {
        schedulePersist('change');
      }
    },
    (error) => {
      console.error(`${LOG_PREFIX} listener error`, error);
      restartListener();
    }
  );

  console.log(`${LOG_PREFIX} listener initialized`);
};

export const forceGlobalStatsRecalculation = async () => {
  const snapshot = await db.collection('users').get();
  await resetStateFromSnapshot(snapshot);
};
