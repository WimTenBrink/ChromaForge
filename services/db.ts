import { InputImage } from "../types";

const DB_NAME = 'ChromaForgeDB';
const STORE_NAME = 'images';
const VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error("IndexedDB not supported"));
        return;
    }
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveQueueToDB = async (queue: InputImage[]) => {
  try {
      const db = await initDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // We clear and rewrite for simplicity as the queue isn't massive (usually < 50 items)
        const clearReq = store.clear();
        
        clearReq.onsuccess = () => {
             queue.forEach(item => store.put(item));
        };
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
  } catch (e) {
      console.error("DB Save Error", e);
  }
};

export const loadQueueFromDB = async (): Promise<InputImage[]> => {
  try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
  } catch (e) {
      console.error("DB Load Error", e);
      return [];
  }
};