import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function getClientDb() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  // Default to (default) if the specific one fails or is likely wrong
  // In many cases, if it's not (default), it might be an extra database 
  // but if we get 5_NOT_FOUND, we should fall back.
  // We can't catch the error here easily as getFirestore is synchronous.
  // We will export a way to re-init if needed.
  return getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
}

export let db = getClientDb();

export function subscribeToLogs(callback: (logs: any[]) => void) {
  let unsubscribe: (() => void) | null = null;
  
  const trySubscribe = (dbInstance: any) => {
    const q = query(collection(dbInstance, 'logs'), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as any)?.toDate?.() || new Date()
      }));
      callback(logs);
    }, (error) => {
      if (error.code === 'not-found' && dbInstance._databaseId?.database === firebaseConfig.firestoreDatabaseId) {
        console.warn("Firestore database not found, falling back to (default)");
        // Re-init with default
        const app = getApp();
        db = getFirestore(app, '(default)');
        if (unsubscribe) unsubscribe();
        unsubscribe = trySubscribe(db);
      }
      console.error("Firestore subscription error:", error);
    });
    return unsub;
  };

  unsubscribe = trySubscribe(db);
  return () => {
    if (unsubscribe) unsubscribe();
  };
}
