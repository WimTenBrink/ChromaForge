import { Job, SourceImage } from "../types";
import { log } from "./logger";

const DB_NAME = 'ChromaForgeDB';
const DB_VERSION = 2;
const STORES = {
    JOBS: 'jobs',
    SOURCES: 'sources'
};

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            const error = request.error;
            log('ERROR', 'IndexedDB Open Failed', { error });
            reject(error);
        };

        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (e) => {
            log('INFO', 'Upgrading IndexedDB', { oldVersion: e.oldVersion, newVersion: e.newVersion });
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORES.JOBS)) {
                db.createObjectStore(STORES.JOBS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.SOURCES)) {
                db.createObjectStore(STORES.SOURCES, { keyPath: 'id' });
            }
        };
    });
};

export const saveState = async (jobs: Job[], sources: Map<string, SourceImage>) => {
    try {
        const db = await initDB();
        const tx = db.transaction([STORES.JOBS, STORES.SOURCES], 'readwrite');
        
        const jobsStore = tx.objectStore(STORES.JOBS);
        const sourcesStore = tx.objectStore(STORES.SOURCES);

        // We use a simpler strategy: Clear then Put to ensure sync. 
        // This avoids complex diffing logic for this use case.
        
        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const req = jobsStore.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            }),
            new Promise<void>((resolve, reject) => {
                const req = sourcesStore.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            })
        ]);

        let jobCount = 0;
        jobs.forEach(job => {
            jobsStore.put(job);
            jobCount++;
        });

        let sourceCount = 0;
        sources.forEach(source => {
            // Strip non-persistable/redundant data (File object, blob URL)
            // We keep base64Data to reconstruct the blob/preview on load
            const { file, previewUrl, ...persistable } = source;
            sourcesStore.put(persistable);
            sourceCount++;
        });
        
        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => {
                // Optional: log('INFO', 'DB Save Complete', { jobs: jobCount, sources: sourceCount });
                resolve();
            };
            tx.onerror = () => {
                log('ERROR', 'DB Transaction Failed', { error: tx.error });
                reject(tx.error);
            };
        });

    } catch (e) {
        log('ERROR', 'Failed to save state to DB', { error: e });
    }
};

export const loadState = async (): Promise<{ jobs: Job[], sources: Map<string, SourceImage> }> => {
     try {
        const db = await initDB();
        const tx = db.transaction([STORES.JOBS, STORES.SOURCES], 'readonly');
        
        const jobsReq = tx.objectStore(STORES.JOBS).getAll();
        const sourcesReq = tx.objectStore(STORES.SOURCES).getAll();
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                const jobs = (jobsReq.result || []) as Job[];
                const sourcesArr = (sourcesReq.result || []) as any[];
                
                const sourceMap = new Map<string, SourceImage>();
                sourcesArr.forEach(s => {
                    // Reconstruct preview URL from base64 data
                    let previewUrl = '';
                    if (s.base64Data && s.type) {
                        try {
                            const byteCharacters = atob(s.base64Data);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: s.type });
                            previewUrl = URL.createObjectURL(blob);
                        } catch (e) {
                            log('WARN', 'Failed to reconstruct blob for source', { id: s.id, error: e });
                        }
                    }

                    sourceMap.set(s.id, {
                        ...s,
                        file: null, // File object is lost on persist, but base64 remains
                        previewUrl
                    } as SourceImage);
                });

                resolve({ jobs, sources: sourceMap });
            };
            tx.onerror = () => {
                log('ERROR', 'DB Load Transaction Failed', { error: tx.error });
                reject(tx.error);
            };
        });

    } catch (e) {
        log('ERROR', 'Failed to load state from DB', { error: e });
        return { jobs: [], sources: new Map() };
    }
};