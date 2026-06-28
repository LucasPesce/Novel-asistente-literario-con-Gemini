import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import {
  ChevronLeft, Plus, Users, MapPin, Share2, BookOpen, Trash2, Loader2,
  RefreshCw, Edit2, Save, X, Tag, Info, Flag, MessageSquare, Database,
  FileText, Sparkles, Palette, ArrowUp, ArrowDown
} from 'lucide-react';
import { Novel, Chapter, WorldEntity, Relationship, EntityType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeChapter, splitIntoChapters, generateFinalReport, FinalReport } from '../lib/gemini';
import RelationshipGraph from './RelationshipGraph';
import WorldChat from './WorldChat';
import { cn, formatDate } from '../lib/utils';

// Importación de Subcomponentes Refactorizados
import ChapterTab from '../components/ChapterTab';
import TrashTab from '../components/TrashTab';
import EntityTab from '../components/EntityTab';

import { storageService } from '../services/storageService';
import { localService } from '../services/localService';
import { googleDriveService } from '../services/googleDriveService';

// ==========================================
// INTERFACES & PROPS
// ==========================================
interface NovelViewProps {
  novel: Novel;
  onBack: () => void;
  isLocalMode?: boolean;
}

export default function NovelView({ novel: initialNovel, onBack, isLocalMode }: NovelViewProps) {
  // ==========================================
  // ESTADOS (STATES)
  // ==========================================
  const [novel, setNovel] = useState<Novel>(initialNovel);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [activeTab, setActiveTab] = useState<'chapters' | 'characters' | 'locations' | 'lore' | 'graph' | 'chat' | 'trash'>('chapters');

  // Estados para Capítulos
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({ title: '', content: '' });
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [readingChapter, setReadingChapter] = useState<Chapter | null>(null);
  const [isPrologue, setIsPrologue] = useState(false);

  // Estados de carga (loaders)
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados para Entidades & Relaciones
  const [editingEntity, setEditingEntity] = useState<WorldEntity | null>(null);
  const [newRelTargetId, setNewRelTargetId] = useState('');
  const [newRelType, setNewRelType] = useState('');
  const [isAddingRel, setIsAddingRel] = useState(false);

  // Estados para Reporte Final (IA)
  const [showFinalReportModal, setShowFinalReportModal] = useState(false);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Estados auxiliares de borrado preventivo
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [deletingEntityId, setDeletingEntityId] = useState<string | null>(null);

  // Separación en memoria de Capítulos Activos vs Papelera
  const activeChapters = chapters.filter(c => !c.deletedAt);
  const trashedChapters = chapters.filter(c => !!c.deletedAt);

  // ==========================================
  // EFECTOS (EFFECTS)
  // ==========================================

  // Efecto 1: Suscripción en tiempo real a los datos de la novela (Local o Nube)
  useEffect(() => {
    const unsub = storageService.getNovelData(
      !!isLocalMode,
      novel.id,
      setNovel,
      setChapters,
      setEntities,
      setRelationships
    );
    return () => unsub();
  }, [novel.id, isLocalMode]);

  // Efecto 2: Limpiador automático de la papelera que destruye capítulos que superen los 30 días
  useEffect(() => {
    if (trashedChapters.length > 0) {
      storageService.pruneExpiredTrash(!!isLocalMode, novel.id, trashedChapters);
    }
  }, [chapters, novel.id, isLocalMode]);

  // ==========================================
  // MANEJADORES DE EVENTOS (HANDLERS)
  // ==========================================

  /**
   * Sincroniza la novela actual en formato de archivos estructurados
   */
  const handleSyncToDrive = async () => {
    if (isSyncing) return;
    try {
      setIsSyncing(true);
      await googleDriveService.syncToDrive(novel, chapters, entities, relationships);
      if (isLocalMode) {
        await localService.syncNovelToLocal(novel, chapters, entities, relationships);
      }
      alert('Sincronización exitosa.');
    } catch (error: any) {
      console.error(error);
      alert('Error al sincronizar. Revisa tus permisos y conexión Drive.');
    } finally {
      setIsSyncing(false);
    }
  };
 
  /**
   * Guarda un nuevo capítulo o actualiza el contenido de uno ya existente.
   */
  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapter.content.trim()) return;

    try {
      setIsSaving(true);

      const hasPrologue = activeChapters.some(c => c.chapterNumber === 0);
      const nextDisplayNumber = hasPrologue ? activeChapters.length : activeChapters.length + 1;
      const title = newChapter.title.trim() || (isPrologue ? 'Prólogo' : `Capítulo ${nextDisplayNumber}`);

      const regularChapters = activeChapters.filter(c => c.chapterNumber > 0);
      const internalSortNumber = regularChapters.length > 0
        ? Math.max(...regularChapters.map(c => c.chapterNumber)) + 1
        : 1;

      if (editingChapterId) {
        await storageService.updateChapter(!!isLocalMode, novel.id, editingChapterId, {
          title: title,
          content: newChapter.content,
        });
      } else {
        await storageService.addChapter(!!isLocalMode, novel.id, {
          title: title,
          content: newChapter.content,
        }, isPrologue ? 0 : internalSortNumber);
      }

      setNewChapter({ title: '', content: '' });
      setIsAddingChapter(false);
      setEditingChapterId(null);
      setIsPrologue(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Envía el manuscrito a Gemini para extraer personajes, lugares, lore y vínculos.
   */
  const handleAnalyze = async (chapter: Chapter) => {
    if (isAnalyzing) return;
    setIsAnalyzing(chapter.id);

    try {
      const existingEntitiesSummary = entities.map(e => `${e.name}: ${e.summary}`).join('\n');
      const existingRelsSummary = relationships.map(r => `${r.sourceName} -> ${r.targetName}: ${r.relationType}`).join('\n');

      const result = await analyzeChapter(chapter.content, existingEntitiesSummary, existingRelsSummary);

      await storageService.saveEntitiesAndRelationships(
        !!isLocalMode,
        novel.id,
        result.entities,
        result.relationships,
        chapter.id,
        chapter.title,
        entities,
        relationships
      );

      await storageService.updateChapter(!!isLocalMode, novel.id, chapter.id, { analyzed: true });
    } catch (error: any) {
      if (error.message === 'API_KEY_MISSING') {
        alert('Falta la API Key de Gemini. Haz clic en el ícono de la llave 🔑 en la barra superior para configurarla.');
      } else {
        console.error(error);
      }
    } finally {
      setIsAnalyzing(null);
    }
  };

  /**
   * Envía un capítulo activo a la papelera (Soft Delete).
   */
  const handleDeleteChapter = async (id: string) => {
    if (deletingChapterId !== id) {
      setDeletingChapterId(id);
      setTimeout(() => setDeletingChapterId(null), 3000);
      return;
    }
    try {
      await storageService.trashChapter(!!isLocalMode, novel.id, id);
      setDeletingChapterId(null);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Mueve un capítulo hacia arriba o abajo en la lista de activos y actualiza el ordenamiento.
   */
  const handleMoveChapter = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= activeChapters.length) return;

    if (activeChapters[index].chapterNumber === 0 && direction === 'down') return;
    if (activeChapters[newIndex].chapterNumber === 0 && direction === 'up') return;

    try {
      setIsSaving(true);
      const newActiveChapters = [...activeChapters];

      const temp = newActiveChapters[index];
      newActiveChapters[index] = newActiveChapters[newIndex];
      newActiveChapters[newIndex] = temp;

      const hasPrologue = newActiveChapters.some(c => c.chapterNumber === 0);
      newActiveChapters.forEach((chap, i) => {
        if (hasPrologue && i === 0) chap.chapterNumber = 0;
        else chap.chapterNumber = hasPrologue ? i : i + 1;
      });

      const mergedChapters = [...newActiveChapters, ...trashedChapters];

      setChapters(mergedChapters);
      await storageService.reorderChapters(!!isLocalMode, novel.id, mergedChapters);
    } catch (error) {
      console.error('Error reordering chapters:', error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Elimina de forma lógica o permanente una ficha de la enciclopedia.
   */
  const handleDeleteEntity = async (id: string) => {
    if (deletingEntityId !== id) {
      setDeletingEntityId(id);
      setTimeout(() => setDeletingEntityId(null), 3000);
      return;
    }
    try {
      await storageService.deleteEntity(!!isLocalMode, novel.id, id);
      setDeletingEntityId(null);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Agrega de forma manual una ficha vacía a la enciclopedia.
   */
  const handleManualAddEntity = async (type: EntityType) => {
    const name = prompt(`Nombre del ${type === 'character' ? 'Personaje' : type === 'location' ? 'Lugar' : 'Elemento'}:`);
    if (!name) return;

    try {
      setIsSaving(true);
      await storageService.addEntity(!!isLocalMode, novel.id, {
        name,
        type,
        summary: 'Creado manualmente.',
        status: type === 'character' ? 'Vivo' : 'Paz',
        openQuestions: '',
        resolvedQuestions: '',
        isTypeLocked: true
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Actualiza el contenido editado de una ficha.
   */
  const handleUpdateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntity) return;

    try {
      setIsSaving(true);
      const { id, ...data } = editingEntity;
      await storageService.updateEntity(!!isLocalMode, novel.id, id, data);
      setEditingEntity(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Crea una relación manual entre dos fichas.
   */
  const handleAddRelationship = async () => {
    if (!editingEntity || !newRelTargetId || !newRelType) return;

    const target = entities.find(e => e.id === newRelTargetId);
    if (!target) return;

    try {
      setIsSaving(true);
      await storageService.addRelationship(!!isLocalMode, novel.id, {
        sourceId: editingEntity.id,
        targetId: target.id,
        sourceName: editingEntity.name,
        targetName: target.name,
        relationType: newRelType,
        description: ''
      });
      setNewRelTargetId('');
      setNewRelType('');
      setIsAddingRel(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Elimina una relación entre fichas.
   */
  const handleDeleteRelationship = async (relId: string) => {
    if (!confirm('¿Eliminar esta vinculación?')) return;
    try {
      setIsSaving(true);
      await storageService.deleteRelationship(!!isLocalMode, novel.id, relId);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Genera el reporte final de cierre y feedback literario de la IA de Gemini.
   */
  const handleOpenFinalReport = async () => {
    try {
      setIsGeneratingReport(true);
      setShowFinalReportModal(true);
      const report = await generateFinalReport(novel.title, activeChapters, entities);
      setFinalReport(report);
    } catch (error: any) {
      if (error.message === 'API_KEY_MISSING') {
        alert('Falta la API Key de Gemini. Haz clic en el ícono de la llave 🔑 en la barra superior para configurarla.');
      } else {
        console.error('Error generating final report:', error);
        alert('Error al generar el reporte final. Inténtalo de nuevo.');
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * Bloquea la novela cambiando su estado a "Finalizada".
   */
  const handleConfirmFinalize = async () => {
    try {
      setIsSaving(true);
      const updates = {
        status: 'Finalizada' as const,
        updatedAt: new Date().toISOString()
      };
      if (isLocalMode) {
        const data = localService.getData();
        const updatedData = {
          ...data,
          novels: data.novels.map(n => n.id === novel.id ? { ...n, ...updates } : n)
        };
        localService.saveData(updatedData);
        setNovel(prev => ({ ...prev, ...updates }));
      } else {
        await updateDoc(doc(db, 'novels', novel.id), updates);
        setNovel(prev => ({ ...prev, ...updates }));
      }
      setShowFinalReportModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Desbloquea la novela para continuar editando.
   */
  const handleResumeNovel = async () => {
    if (!confirm('¿Quieres reanudar la escritura? Esto te permitirá añadir capítulos y editar el mundo de nuevo.')) return;
    try {
      setIsSaving(true);
      const updates = {
        status: 'En Desarrollo' as const,
        updatedAt: new Date().toISOString()
      };

      if (isLocalMode) {
        const data = localService.getData();
        const novelIndex = data.novels.findIndex(n => n.id === novel.id);
        if (novelIndex > -1) {
          const updatedNovel = { ...data.novels[novelIndex], ...updates };
          const updatedNovels = [...data.novels];
          updatedNovels[novelIndex] = updatedNovel;

          await localService.saveData({
            ...data,
            novels: updatedNovels
          });

          setNovel(updatedNovel);
        }
      } else {
        await updateDoc(doc(db, 'novels', novel.id), updates);
        setNovel(prev => ({ ...prev, ...updates }));
      }

      setShowFinalReportModal(false);
      setFinalReport(null);
      alert('La novela ha sido reanudada exitosamente.');
    } catch (error: any) {
      console.error('Resume error:', error);
      alert(`Error al reanudar la novela: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Exporta la novela activa a formato Word (.doc) en el Standard Manuscript Format.
   */
  const handleExportDoc = async () => {
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${novel.title}</title>
      <style>
        @page {
          size: 8.5in 11in;
          margin: 1.0in;
        }
        body { 
          font-family: "Times New Roman", Times, serif; 
          font-size: 12pt; 
          line-height: 2.0;
          color: #000000; 
          margin: 0;
        }
        h1 { 
          text-align: center; 
          font-size: 24pt; 
          margin-bottom: 10pt; 
          font-weight: bold; 
        }
        .subtitle { 
          text-align: center; 
          font-size: 12pt; 
          color: #555555; 
          margin-bottom: 60pt; 
          font-style: italic;
        }
        h3 { 
          font-size: 16pt; 
          margin-top: 40pt; 
          text-align: center;
          font-weight: bold;
          page-break-before: always;
        }
        .chapter { 
          margin-bottom: 40pt; 
        }
        .content {
          margin-top: 20pt;
        }
        .content p {
          text-indent: 0.5in;
          margin: 0;
          text-align: left;
          padding: 0;
        }
        .content p:first-of-type {
          text-indent: 0;
        }
        .footer { 
          text-align: center; 
          font-size: 10pt; 
          color: #999999; 
          margin-top: 80pt; 
          border-top: 1px solid #eeeeee; 
          padding-top: 20pt; 
        }
      </style>
      </head>
      <body>
        <h1>${novel.title}</h1>
        <p class="subtitle">Manuscrito Oficial de Novela</p>
        
        ${activeChapters.map((c, index) => {
          const hasPrologue = activeChapters.length > 0 && activeChapters[0].chapterNumber === 0;
          const isThisPrologue = c.chapterNumber === 0;
          const displayNum = hasPrologue ? index : index + 1;
          const displayLabel = isThisPrologue ? 'Prólogo' : `Capítulo ${displayNum}`;

          const paragraphsHtml = c.content
            .split(/\n+/)
            .map(para => para.trim())
            .filter(para => para.length > 0)
            .map(para => `<p>${para}</p>`)
            .join('\n');

          return `
          <div class="chapter">
            <h3>${displayLabel}: ${c.title}</h3>
            <div class="content">
              ${paragraphsHtml}
            </div>
          </div>
          `;
        }).join('')}
        
        <div class="footer">Documento generado por Novel. Fecha de exportación: ${new Date().toLocaleDateString()}</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });

    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${novel.title.replace(/\s+/g, '_')}_manuscrito.doc`,
          types: [{
            description: 'Documento de Microsoft Word (.doc)',
            accept: {
              'application/msword': ['.doc']
            }
          }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error al guardar el manuscrito:', error);
          alert('Hubo un problema al intentar guardar el archivo.');
        }
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${novel.title.replace(/\s+/g, '_')}_manuscrito.doc`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /**
   * Carga la imagen local para el avatar de la entidad.
   */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingEntity) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingEntity({ ...editingEntity, imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // ==========================================
  // DISEÑO VISUAL (RENDER)
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Cabecera superior con título y exportación */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-brand-border gap-4">
        <div className="flex gap-4">
          <button
            onClick={onBack}
            title="Volver atrás"
            className="p-2 hover:bg-brand-card/50 rounded-full transition-colors text-zinc-400"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-brand-text leading-tight">{novel.title}</h2>
              {novel.status === 'Finalizada' && (
                <div className="px-3 py-1 bg-brand-primary/20 border border-brand-primary/30 text-brand-primary rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md">
                  <Flag className="w-3 h-3" />
                  Finalizada
                </div>
              )}
            </div>
            <p className="text-brand-muted text-sm">Enciclopedia del Mundo Digital</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportDoc}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-xl hover:bg-brand-primary/20 transition-all font-bold shadow-sm cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline text-xs uppercase tracking-widest">Exportar .doc</span>
          </button>
        </div>
      </div>

      {/* Barra de pestañas navegables */}
      <div className="flex gap-2 p-1 bg-brand-card rounded-xl w-fit border border-brand-border overflow-x-auto max-w-full">
        {[
          { id: 'chapters', label: 'Capítulos', icon: BookOpen },
          { id: 'characters', label: 'Personajes', icon: Users },
          { id: 'locations', label: 'Lugares', icon: MapPin },
          { id: 'lore', label: 'Mundo', icon: Sparkles },
          { id: 'graph', label: 'Mapa Visual', icon: Share2 },
          { id: 'chat', label: 'Chat con Novel', icon: MessageSquare },
          { id: 'trash', label: `Papelera (${trashedChapters.length})`, icon: Trash2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer",
              activeTab === tab.id
                ? "bg-brand-primary text-zinc-950 shadow-lg shadow-brand-primary/20"
                : "text-brand-muted hover:text-brand-text hover:bg-brand-card/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenedor dinámico de Pestañas */}
      <div className="grid grid-cols-1 gap-8">
        <AnimatePresence mode="wait">

          {/* PESTAÑA: CAPÍTULOS */}
          {activeTab === 'chapters' && (
            <motion.div key="chapters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <ChapterTab
                activeChapters={activeChapters}
                novel={novel}
                isLocalMode={!!isLocalMode} // Corregido a booleano estricto
                isSaving={isSaving}
                isSyncing={isSyncing}
                isAddingChapter={isAddingChapter}
                isAnalyzing={isAnalyzing}
                newChapter={newChapter}
                isPrologue={isPrologue}
                editingChapterId={editingChapterId}
                deletingChapterId={deletingChapterId}
                setIsAddingChapter={setIsAddingChapter}
                setNewChapter={setNewChapter}
                setIsPrologue={setIsPrologue}
                setEditingChapterId={setEditingChapterId}
                setReadingChapter={setReadingChapter}
                handleSyncToDrive={handleSyncToDrive}
                handleMoveChapter={handleMoveChapter}
                handleAnalyze={handleAnalyze}
                handleDeleteChapter={handleDeleteChapter}
                handleAddChapter={handleAddChapter}
                handleOpenFinalReport={handleOpenFinalReport}
                handleResumeNovel={handleResumeNovel}
              />
            </motion.div>
          )}

          {/* PESTAÑAS DE LA ENCICLOPEDIA (PERSONAJES, LUGARES, LORE) */}
          {(activeTab === 'characters' || activeTab === 'locations' || activeTab === 'lore') && (
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <EntityTab
                entities={entities}
                relationships={relationships}
                novel={novel}
                activeTab={activeTab}
                isAnalyzing={isAnalyzing}
                deletingEntityId={deletingEntityId}
                setEditingEntity={setEditingEntity}
                handleManualAddEntity={handleManualAddEntity}
                handleDeleteEntity={handleDeleteEntity}
              />
            </motion.div>
          )}

          {/* PESTAÑA: PAPELERA DE RECICLAJE */}
          {activeTab === 'trash' && (
            <motion.div key="trash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <TrashTab
                trashedChapters={trashedChapters}
                activeChapters={activeChapters}
                novel={novel}
                isLocalMode={!!isLocalMode} // Corregido a booleano estricto
              />
            </motion.div>
          )}

          {/* PESTAÑA: GRAPH (MAPA VISUAL) */}
          {activeTab === 'graph' && (
            <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RelationshipGraph entities={entities} relationships={relationships} />
            </motion.div>
          )}

          {/* PESTAÑA: CHAT CON NOVEL */}
          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <WorldChat entities={entities} chapters={chapters} novelTitle={novel.title} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ==========================================
          MODALES GLOBALES (MODALS)
          ========================================== */}

      {/* MODAL: REPORTE FINAL DE LA IA */}
      <AnimatePresence>
        {showFinalReportModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isGeneratingReport && setShowFinalReportModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} className="relative w-full max-w-5xl bg-brand-card rounded-[3rem] border border-brand-primary/20 shadow-[0_0_100px_rgba(209,168,82,0.05)] overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-8 bg-brand-primary/10 border-b border-brand-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-primary rounded-2xl shadow-lg shadow-brand-primary/20">
                    <Flag className="w-8 h-8 text-zinc-950" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-brand-text tracking-tight">Reporte Final de Obra</h3>
                    <p className="text-brand-primary text-xs font-bold uppercase tracking-widest">Opinión de Novel</p>
                  </div>
                </div>
                {!isGeneratingReport && (
                  <button onClick={() => setShowFinalReportModal(false)} title="Cerrar reporte" className="p-2 hover:bg-brand-primary/10 rounded-full text-brand-muted"><X /></button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {isGeneratingReport ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-6 py-20">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 text-brand-primary animate-spin" />
                      <Sparkles className="w-6 h-6 text-brand-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-brand-text animate-pulse">Novel está analizando tu historia...</p>
                      <p className="text-brand-muted text-sm mt-2">Cruzando destinos, cerrando arcos y evaluando tu estilo.</p>
                    </div>
                  </div>
                ) : finalReport ? (
                  <div className="space-y-12 pb-12">
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-brand-primary" />
                        <h4 className="text-lg font-black text-brand-text uppercase tracking-[0.2em] border-b-2 border-brand-primary/20 pb-2 flex-1">Destino de los Personajes</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {finalReport.characterSummaries.map((char, i) => (
                          <div key={i} className="bg-brand-card/40 p-6 rounded-3xl border border-brand-border space-y-3">
                            <h5 className="text-brand-primary font-bold text-xl">{char.name}</h5>
                            <div>
                              <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">Resultado Final</p>
                              <p className="text-brand-text text-sm leading-relaxed">{char.outcome}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">Evolución del Arco</p>
                              <p className="text-brand-muted text-xs font-serif italic">{char.evolution}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-brand-primary" />
                        <h4 className="text-lg font-black text-brand-text uppercase tracking-[0.2em] border-b-2 border-brand-primary/20 pb-2 flex-1">Estado del Mundo</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {finalReport.locationSummaries.map((loc, i) => (
                          <div key={i} className="bg-brand-card/40 p-6 rounded-3xl border border-brand-border space-y-3">
                            <div className="flex justify-between items-start gap-4">
                              <h5 className="text-brand-primary font-bold text-xl leading-tight flex-1 break-words">{loc.name}</h5>
                              <span className="px-2 py-1 bg-brand-primary/20 text-brand-primary rounded text-[10px] font-black uppercase tracking-widest break-words max-w-[50%] text-right">{loc.state}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", loc.conflictStatus.toLowerCase().includes('resuelto') ? "bg-brand-success" : "bg-brand-error")} />
                              <p className="text-xs font-bold text-brand-text">{loc.conflictStatus}</p>
                            </div>
                            <p className="text-brand-muted text-sm italic font-serif">{loc.resolution}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="bg-brand-primary/5 p-10 rounded-[3rem] border border-brand-primary/10 space-y-8">
                      <div className="text-center space-y-6">
                        <div>
                          <Palette className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                          <h4 className="text-3xl font-black text-brand-text">Tu Perfil de Escritor</h4>
                        </div>
                        <div className="bg-brand-card border border-brand-primary/20 p-6 md:p-8 rounded-3xl shadow-xl max-w-4xl mx-auto text-left">
                          <div className="text-brand-text text-lg leading-relaxed font-serif whitespace-pre-wrap">{finalReport.writerFeedback.profile}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                        <div className="space-y-6">
                          <div>
                            <h5 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-3">Evolución de Estilo</h5>
                            <p className="text-brand-text leading-relaxed italic font-serif text-lg">{finalReport.writerFeedback.evolution}</p>
                          </div>
                          <div>
                            <h5 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-3">Análisis Técnico</h5>
                            <p className="text-brand-muted leading-relaxed text-sm">{finalReport.writerFeedback.styleAnalysis}</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-brand-bg/40 p-6 rounded-3xl border border-brand-border">
                            <h5 className="text-[10px] font-black text-brand-success uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" /> Fortalezas Detectadas
                            </h5>
                            <ul className="space-y-3">
                              {finalReport.writerFeedback.strengths.map((s, i) => (
                                <li key={i} className="flex gap-3 text-sm text-brand-text"><span className="text-brand-success">✦</span> {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-brand-bg/40 p-6 rounded-3xl border border-brand-border">
                            <h5 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <RefreshCw className="w-4 h-4" /> Áreas de Crecimiento
                            </h5>
                            <ul className="space-y-3">
                              {finalReport.writerFeedback.areasForImprovement.map((s, i) => (
                                <li key={i} className="flex gap-3 text-sm text-brand-text"><span className="text-brand-primary">✦</span> {s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </section>

                    <div className="flex flex-col items-center gap-4 py-8">
                      <p className="text-brand-muted text-sm text-center max-w-md">Al confirmar, la novela quedará bloqueada para edición. Siempre podrás reanudarla si decides expandir el universo.</p>
                      <div className="flex gap-4">
                        <button onClick={() => setShowFinalReportModal(false)} className="px-8 py-4 text-brand-muted font-bold hover:text-brand-text transition-colors">Continuar Escribiendo</button>
                        <button onClick={handleConfirmFinalize} disabled={isSaving} className="px-12 py-4 bg-brand-primary text-zinc-950 rounded-2xl font-black shadow-2xl shadow-brand-primary/20 hover:scale-105 transition-all text-lg active:scale-95 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" /> : 'CONFIRMAR FINALIZAR'}</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: LECTOR DE CAPÍTULO COMPLETO */}
      <AnimatePresence>
        {readingChapter && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReadingChapter(null)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }} className="relative w-full max-w-4xl bg-brand-card rounded-[3rem] border border-brand-border overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-8 border-b border-brand-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1">
                    {(() => {
                      const readingIndex = chapters.findIndex(c => c.id === readingChapter.id);
                      const hasPrologue = chapters.length > 0 && chapters[0].chapterNumber === 0;
                      const isThisPrologue = readingChapter.chapterNumber === 0;
                      const displayNum = hasPrologue ? readingIndex : readingIndex + 1;
                      return isThisPrologue ? 'Prólogo' : `Capítulo ${displayNum}`;
                    })()}
                  </div>
                  <h3 className="text-2xl font-bold text-brand-text">{readingChapter.title}</h3>
                </div>
                <button onClick={() => setReadingChapter(null)} title="Cerrar lectura" aria-label="Cerrar lectura" className="p-3 bg-brand-primary/10 hover:bg-brand-primary/20 rounded-2xl text-brand-muted hover:text-brand-text transition-all cursor-pointer"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-2xl mx-auto">
                  <div className="text-brand-muted text-xl leading-[2] font-serif whitespace-pre-wrap selection:bg-brand-primary/30">{readingChapter.content}</div>
                </div>
              </div>
              <div className="p-6 border-t border-brand-border bg-brand-card/30 flex justify-center">
                <button onClick={() => setReadingChapter(null)} className="px-8 py-3 bg-brand-primary text-zinc-950 rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer">Cerrar Lectura</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITOR Y DETALLE DE LA ENTIDAD */}
      <AnimatePresence>
        {editingEntity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingEntity(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-brand-card rounded-[2.5rem] border border-brand-border overflow-hidden">
              <div className="h-32 p-8 flex items-center justify-between" style={{ backgroundColor: editingEntity.headerColor || '#2d2825' }}>
                <h3 className="text-2xl font-black text-[#f3f0eb]">Editar Tarjeta</h3>
                <button onClick={() => setEditingEntity(null)} title="Cerrar modal" aria-label="Cerrar modal" className="p-2 bg-black/20 rounded-full text-white hover:bg-black/40 transition-colors"><X /></button>
              </div>

              <form onSubmit={handleUpdateEntity} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Nombre</label>
                    <input type="text" value={editingEntity.name} title="Nombre de la entidad" aria-label="Nombre de la entidad" onChange={e => setEditingEntity({ ...editingEntity, name: e.target.value })} className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Estado</label>
                    <input type="text" placeholder="Vivo, Muerto, En guerra..." value={editingEntity.status || ''} onChange={e => setEditingEntity({ ...editingEntity, status: e.target.value })} className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest text-brand-primary/80">Misterios Pendientes</label>
                    <textarea placeholder="Misterios, secretos o preguntas sin resolver..." title="Misterios pendientes" aria-label="Misterios pendientes" value={editingEntity.openQuestions || ''} onChange={e => setEditingEntity({ ...editingEntity, openQuestions: e.target.value })} className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2 text-brand-text h-24 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-serif" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest text-brand-success/80">Misterios Resueltos</label>
                    <textarea placeholder="Misterios que ya tienen respuesta..." title="Misterios resueltos" aria-label="Misterios resueltos" value={editingEntity.resolvedQuestions || ''} onChange={e => setEditingEntity({ ...editingEntity, resolvedQuestions: e.target.value })} className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2 text-brand-text h-24 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-serif" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Resumen (Enciclopedia)</label>
                  <textarea value={editingEntity.summary} aria-label="Resumen de la enciclopedia" placeholder="Escribe un resumen aquí..." onChange={e => setEditingEntity({ ...editingEntity, summary: e.target.value })} className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2 text-brand-text h-32 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-serif" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Etiquetas (separadas por coma)</label>
                  <div className="flex items-center gap-2 bg-brand-bg border border-brand-border rounded-xl px-4 py-2">
                    <Tag className="w-4 h-4 text-brand-muted" />
                    <input type="text" placeholder={editingEntity.type === 'character' ? "noble, guerrero, secreto..." : editingEntity.type === 'location' ? "lejano, peligroso, místico..." : "criatura, dios, objeto, raza..."} value={editingEntity.tags?.join(', ') || ''} onChange={e => setEditingEntity({ ...editingEntity, tags: e.target.value.split(',').map(s => s.trim()) })} className="flex-1 bg-transparent border-none focus:ring-0 text-brand-text placeholder:text-brand-muted" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Color de Cabecera</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['#2d2825', '#1e2420', '#2b1e2a', '#9a7b4f', '#4f7a9a', '#7a4f9a', '#9a4f4f', '#4f9a7a', 'bg-brand-card'].map(c => (
                        <button key={c} type="button" onClick={() => setEditingEntity({ ...editingEntity, headerColor: c })} title={`Seleccionar color ${c}`} aria-label={`Seleccionar color ${c}`} className={cn("w-6 h-6 rounded-md border transition-all active:scale-90", (editingEntity.headerColor || '#2d2825') === c ? "border-white scale-110 shadow-lg" : "border-white/10 hover:border-white/30")} style={{ backgroundColor: c }} />
                      ))}
                      <div className="relative">
                        <input type="color" aria-label="Seleccionar color" value={editingEntity.headerColor || '#2d2825'} onChange={e => setEditingEntity({ ...editingEntity, headerColor: e.target.value })} className="w-6 h-6 bg-transparent border-none cursor-pointer opacity-0 absolute inset-0 z-10" />
                        <div className="w-6 h-6 rounded-md border border-white/20 flex items-center justify-center bg-white/5">
                          <Palette className="w-3 h-3 text-brand-muted" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Imagen de Portada</label>
                    <div className="flex gap-2">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="image-upload" />
                      <label htmlFor="image-upload" className="flex-1 bg-white/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text text-sm text-center cursor-pointer hover:bg-white/10 transition-colors">{editingEntity.imageUrl ? 'Cambiar Foto' : 'Subir Foto'}</label>
                      {editingEntity.imageUrl && (
                        <button type="button" onClick={() => setEditingEntity({ ...editingEntity, imageUrl: '' })} className="px-4 py-2 bg-brand-error/10 text-brand-error border border-brand-error/20 rounded-xl text-sm">Quitar</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-brand-border">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Vinculaciones Directas</label>
                    <button type="button" onClick={() => setIsAddingRel(!isAddingRel)} className="text-brand-primary text-[10px] font-black uppercase tracking-widest hover:underline">{isAddingRel ? 'Cancelar' : '+ Añadir Vínculo'}</button>
                  </div>

                  {isAddingRel && (
                    <div className="bg-brand-bg/40 p-4 rounded-2xl border border-brand-border space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <select value={newRelTargetId} onChange={e => setNewRelTargetId(e.target.value)} title="Seleccionar entidad a vincular" className="w-full bg-white/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text text-xs focus:ring-0">
                          <option value="">Vincular con...</option>
                          {entities.filter(e => e.id !== editingEntity.id).map(e => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
                        </select>
                        <input type="text" placeholder="Tipo: Aliado, Pertenece a, Visto en..." value={newRelType} onChange={e => setNewRelType(e.target.value)} className="w-full bg-white/5 border border-brand-border rounded-xl px-4 py-2 text-brand-text text-xs focus:ring-0" />
                      </div>
                      <button type="button" onClick={handleAddRelationship} disabled={!newRelTargetId || !newRelType} className="w-full py-2 bg-brand-primary/20 text-brand-primary rounded-xl font-bold text-xs uppercase hover:bg-brand-primary/30 disabled:opacity-30">Crear Vinculación</button>
                    </div>
                  )}

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {relationships.filter(r => r.sourceId === editingEntity.id || r.targetId === editingEntity.id).map(rel => {
                      const isSource = rel.sourceId === editingEntity.id;
                      const otherName = isSource ? rel.targetName : rel.sourceName;
                      const isPending = rel.isPending;

                      return (
                        <div key={rel.id} className={cn("flex items-center justify-between p-3 rounded-xl border transition-all", isPending ? "bg-brand-primary/5 border-brand-primary/20" : "bg-brand-card/20 border-brand-border")}>
                          <div className="flex-1 flex items-center gap-3">
                            <div className={cn("w-1.5 h-1.5 rounded-full", isPending ? "bg-[#c2a884] animate-pulse" : "bg-brand-primary")} />
                            <div className="flex flex-col">
                              <input type="text" value={rel.relationType} title="Tipo de relación" onChange={async (e) => {
                                const newValue = e.target.value;
                                await storageService.updateRelationship(!!isLocalMode, novel.id, rel.id, { relationType: newValue, isUserDefined: true, isPending: false });
                              }} className="bg-transparent border-none p-0 text-brand-text text-xs font-bold focus:ring-0 w-24 h-4" />
                              <span className="text-brand-muted text-[10px] uppercase font-black tracking-widest leading-none">{otherName}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isPending && (
                              <button type="button" onClick={async () => {
                                await storageService.updateRelationship(!!isLocalMode, novel.id, rel.id, { isPending: false, isUserDefined: true });
                              }} className="px-2 py-1 bg-[#c2a884]/20 text-[#c2a884] text-[10px] font-black uppercase rounded hover:bg-[#c2a884]/30">Confirmar</button>
                            )}
                            <button type="button" title="Eliminar relación" onClick={() => handleDeleteRelationship(rel.id)} className="p-1.5 text-brand-error/40 hover:text-brand-error transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block">Mover Sección (Fijar Tipo)</label>
                  <div className="flex gap-2">
                    {[
                      { type: 'character', label: 'Personajes', icon: Users },
                      { type: 'location', label: 'Lugares', icon: MapPin },
                      { type: 'lore', label: 'Mundo', icon: Sparkles }
                    ].map(opt => (
                      <button key={opt.type} type="button" onClick={() => setEditingEntity({ ...editingEntity, type: opt.type as any, isTypeLocked: true })} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border transition-all font-bold text-[10px] uppercase", editingEntity.type === opt.type ? "bg-brand-primary border-brand-primary text-zinc-950" : "bg-white/5 border-white/10 text-brand-muted hover:bg-white/10")}><opt.icon className="w-3 h-3" />{opt.label}</button>
                    ))}
                  </div>
                  {editingEntity.isTypeLocked && (
                    <p className="text-[9px] text-brand-primary/60 font-medium italic">* El tipo ha sido fijado manualmente y no cambiará automáticamente.</p>
                  )}
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-brand-border">
                  <button type="button" onClick={() => { if (confirm('¿Eliminar esta ficha permanentemente?')) { handleDeleteEntity(editingEntity.id); setEditingEntity(null); } }} className="text-red-900 text-[10px] font-black uppercase tracking-widest hover:text-red-700 transition-colors">Eliminar del Mundo</button>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditingEntity(null)} className="px-6 py-2 text-brand-muted hover:text-brand-text transition-colors">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-8 py-2 bg-brand-primary text-zinc-950 rounded-xl font-bold hover:bg-brand-secondary shadow-xl disabled:opacity-50 transition-all active:scale-95">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar</button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}