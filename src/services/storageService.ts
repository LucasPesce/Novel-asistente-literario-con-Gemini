import { db, auth, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  writeBatch,
  increment,
} from "firebase/firestore";
import { Novel, Chapter, WorldEntity, Relationship } from "../types";
import { localService } from "./localService";

// =========================================================================
// CAPA DE ACCESO A DATOS UNIFICADA (DATA ACCESS LAYER - DAL)
// =========================================================================
export const storageService = {
  // ==========================================
  // 1. LECTURA EN TIEMPO REAL (QUERIES & SUBS)
  // ==========================================

  /**
   * Suscribe a la aplicación a la lista de novelas pertenecientes al autor activo.
   * Resuelve la petición consultando la caché reactiva local o abriendo un flujo onSnapshot en Firestore.
   */
  getNovels: (isLocal: boolean, callback: (novels: Novel[]) => void) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const fetch = () => {
        const data = localService.getData();
        callback(data.novels);
      };
      fetch();
      return localService.addListener(fetch);
    }

    // --- Flujo Modo Conectado (Nube) ---
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, "novels"),
      where("authorId", "==", auth.currentUser.uid),
    );
    return onSnapshot(
      q,
      (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Novel));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "novels");
      },
    );
  },

  /**
   * Abre canales de comunicación en tiempo real para recuperar toda la información
   * asociada a una novela específica (Metadatos, Manuscritos, Fichas de Enciclopedia y Vínculos).
   */
  getNovelData: (
    isLocal: boolean,
    novelId: string,
    onNovel: (n: Novel) => void,
    onChapters: (c: Chapter[]) => void,
    onEntities: (e: WorldEntity[]) => void,
    onRelationships: (r: Relationship[]) => void,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const fetch = () => {
        const data = localService.getData();
        const novel = data.novels.find((n) => n.id === novelId);
        if (novel) {
          onNovel(novel);
          // Aseguramos que en Modo Local los capítulos SIEMPRE se ordenen matemáticamente
          onChapters(
            [...(novel.chapters || [])].sort(
              (a, b) => a.chapterNumber - b.chapterNumber,
            ),
          );
          onEntities(novel.entities || []);
          onRelationships(novel.relationships || []);
        }
      };
      fetch();
      return localService.addListener(fetch);
    }

    // --- Flujo Modo Conectado (Nube) - Multi-suscripción Reactiva ---
    const unsubNovel = onSnapshot(
      doc(db, "novels", novelId),
      (snap) => {
        if (snap.exists()) {
          onNovel({ id: snap.id, ...snap.data() } as Novel);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `novels/${novelId}`);
      },
    );
    const unsubChapters = onSnapshot(
      collection(db, "novels", novelId, "chapters"),
      (snap) => {
        onChapters(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Chapter)
            .sort((a, b) => a.chapterNumber - b.chapterNumber),
        );
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `novels/${novelId}/chapters`,
        );
      },
    );
    const unsubEntities = onSnapshot(
      collection(db, "novels", novelId, "entities"),
      (snap) => {
        onEntities(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorldEntity),
        );
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `novels/${novelId}/entities`,
        );
      },
    );
    const unsubRelations = onSnapshot(
      collection(db, "novels", novelId, "relationships"),
      (snap) => {
        onRelationships(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Relationship),
        );
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `novels/${novelId}/relationships`,
        );
      },
    );

    return () => {
      unsubNovel();
      unsubChapters();
      unsubEntities();
      unsubRelations();
    };
  },

  // ==========================================
  // 2. OPERACIONES DE CAPÍTULOS (MANUSCRITOS)
  // ==========================================

  /**
   * Inserta un nuevo capítulo al manuscrito e incrementa el contador general de la novela.
   */
  addChapter: async (
    isLocal: boolean,
    novelId: string,
    chapter: Partial<Chapter>,
    chapterNumber: number,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novelIndex = data.novels.findIndex((n) => n.id === novelId);
      if (novelIndex > -1) {
        const newChapter: Chapter = {
          id: crypto.randomUUID(),
          novelId,
          title: chapter.title!,
          content: chapter.content!,
          chapterNumber: chapterNumber, // Usa el número exacto recibido
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const novel = data.novels[novelIndex];
        novel.chapters = [...(novel.chapters || []), newChapter].sort(
          (a, b) => a.chapterNumber - b.chapterNumber,
        );
        novel.chapterCount = (novel.chapterCount || 0) + 1;
        localService.saveData(data);
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await addDoc(collection(db, "novels", novelId, "chapters"), {
        ...chapter,
        novelId,
        chapterNumber: chapterNumber, // Usa el número exacto recibido
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, "novels", novelId), {
        chapterCount: increment(1), // Incremento seguro
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `novels/${novelId}/chapters`,
      );
    }
  },

  /**
   * Actualiza el título o manuscrito de un capítulo específico.
   */
  updateChapter: async (
    isLocal: boolean,
    novelId: string,
    chapterId: string,
    updates: Partial<Chapter>,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel && novel.chapters) {
        const index = novel.chapters.findIndex((c) => c.id === chapterId);
        if (index > -1) {
          novel.chapters[index] = {
            ...novel.chapters[index],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          localService.saveData(data);
        }
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await updateDoc(doc(db, "novels", novelId, "chapters", chapterId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `novels/${novelId}/chapters/${chapterId}`,
      );
    }
  },

/**
   * Envía un capítulo a la papelera (Soft Delete) marcándolo con la fecha actual.
   * Reduce el contador de capítulos activos de la novela.
   */
  trashChapter: async (isLocal: boolean, novelId: string, chapterId: string) => {
    const deletedAt = new Date().toISOString();
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find(n => n.id === novelId);
      if (novel && novel.chapters) {
        const index = novel.chapters.findIndex(c => c.id === chapterId);
        if (index > -1) {
          novel.chapters[index].deletedAt = deletedAt;
          novel.chapterCount = Math.max(0, (novel.chapterCount || 1) - 1);
          localService.saveData(data);
        }
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'novels', novelId, 'chapters', chapterId), {
        deletedAt: deletedAt,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'novels', novelId), {
        chapterCount: increment(-1),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `novels/${novelId}/chapters/${chapterId}/trash`);
    }
  },

/**
   * Elimina de forma física e irreversible un capítulo desde la papelera.
   */
  deleteChapterPermanently: async (isLocal: boolean, novelId: string, chapterId: string) => {
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find(n => n.id === novelId);
      if (novel && novel.chapters) {
        novel.chapters = novel.chapters.filter(c => c.id !== chapterId);
        localService.saveData(data);
      }
      return;
    }

    try {
      await deleteDoc(doc(db, 'novels', novelId, 'chapters', chapterId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${novelId}/chapters/${chapterId}/hardDelete`);
    }
  },

  /**
   * Restaura un capítulo de la papelera, removiendo su marca de borrado 
   * y asignándole el nuevo número secuencial correspondiente.
   */
  restoreChapter: async (isLocal: boolean, novelId: string, chapterId: string, restoredNumber: number) => {
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find(n => n.id === novelId);
      if (novel && novel.chapters) {
        const index = novel.chapters.findIndex(c => c.id === chapterId);
        if (index > -1) {
          delete novel.chapters[index].deletedAt;
          novel.chapters[index].chapterNumber = restoredNumber;
          novel.chapterCount = (novel.chapterCount || 0) + 1;
          // Re-ordenar físicamente tras restaurar
          novel.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
          localService.saveData(data);
        }
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'novels', novelId, 'chapters', chapterId), {
        deletedAt: null,
        chapterNumber: restoredNumber,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'novels', novelId), {
        chapterCount: increment(1),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `novels/${novelId}/chapters/${chapterId}/restore`);
    }
  },

  /**
   * Elimina de golpe todos los capítulos actualmente alojados en la papelera.
   */
  emptyTrash: async (isLocal: boolean, novelId: string, trashedChapters: Chapter[]) => {
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find(n => n.id === novelId);
      if (novel && novel.chapters) {
        const trashedIds = new Set(trashedChapters.map(t => t.id));
        novel.chapters = novel.chapters.filter(c => !trashedIds.has(c.id));
        localService.saveData(data);
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      trashedChapters.forEach(c => {
        batch.delete(doc(db, 'novels', novelId, 'chapters', c.id));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${novelId}/chapters/emptyTrash`);
    }
  },

  /**
   * Escanea la papelera y destruye permanentemente aquellos capítulos
   * cuyo borrado lógico (`deletedAt`) supere los 30 días de antigüedad.
   */
  pruneExpiredTrash: async (isLocal: boolean, novelId: string, trashedChapters: Chapter[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const expired = trashedChapters.filter(c => c.deletedAt && new Date(c.deletedAt) < thirtyDaysAgo);
    if (expired.length === 0) return;

    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find(n => n.id === novelId);
      if (novel && novel.chapters) {
        const expiredIds = new Set(expired.map(e => e.id));
        novel.chapters = novel.chapters.filter(c => !expiredIds.has(c.id));
        localService.saveData(data);
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      expired.forEach(c => {
        batch.delete(doc(db, 'novels', novelId, 'chapters', c.id));
      });
      await batch.commit();
    } catch (error) {
      console.error('Error pruning expired trash:', error);
    }
  },

  /**
   * Reordena masivamente los capítulos y actualiza sus índices internos.
   */
  reorderChapters: async (
    isLocal: boolean,
    novelId: string,
    orderedChapters: Chapter[],
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel) {
        novel.chapters = orderedChapters;
        localService.saveData(data);
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      const batch = writeBatch(db);
      orderedChapters.forEach((chap) => {
        batch.update(doc(db, "novels", novelId, "chapters", chap.id), {
          chapterNumber: chap.chapterNumber,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `novels/${novelId}/chapters/reorder`,
      );
    }
  },

  // ==========================================
  // 3. SINCRONIZACIÓN DEL ANÁLISIS IA (MERGES)
  // ==========================================

  /**
   * Toma el resultado de extracción estructural devuelto por la IA de Gemini,
   * remueve anotaciones sintácticas incorrectas de nombres y procede a hacer un MERGE
   * con las entidades y relaciones existentes:
   * - Si la entidad no existe: La crea.
   * - Si ya existe: Une y actualiza su descripción, une preguntas abiertas nuevas,
   *   y si la IA detectó que alguna pregunta abierta se resolvió, la traslada a resueltas.
   * - Si hay nuevas relaciones: Valida duplicidades. Si el usuario definió una relación manual
   *   pero la IA encontró una distinta, crea una segunda relación con flag "isPending" para confirmación.
   */
  saveEntitiesAndRelationships: async (
    isLocal: boolean,
    novelId: string,
    extractedEntities: any[],
    extractedRels: any[],
    chapterId: string,
    chapterTitle: string,
    existingEntities: WorldEntity[],
    existingRels: Relationship[],
  ) => {
    // Sanitizador para evitar que Gemini agregue textos explicativos en el nombre, ej: "Juan (Personaje)" -> "Juan"
    const sanitizeName = (name: string) =>
      name.replace(/\s*\(.*?\)\s*/g, "").trim();

    const cleanExtractedEntities = extractedEntities.map((e) => ({
      ...e,
      name: sanitizeName(e.name),
    }));
    const cleanExtractedRels = extractedRels.map((r) => ({
      ...r,
      source: sanitizeName(r.source),
      target: sanitizeName(r.target),
    }));

    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (!novel) return;

      novel.entities = novel.entities || [];
      novel.relationships = novel.relationships || [];

      for (const extracted of cleanExtractedEntities) {
        const existing = novel.entities.find(
          (e) => e.name.toLowerCase() === extracted.name.toLowerCase(),
        );
        if (existing) {
          // Merge open questions: append new ones if they don't already exist
          let currentQuestions = existing.openQuestions
            ? existing.openQuestions.split("\n").filter((q: string) => q.trim())
            : [];
          const newQuestions = extracted.openQuestions
            ? (extracted.openQuestions as string)
                .split("\n")
                .filter((q: string) => q.trim())
            : [];
          const resolvedNow = extracted.resolvedQuestions
            ? (extracted.resolvedQuestions as string)
                .split("\n")
                .filter((q: string) => q.trim())
            : [];

          // Remove resolved questions from open questions
          if (resolvedNow.length > 0) {
            currentQuestions = currentQuestions.filter(
              (cq: string) =>
                !resolvedNow.some(
                  (rq: string) =>
                    cq.toLowerCase().includes(rq.toLowerCase()) ||
                    rq.toLowerCase().includes(cq.toLowerCase()),
                ),
            );

            // Add to resolved questions list
            let alreadyResolved = existing.resolvedQuestions
              ? existing.resolvedQuestions
                  .split("\n")
                  .filter((q: string) => q.trim())
              : [];
            for (const rq of resolvedNow) {
              if (
                !alreadyResolved.some((ar: string) =>
                  ar.toLowerCase().includes(rq.toLowerCase()),
                )
              ) {
                alreadyResolved.push(rq);
              }
            }
            existing.resolvedQuestions = alreadyResolved.join("\n");
          }

          for (const nq of newQuestions) {
            if (
              !currentQuestions.some(
                (cq: string) =>
                  cq.toLowerCase().includes(nq.toLowerCase()) ||
                  nq.toLowerCase().includes(cq.toLowerCase()),
              )
            ) {
              currentQuestions.push(nq);
            }
          }

          Object.assign(existing, {
            summary: extracted.summary,
            status: extracted.status || existing.status,
            type: existing.isTypeLocked
              ? existing.type
              : extracted.type || existing.type,
            openQuestions: currentQuestions.join("\n"),
            lastUpdatedChapterId: chapterId,
            lastUpdatedChapterTitle: chapterTitle,
            updatedAt: new Date().toISOString(),
          });
        } else {
          novel.entities.push({
            id: crypto.randomUUID(),
            novelId,
            name: extracted.name,
            type: extracted.type,
            summary: extracted.summary,
            openQuestions: extracted.openQuestions,
            status:
              extracted.status ||
              (extracted.type === "character" ? "Vivo" : "Paz"),
            firstUpdatedChapterId: chapterId,
            firstUpdatedChapterTitle: chapterTitle,
            lastUpdatedChapterId: chapterId,
            lastUpdatedChapterTitle: chapterTitle,
            updatedAt: new Date().toISOString(),
            tags: [],
            headerColor: extracted.type === "character" ? "#1a1d23" : "#0f172a",
          });
        }
      }

      for (const rel of cleanExtractedRels) {
        const source = novel.entities.find(
          (e) => e.name.toLowerCase() === rel.source.toLowerCase(),
        );
        const target = novel.entities.find(
          (e) => e.name.toLowerCase() === rel.target.toLowerCase(),
        );
        if (source && target) {
          const existing = novel.relationships.find(
            (r) =>
              (r.sourceId === source.id && r.targetId === target.id) ||
              (r.sourceId === target.id && r.targetId === source.id),
          );

          if (existing) {
            if (existing.isUserDefined) {
              if (
                existing.relationType.toLowerCase() !== rel.type.toLowerCase()
              ) {
                novel.relationships.push({
                  id: crypto.randomUUID(),
                  novelId,
                  sourceId: source.id,
                  targetId: target.id,
                  sourceName: source.name,
                  targetName: target.name,
                  relationType: rel.type,
                  description: rel.description,
                  isPending: true,
                  isUserDefined: false,
                  updatedAt: new Date().toISOString(),
                });
              }
            } else {
              Object.assign(existing, {
                relationType: rel.type,
                description: rel.description,
                isPending: true,
                updatedAt: new Date().toISOString(),
              });
            }
          } else {
            novel.relationships.push({
              id: crypto.randomUUID(),
              novelId,
              sourceId: source.id,
              targetId: target.id,
              sourceName: source.name,
              targetName: target.name,
              relationType: rel.type,
              description: rel.description,
              isPending: true,
              isUserDefined: false,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      localService.saveData(data);
      return;
    }

    // --- Flujo Modo Conectado (Nube con WriteBatch para consistencia) ---
    try {
      const batch = writeBatch(db);
      for (const extracted of cleanExtractedEntities) {
        const existing = existingEntities.find(
          (e) => e.name.toLowerCase() === extracted.name.toLowerCase(),
        );
        if (existing) {
          // Merge open questions: append new ones if they don't already exist
          let currentQuestions = existing.openQuestions
            ? existing.openQuestions.split("\n").filter((q: string) => q.trim())
            : [];
          const newQuestions = extracted.openQuestions
            ? (extracted.openQuestions as string)
                .split("\n")
                .filter((q: string) => q.trim())
            : [];
          const resolvedNow = extracted.resolvedQuestions
            ? (extracted.resolvedQuestions as string)
                .split("\n")
                .filter((q: string) => q.trim())
            : [];

          let resolvedQuestions = existing.resolvedQuestions || "";

          // Remove resolved questions from open questions
          if (resolvedNow.length > 0) {
            currentQuestions = currentQuestions.filter(
              (cq: string) =>
                !resolvedNow.some(
                  (rq: string) =>
                    cq.toLowerCase().includes(rq.toLowerCase()) ||
                    rq.toLowerCase().includes(cq.toLowerCase()),
                ),
            );

            // Add to resolved questions list
            let alreadyResolved = existing.resolvedQuestions
              ? existing.resolvedQuestions
                  .split("\n")
                  .filter((q: string) => q.trim())
              : [];
            for (const rq of resolvedNow) {
              if (
                !alreadyResolved.some((ar: string) =>
                  ar.toLowerCase().includes(rq.toLowerCase()),
                )
              ) {
                alreadyResolved.push(rq);
              }
            }
            resolvedQuestions = alreadyResolved.join("\n");
          }

          for (const nq of newQuestions) {
            if (
              !currentQuestions.some(
                (cq: string) =>
                  cq.toLowerCase().includes(nq.toLowerCase()) ||
                  nq.toLowerCase().includes(cq.toLowerCase()),
              )
            ) {
              currentQuestions.push(nq);
            }
          }

          batch.update(doc(db, "novels", novelId, "entities", existing.id), {
            summary: extracted.summary,
            status: extracted.status || existing.status,
            type: existing.isTypeLocked
              ? existing.type
              : extracted.type || existing.type,
            openQuestions: currentQuestions.join("\n"),
            resolvedQuestions: resolvedQuestions,
            lastUpdatedChapterId: chapterId,
            lastUpdatedChapterTitle: chapterTitle,
            updatedAt: new Date().toISOString(),
          });
        } else {
          const newRef = doc(collection(db, "novels", novelId, "entities"));
          batch.set(newRef, {
            novelId,
            name: extracted.name,
            type: extracted.type,
            summary: extracted.summary,
            openQuestions: extracted.openQuestions,
            status:
              extracted.status ||
              (extracted.type === "character" ? "Vivo" : "Paz"),
            firstUpdatedChapterId: chapterId,
            firstUpdatedChapterTitle: chapterTitle,
            lastUpdatedChapterId: chapterId,
            lastUpdatedChapterTitle: chapterTitle,
            updatedAt: new Date().toISOString(),
            tags: [],
            headerColor: extracted.type === "character" ? "#1a1d23" : "#0f172a",
          });
        }
      }
      await batch.commit();

      // Recuperar IDs de Firestore para mapear y tejer los hilos de las nuevas relaciones
      const refreshedEntities = (
        await getDocs(collection(db, "novels", novelId, "entities"))
      ).docs.map((d) => ({ id: d.id, ...d.data() }) as WorldEntity);
      const relBatch = writeBatch(db);
      for (const rel of cleanExtractedRels) {
        const source = refreshedEntities.find(
          (e) => e.name.toLowerCase() === rel.source.toLowerCase(),
        );
        const target = refreshedEntities.find(
          (e) => e.name.toLowerCase() === rel.target.toLowerCase(),
        );
        if (source && target) {
          const existing = existingRels.find(
            (r) =>
              (r.sourceId === source.id && r.targetId === target.id) ||
              (r.sourceId === target.id && r.targetId === source.id),
          );

          if (existing) {
            if (existing.isUserDefined) {
              if (
                existing.relationType.toLowerCase() !== rel.type.toLowerCase()
              ) {
                const newRef = doc(
                  collection(db, "novels", novelId, "relationships"),
                );
                relBatch.set(newRef, {
                  novelId,
                  sourceId: source.id,
                  targetId: target.id,
                  sourceName: source.name,
                  targetName: target.name,
                  relationType: rel.type,
                  description: rel.description,
                  isPending: true,
                  isUserDefined: false,
                  updatedAt: new Date().toISOString(),
                });
              }
            } else {
              relBatch.update(
                doc(db, "novels", novelId, "relationships", existing.id),
                {
                  relationType: rel.type,
                  description: rel.description,
                  isPending: true,
                  updatedAt: new Date().toISOString(),
                },
              );
            }
          } else {
            const newRef = doc(
              collection(db, "novels", novelId, "relationships"),
            );
            relBatch.set(newRef, {
              novelId,
              sourceId: source.id,
              targetId: target.id,
              sourceName: source.name,
              targetName: target.name,
              relationType: rel.type,
              description: rel.description,
              isPending: true,
              isUserDefined: false,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      await relBatch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `novels/${novelId}/analysis`,
      );
    }
  },

  // ==========================================
  // 4. OPERACIONES DE LA ENCICLOPEDIA (CARDS)
  // ==========================================

  /**
   * Actualiza el contenido (resumen, estado, tags) de una ficha de personaje, lugar o lore.
   */
  updateEntity: async (
    isLocal: boolean,
    novelId: string,
    entityId: string,
    updates: Partial<WorldEntity>,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel && novel.entities) {
        const index = novel.entities.findIndex((e) => e.id === entityId);
        if (index > -1) {
          novel.entities[index] = {
            ...novel.entities[index],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          localService.saveData(data);
        }
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await updateDoc(doc(db, "novels", novelId, "entities", entityId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `novels/${novelId}/entities/${entityId}`,
      );
    }
  },

  /**
   * Elimina una ficha de la enciclopedia.
   * [CASCADA] En Firestore elimina todas las relaciones asociadas a esta ficha mediante un WriteBatch.
   */
  deleteEntity: async (isLocal: boolean, novelId: string, entityId: string) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel && novel.entities) {
        novel.entities = novel.entities.filter((e) => e.id !== entityId);
        novel.relationships = (novel.relationships || []).filter(
          (r) => r.sourceId !== entityId && r.targetId !== entityId,
        );
        localService.saveData(data);
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await deleteDoc(doc(db, "novels", novelId, "entities", entityId));

      const relsSnap = await getDocs(
        query(
          collection(db, "novels", novelId, "relationships"),
          where("sourceId", "==", entityId),
        ),
      );
      const relsSnap2 = await getDocs(
        query(
          collection(db, "novels", novelId, "relationships"),
          where("targetId", "==", entityId),
        ),
      );
      const batch = writeBatch(db);
      relsSnap.docs.forEach((d) => batch.delete(d.ref));
      relsSnap2.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `novels/${novelId}/entities/${entityId}`,
      );
    }
  },

  /**
   * Crea una ficha en la enciclopedia de forma manual.
   */
  addEntity: async (
    isLocal: boolean,
    novelId: string,
    entity: Partial<WorldEntity>,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel) {
        novel.entities = novel.entities || [];
        novel.entities.push({
          id: crypto.randomUUID(),
          novelId,
          name: entity.name || "Sin nombre",
          type: entity.type || "character",
          summary: entity.summary || "",
          updatedAt: new Date().toISOString(),
          status:
            entity.status || (entity.type === "character" ? "Vivo" : "Paz"),
          tags: [],
          headerColor:
            entity.headerColor ||
            (entity.type === "character" ? "#1a1d23" : "#0f172a"),
          ...entity,
        } as WorldEntity);
        localService.saveData(data);
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await addDoc(collection(db, "novels", novelId, "entities"), {
        ...entity,
        novelId,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `novels/${novelId}/entities`,
      );
    }
  },

  // ==========================================
  // 5. OPERACIONES DE VÍNCULOS (RELATIONSHIPS)
  // ==========================================

  /**
   * Añade una nueva relación/vínculo directa y manual entre dos fichas.
   */
  addRelationship: async (
    isLocal: boolean,
    novelId: string,
    relationship: Partial<Relationship>,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel) {
        novel.relationships = novel.relationships || [];
        novel.relationships.push({
          id: crypto.randomUUID(),
          novelId,
          sourceId: relationship.sourceId!,
          targetId: relationship.targetId!,
          sourceName: relationship.sourceName!,
          targetName: relationship.targetName!,
          relationType: relationship.relationType!,
          description: relationship.description || "",
          isUserDefined: true,
          isPending: false,
          updatedAt: new Date().toISOString(),
        } as Relationship);
        localService.saveData(data);
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await addDoc(collection(db, "novels", novelId, "relationships"), {
        ...relationship,
        novelId,
        isUserDefined: true,
        isPending: false,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `novels/${novelId}/relationships`,
      );
    }
  },

  /**
   * Modifica los datos o confirma una relación existente (cambiando isPending a false).
   */
  updateRelationship: async (
    isLocal: boolean,
    novelId: string,
    relId: string,
    updates: Partial<Relationship>,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel) {
        const rel = novel.relationships?.find((r) => r.id === relId);
        if (rel) {
          Object.assign(rel, updates, { updatedAt: new Date().toISOString() });
          localService.saveData(data);
        }
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await updateDoc(doc(db, "novels", novelId, "relationships", relId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `novels/${novelId}/relationships/${relId}`,
      );
    }
  },

  /**
   * Remueve permanentemente una relación de la novela.
   */
  deleteRelationship: async (
    isLocal: boolean,
    novelId: string,
    relId: string,
  ) => {
    // --- Flujo Modo Local ---
    if (isLocal) {
      const data = localService.getData();
      const novel = data.novels.find((n) => n.id === novelId);
      if (novel) {
        novel.relationships = (novel.relationships || []).filter(
          (r) => r.id !== relId,
        );
        localService.saveData(data);
      }
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await deleteDoc(doc(db, "novels", novelId, "relationships", relId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `novels/${novelId}/relationships/${relId}`,
      );
    }
  },
  
  // ==========================================
  // 6. PAPELERA DE NOVELAS (NOVEL TRASH SYSTEM)
  // ==========================================

  trashNovel: async (isLocal: boolean, novelId: string) => {
    const deletedAt = new Date().toISOString();
    if (isLocal) {
      const data = localService.getData();
      const index = data.novels.findIndex(n => n.id === novelId);
      if (index > -1) {
        data.novels[index].deletedAt = deletedAt;
        localService.saveData(data);
      }
      return;
    }
    try {
      await updateDoc(doc(db, 'novels', novelId), { deletedAt, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `novels/${novelId}/trash`);
    }
  },

  restoreNovel: async (isLocal: boolean, novelId: string) => {
    if (isLocal) {
      const data = localService.getData();
      const index = data.novels.findIndex(n => n.id === novelId);
      if (index > -1) {
        delete data.novels[index].deletedAt;
        localService.saveData(data);
      }
      return;
    }
    try {
      await updateDoc(doc(db, 'novels', novelId), { deletedAt: null, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `novels/${novelId}/restore`);
    }
  },

  deleteNovelPermanently: async (isLocal: boolean, novelId: string) => {
    if (isLocal) {
      const data = localService.getData();
      const novelToDelete = data.novels.find(n => n.id === novelId);
      if (novelToDelete) {
        data.novels = data.novels.filter(n => n.id !== novelId);
        localService.saveData(data);
      }
      return;
    }
    try {
      // Nota: En un entorno real de producción, una Cloud Function debería borrar las subcolecciones.
      // Aquí borramos el documento principal de la novela.
      await deleteDoc(doc(db, 'novels', novelId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${novelId}/hardDelete`);
    }
  },

  pruneExpiredNovelTrash: async (isLocal: boolean, trashedNovels: Novel[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const expired = trashedNovels.filter(n => n.deletedAt && new Date(n.deletedAt) < thirtyDaysAgo);
    if (expired.length === 0) return;

    if (isLocal) {
      const data = localService.getData();
      const expiredIds = new Set(expired.map(e => e.id));
      data.novels = data.novels.filter(n => !expiredIds.has(n.id));
      localService.saveData(data);
      return;
    }
    try {
      const batch = writeBatch(db);
      expired.forEach(n => batch.delete(doc(db, 'novels', n.id)));
      await batch.commit();
    } catch (error) {
      console.error('Error pruning expired novel trash:', error);
    }
  }
};
