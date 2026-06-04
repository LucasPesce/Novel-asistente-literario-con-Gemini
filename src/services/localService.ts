import { Novel, WorldEntity, Chapter, Relationship } from '../types';

// ==========================================
// CONFIGURACIÓN Y CONSTANTES GLOBALES
// ==========================================
const STORAGE_KEY = 'novel_assistant_data';

interface AppData {
  novels: Novel[];
}

// Variables en memoria para controlar el estado local
let directoryHandle: any = null;
const listeners: (() => void)[] = [];

// Configuración de base de datos IndexedDB para persistir los accesos a carpetas físicas
const DB_NAME = 'NovelAppDB';
const STORE_NAME = 'handles';

// ==========================================
// SERVICIOS AUXILIARES (INDEXED DB WRAPPERS)
// ==========================================

/**
 * Notifica a todas las pantallas suscritas que los datos locales han cambiado
 */
const notifyListeners = () => {
  listeners.forEach(l => l());
};

/**
 * Guarda el token de acceso a la carpeta física (DirectoryHandle) en IndexedDB
 * para evitar que el navegador olvide la ruta seleccionada por el usuario.
 */
const saveHandleToDB = async (handle: any) => {
  const db: any = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, 'dirHandle');
  return new Promise((resolve) => tx.oncomplete = resolve);
};

/**
 * Recupera el token de acceso de la carpeta física desde IndexedDB
 */
const getHandleFromDB = async () => {
  const db: any = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('dirHandle');
    req.onsuccess = () => resolve(req.result);
  });
};

// ==========================================
// SERVICIO PRINCIPAL DE GESTIÓN LOCAL (LOCAL SERVICE)
// ==========================================
export const localService = {

  // --- PATRÓN OBSERVADOR (PUB/SUB) ---

  /**
   * Suscribe una pantalla a los cambios de la base de datos local para refrescar su interfaz
   */
  addListener: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  },

  // --- GESTIÓN DE CARPETAS FÍSICAS (FILE SYSTEM ACCESS) ---

  /**
   * Solicita al usuario que elija una carpeta en su ordenador ( showDirectoryPicker )
   * y guarda su token de acceso persistente en la IndexedDB.
   */
  requestDirectoryHandle: async () => {
    // Verificación de compatibilidad (FSA API no está soportado en todos los navegadores o iframes)
    // @ts-ignore
    if (typeof window.showDirectoryPicker !== 'function') {
      const isIframe = window.self !== window.top;
      let message = 'Tu navegador no soporta el acceso a carpetas locales. ';
      
      if (isIframe) {
        message += '\n\nESTO SUELE SUCEDER POR ESTAR EN LA VISTA PREVIA. Por favor, haz clic en el botón "Abrir en nueva ventana" (arriba a la derecha) para que la función de carpetas locales funcione correctamente.';
      } else {
        message += '\n\nPor favor, usa un navegador basado en Chrome, Edge o una versión moderna de tu navegador para usar esta función especial.';
      }
      
      alert(message);
      return false;
    }

    try {
      // @ts-ignore
      directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveHandleToDB(directoryHandle);
      
      try {
        await directoryHandle.getDirectoryHandle('Novel', { create: true });
      } catch (e) {
        console.log('Folder Novel already exists or could not be created');
      }
      return true;
    } catch (error) {
      console.error('Error selecting directory:', error);
      return false;
    }
  },

  /**
   * Intenta recuperar el DirectoryHandle desde la base de datos local al iniciar la app,
   * y valida si el navegador aún tiene los permisos de lectura/escritura aprobados.
   */
  restoreDirectoryHandle: async () => {
    try {
      const handle: any = await getHandleFromDB();
      if (handle) {
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          directoryHandle = handle;
          return true;
        } else {
          directoryHandle = handle;
          return false; // Requiere una interacción del usuario (click) para re-solicitar permisos
        }
      }
      return false;
    } catch (e) {
      console.error('Failed to restore directory handle', e);
      return false;
    }
  },

  /**
   * Solicita explícitamente al navegador permisos de lectura/escritura sobre el directorio
   */
  verifyPermission: async () => {
    if (!directoryHandle) return false;
    const permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
    return permission === 'granted';
  },

  // --- GESTIÓN Y PERSISTENCIA DE DATOS (I/O ACTIONS) ---

  /**
   * Guarda de forma instantánea el estado en la caché rápida (localStorage)
   * y trata de escribir los directorios base de las novelas en la carpeta física vinculada.
   */
  saveData: async (data: AppData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    notifyListeners();

    if (directoryHandle) {
      try {
        const rootFolder = await directoryHandle.getDirectoryHandle('Novel', { create: true });
        
        for (const novel of data.novels) {
          const novelSafeTitle = novel.title.replace(/[<>:"/\\|?*]/g, '_');
          const novelFolder = await rootFolder.getDirectoryHandle(novelSafeTitle, { create: true });
          
          const metaFile = await novelFolder.getFileHandle('metadata.json', { create: true });
          const metaWritable = await metaFile.createWritable();
          await metaWritable.write(JSON.stringify({
            id: novel.id,
            title: novel.title,
            createdAt: novel.createdAt,
            updatedAt: novel.updatedAt,
          }, null, 2));
          await metaWritable.close();

          await novelFolder.getDirectoryHandle('Chapters', { create: true });
        }
      } catch (error) {
        console.error('Error saving to local directory structured:', error);
      }
    }
  },

  /**
   * Guarda de manera profunda y estructurada una novela completa en el disco local de la PC.
   * Escribe el archivo metadata.json con la enciclopedia total y exporta
   * cada capítulo del manuscrito como archivos de texto plano (.txt) individuales.
   */
  syncNovelToLocal: async (novel: Novel, chapters: Chapter[], entities: WorldEntity[], relationships: Relationship[]) => {
    if (!directoryHandle) return;
    try {
      const rootFolder = await directoryHandle.getDirectoryHandle('Novel', { create: true });
      const novelSafeTitle = novel.title.replace(/[<>:"/\\|?*]/g, '_');
      const novelFolder = await rootFolder.getDirectoryHandle(novelSafeTitle, { create: true });

      // 1. Guardar metadatos generales y fichas del mundo
      const metaFile = await novelFolder.getFileHandle('metadata.json', { create: true });
      const metaWritable = await metaFile.createWritable();
      await metaWritable.write(JSON.stringify({
        ...novel,
        entities,
        relationships,
        lastSync: new Date().toISOString()
      }, null, 2));
      await metaWritable.close();

      // 2. Guardar cada capítulo como un archivo .txt independiente
      const chaptersFolder = await novelFolder.getDirectoryHandle('Chapters', { create: true });
      for (const chapter of chapters) {
        const chapterFileName = `Cap_${String(chapter.chapterNumber).padStart(2, '0')}_${chapter.title.replace(/[<>:"/\\|?*]/g, '_')}.txt`;
        const chapterFile = await chaptersFolder.getFileHandle(chapterFileName, { create: true });
        const chapterWritable = await chapterFile.createWritable();
        await chapterWritable.write(chapter.content);
        await chapterWritable.close();
      }
      
      console.log('Sync complete for ' + novel.title);
    } catch (error) {
      console.error('Error syncing individual novel to local:', error);
    }
  },

  /**
   * Devuelve los datos cacheados desde el almacenamiento local
   */
  getData: (): AppData => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { novels: [] };
  }
};