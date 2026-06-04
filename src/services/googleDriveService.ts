import { Novel, Chapter, WorldEntity, Relationship } from '../types';

// ==========================================
// SERVICIO DE INTEGRACIÓN CON GOOGLE DRIVE (API v3)
// ==========================================
export const googleDriveService = {

  // --- ACCESO Y GESTIÓN DE CREDENCIALES (TOKEN) ---

  /**
   * Recupera el token de acceso OAuth2 activo desde el almacenamiento local
   */
  getAccessToken: async () => {
    return localStorage.getItem('google_drive_token');
  },

  /**
   * Guarda de forma local el nuevo token de acceso OAuth2 obtenido por popup
   */
  setAccessToken: (token: string) => {
    localStorage.setItem('google_drive_token', token);
  },

  // --- FLUJOS DE TRABAJO PRINCIPALES (CORE SYNC) ---

  /**
   * Sincroniza la novela estructurada en la nube de Google Drive del usuario.
   * Crea una carpeta para la novela, guarda un archivo metadata.json con la enciclopedia
   * y crea una subcarpeta de capítulos individuales en formato .txt.
   */
  syncToDrive: async (novel: Novel, chapters: Chapter[], entities: WorldEntity[], relationships: Relationship[]) => {
    const token = localStorage.getItem('google_drive_token');
    if (!token) throw new Error('No token found');

    try {
      // 1. Obtener o crear la carpeta raíz global llamada "Novel"
      const rootFolderId = await googleDriveService.getOrCreateFolder(token, 'Novel');
      
      // 2. Obtener o crear la carpeta específica para esta novela en particular
      const novelFolderName = novel.title;
      const novelFolderId = await googleDriveService.getOrCreateFolder(token, novelFolderName, rootFolderId);

      // 3. Sincronizar el archivo maestro 'metadata.json' con la enciclopedia del mundo
      const metaFileName = 'metadata.json';
      const metaId = await googleDriveService.findFileInFolder(token, novelFolderId, metaFileName);
      const metaData = {
        novel,
        entities,
        relationships,
        syncedAt: new Date().toISOString()
      };
      
      if (metaId) {
        await googleDriveService.updateFile(token, metaId, metaData);
      } else {
        await googleDriveService.createFile(token, novelFolderId, metaFileName, metaData);
      }

      // 4. Crear la subcarpeta interna llamada "Chapters" para los manuscritos
      const chaptersFolderId = await googleDriveService.getOrCreateFolder(token, 'Chapters', novelFolderId);

      // 5. Sincronizar cada capítulo individualmente como archivos de texto plano (.txt)
      for (const chapter of chapters) {
        const chapterFileName = `Cap_${String(chapter.chapterNumber).padStart(2, '0')}_${chapter.title}.txt`;
        const chapterId = await googleDriveService.findFileInFolder(token, chaptersFolderId, chapterFileName);
        
        if (chapterId) {
          await googleDriveService.updateFile(token, chapterId, { content: chapter.content });
        } else {
          await googleDriveService.createFile(token, chaptersFolderId, chapterFileName, { content: chapter.content });
        }
      }

      return true;
    } catch (error) {
      console.error('Error syncing to Drive structured:', error);
      throw error;
    }
  },

  /**
   * Elimina la carpeta completa de la novela en Google Drive.
   * [CORREGIDO] Busca el folder estructurado de la novela y lo elimina, previniendo folders huérfanos.
   */
  deleteFromDrive: async (novelTitle: string) => {
    const token = localStorage.getItem('google_drive_token');
    if (!token) return;

    try {
      // Obtener la carpeta raíz "Novel"
      const rootFolderId = await googleDriveService.getOrCreateFolder(token, 'Novel');
      
      // Buscar la subcarpeta específica de la novela dentro de la carpeta raíz
      const query = encodeURIComponent(`name = '${novelTitle}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const folderId = data.files && data.files.length > 0 ? data.files[0].id : null;

      // Si existe, enviar petición DELETE a la API de Drive
      if (folderId) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error deleting folder from Drive:', error);
    }
  },

  // --- MÉTODOS DE APOYO / UTILIDADES DE API (DRIVE API WRAPPERS) ---

  /**
   * Busca una carpeta específica por nombre. Si no la encuentra, la crea automáticamente.
   */
  getOrCreateFolder: async (token: string, folderName: string, parentId?: string): Promise<string> => {
    let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : []
      })
    });
    const createData = await createRes.json();
    return createData.id;
  },

  /**
   * Realiza una búsqueda para ubicar el ID de un archivo específico basándose en su nombre y carpeta contenedora.
   */
  findFileInFolder: async (token: string, folderId: string, fileName: string): Promise<string | null> => {
    const query = encodeURIComponent(`name = '${fileName}' and '${folderId}' in parents and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  },

  /**
   * Crea un archivo cargándolo con metadatos y cuerpo en un único request Multipart en formato JSON.
   */
  createFile: async (token: string, folderId: string, fileName: string, content: any) => {
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
  },

  /**
   * Actualiza el contenido (Payload) de un archivo existente mediante un request PATCH rápido.
   */
  updateFile: async (token: string, fileId: string, content: any) => {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(content, null, 2)
    });
  }
};