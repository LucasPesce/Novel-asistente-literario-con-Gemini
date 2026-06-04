import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import {
  ChevronLeft, Plus, Users, MapPin, Share2, BookOpen, Trash2, Loader2,
  RefreshCw, Edit2, Save, X, Tag, Info, Flag, MessageSquare, Database,
  FileText, Sparkles, Palette
} from 'lucide-react';
import { Novel, Chapter, WorldEntity, Relationship, EntityType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { analyzeChapter, splitIntoChapters, generateFinalReport, FinalReport } from '../lib/gemini';
import RelationshipGraph from './RelationshipGraph';
import WorldChat from './WorldChat';
import { cn, formatDate } from '../lib/utils';
import mammoth from 'mammoth';

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
  const [activeTab, setActiveTab] = useState<'chapters' | 'characters' | 'locations' | 'lore' | 'graph' | 'chat'>('chapters');

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
  const [isImporting, setIsImporting] = useState(false);

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

  // ==========================================
  // EFECTOS (EFFECTS)
  // ==========================================

  // Suscripción en tiempo real a los datos de la novela (Local o Nube)
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

  // ==========================================
  // MANEJADORES DE EVENTOS (HANDLERS)
  // ==========================================

  // --- SINCRONIZACIÓN DE ARCHIVOS & DRIVE ---

  /**
   * Sincroniza la novela actual en formato estructurado (Carpetas + Capítulos + Metadata)
   * en el Google Drive vinculado del usuario y/o sistema de carpetas locales de PC.
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

  // --- IMPORTACIÓN DE DOCUMENTOS ---

  /**
   * Procesa la carga de manuscritos enteros (archivos .docx, .txt), extrae su texto
   * y utiliza la IA para dividirlo de manera inteligente en múltiples capítulos lógicos.
   */
  const handleImportDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      let text = '';

      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.type === 'application/pdf') {
        alert('El soporte para PDF directo es limitado. Por ahora, se recomienda copiar y pegar el texto o usar un archivo .docx / .txt');
        setIsImporting(false);
        return;
      } else {
        text = await file.text();
      }

      if (!text.trim()) {
        alert('El archivo parece estar vacío.');
        setIsImporting(false);
        return;
      }

      const { chapters: splitChapters } = await splitIntoChapters(text);

      if (splitChapters.length === 0) {
        alert('No se pudieron detectar capítulos automáticamente.');
        return;
      }

      if (confirm(`Se han detectado ${splitChapters.length} capítulos. ¿Deseas importarlos ahora?`)) {
        setIsSaving(true);
        for (let i = 0; i < splitChapters.length; i++) {
          const chap = splitChapters[i];
          await storageService.addChapter(!!isLocalMode, novel.id, {
            title: chap.title,
            content: chap.content,
          }, chapters.length + i);
        }
        alert('Importación completada con éxito.');
      }
    } catch (error: any) {
      if (error.message === 'API_KEY_MISSING') {
        alert('Falta la API Key de Gemini. Haz clic en el ícono de la llave 🔑 en la barra superior para configurarla.');
      } else {
        console.error('Error importing document:', error);
        alert('Error al importar el documento.');
      }
    } finally {
      setIsImporting(false);
      setIsSaving(false);
      e.target.value = '';
    }
  };

  // --- OPERACIONES DE CAPÍTULOS ---

  /**
   * Guarda un nuevo capítulo o actualiza el contenido de uno ya existente.
   */
  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapter.content.trim()) return;

    try {
      setIsSaving(true);
      const title = newChapter.title.trim() || (isPrologue ? 'Prólogo' : `Capítulo ${chapters.length + (chapters.some(c => c.chapterNumber === 0) ? 0 : 1)}`);

      if (editingChapterId) {
        await storageService.updateChapter(!!isLocalMode, novel.id, editingChapterId, {
          title: title,
          content: newChapter.content,
        });
      } else {
        await storageService.addChapter(!!isLocalMode, novel.id, {
          title: title,
          content: newChapter.content,
        }, isPrologue ? 0 : chapters.length + (chapters.some(c => c.chapterNumber === 0) ? 0 : 1));
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
   * Envía el manuscrito del capítulo a Gemini para extraer nuevos personajes, 
   * lugares, lore y vínculos que nutran de forma automática la Biblia de Mundo.
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
   * Borra un capítulo. Cuenta con confirmación preventiva por doble clic.
   */
  const handleDeleteChapter = async (id: string) => {
    if (deletingChapterId !== id) {
      setDeletingChapterId(id);
      setTimeout(() => setDeletingChapterId(null), 3000);
      return;
    }
    try {
      await storageService.deleteChapter(!!isLocalMode, novel.id, id);
      setDeletingChapterId(null);
    } catch (error) {
      console.error(error);
    }
  };

  // --- OPERACIONES DE ENTIDADES DEL MUNDO ---

  /**
   * Elimina una ficha de personaje, lugar o lore. Cuenta con confirmación por doble clic.
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
   * Agrega manualmente una ficha (vacía) al registro de la novela sin usar análisis IA.
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
   * Actualiza los datos editados de una ficha en la base de datos (nombre, resumen, etiquetas, etc).
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

  // --- OPERACIONES DE RELACIONES ---

  /**
   * Crea una relación o vínculo manual personalizado entre dos fichas del mundo.
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
   * Elimina de manera permanente una relación existente.
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

  // --- REPORTES FINALES & EXPORTACIONES ---

  /**
   * Envía toda la Biblia del Mundo acumulada y los títulos de capítulos a la IA
   * para generar una devolución profesional literaria de cierre y feedback técnico del estilo del autor.
   */
  const handleOpenFinalReport = async () => {
    try {
      setIsGeneratingReport(true);
      setShowFinalReportModal(true);
      const report = await generateFinalReport(novel.title, chapters, entities);
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
   * Bloquea el manuscrito cambiando el estado de la novela a "Finalizada".
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
   * Desbloquea la novela cambiando su estado a "En Desarrollo", permitiendo continuar escribiendo.
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
   * Exporta la información estructurada de la novela a formato Markdown (.md) o texto plano (.txt)
   */
  const handleExportMarkdown = (format: 'md' | 'txt') => {
    let content = `# Mundo: ${novel.title}\n\n`;
    content += `## Personajes\n\n`;
    entities.filter(e => e.type === 'character').forEach(e => {
      content += `### ${e.name}\n**Estado**: ${e.status || 'Desconocido'}\n\n${e.summary}\n\n**Misterios**: ${e.openQuestions || 'Ninguno'}\n\n---\n\n`;
    });
    content += `## Lugares\n\n`;
    entities.filter(e => e.type === 'location').forEach(e => {
      content += `### ${e.name}\n**Estado**: ${e.status || 'Explorado'}\n\n${e.summary}\n\n---\n\n`;
    });
    content += `## Detalles del Mundo y Lore\n\n`;
    entities.filter(e => e.type === 'lore').forEach(e => {
      content += `### ${e.name}\n**Naturaleza**: ${e.status || 'Activo'}\n\n${e.summary}\n\n**Misterios Resueltos**: ${e.resolvedQuestions || 'Ninguno'}\n\n---\n\n`;
    });
    content += `## Manuscrito\n\n`;
    chapters.forEach(c => {
      content += `### Capítulo ${c.chapterNumber}: ${c.title}\n\n${c.content}\n\n`;
    });

    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novel.title}_enciclopedia.${format}`;
    a.click();
  };

  /**
   * Genera un manuscrito unificado empaquetado en formato compatible con Microsoft Word (.doc)
   * incluyendo portadas, fichas, tags de enciclopedia y capítulos formateados.
   */
  const handleExportDoc = () => {
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${novel.title}</title>
      <style>
        body { font-family: 'Verdana', sans-serif; line-height: 1.6; color: #1a1715; padding: 40pt; }
        h1 { text-align: center; font-size: 32pt; margin-bottom: 20pt; color: #9a7b4f; font-weight: bold; }
        .subtitle { text-align: center; font-size: 14pt; color: #6d5a4a; margin-bottom: 60pt; }
        h2 { font-size: 24pt; margin-top: 40pt; color: #2d2825; border-bottom: 3px solid #9a7b4f; padding-bottom: 10pt; page-break-before: always; }
        h3 { font-size: 18pt; margin-top: 25pt; color: #9a7b4f; }
        .chapter { margin-bottom: 40pt; }
        .content { white-space: pre-wrap; margin-top: 15pt; font-size: 12pt; text-align: justify; }
        .entity-card { background: #f9f7f4; border: 1px solid #e8e4df; padding: 20pt; margin-bottom: 20pt; border-radius: 10pt; }
        .tag { display: inline-block; background: #9a7b4f; color: white; padding: 2pt 8pt; border-radius: 5pt; font-size: 10pt; margin-right: 5pt; }
        .relation { font-style: italic; color: #6d5a4a; margin-top: 10pt; }
        .footer { text-align: center; font-size: 10pt; color: #999; margin-top: 80pt; border-top: 1px solid #eee; padding-top: 20pt; }
      </style>
      </head>
      <body>
        <h1>${novel.title}</h1>
        <p class="subtitle">Una obra original gestionada con Novel: El Asistente Literario de IA</p>
        
        <h2>Enciclopedia del Mundo</h2>
        
        <h3>Personajes</h3>
        ${entities.filter(e => e.type === 'character').map(e => `
          <div class="entity-card">
            <h4>${e.name}</h4>
            <p><strong>Estado:</strong> ${e.status || 'Activo'}</p>
            <div class="content">${e.summary}</div>
            ${e.openQuestions ? `<p><strong>Misterios:</strong> ${e.openQuestions}</p>` : ''}
            <div>${e.tags?.map(t => `<span class="tag">#${t}</span>`).join('') || ''}</div>
          </div>
        `).join('')}

        <h3>Lugares y Escenarios</h3>
        ${entities.filter(e => e.type === 'location').map(e => `
          <div class="entity-card">
            <h4>${e.name}</h4>
            <p><strong>Tipo:</strong> ${e.status || 'Territorio'}</p>
            <div class="content">${e.summary}</div>
            <div>${e.tags?.map(t => `<span class="tag">#${t}</span>`).join('') || ''}</div>
          </div>
        `).join('')}

        <h3>Detalles del Mundo y el Lore</h3>
        ${entities.filter(e => e.type === 'lore').map(e => `
          <div class="entity-card">
            <h4>${e.name}</h4>
            <p><strong>Naturaleza:</strong> ${e.status || 'Misterio'}</p>
            <div class="content">${e.summary}</div>
            ${e.openQuestions ? `<p><strong>Misterios Pendientes:</strong> ${e.openQuestions}</p>` : ''}
            ${e.resolvedQuestions ? `<p><strong>Misterios Resueltos:</strong> ${e.resolvedQuestions}</p>` : ''}
            <div>${e.tags?.map(t => `<span class="tag">#${t}</span>`).join('') || ''}</div>
          </div>
        `).join('')}

        <h3>Vínculos y Dinámicas</h3>
        <ul>
          ${relationships.map(r => `
            <li><strong>${r.sourceName}</strong> ${r.relationType} <strong>${r.targetName}</strong>: ${r.description}</li>
          `).join('')}
        </ul>

        <h2>Manuscrito Completo</h2>
        ${chapters.map(c => `
          <div class="chapter">
            <h3>Capítulo ${c.chapterNumber}: ${c.title}</h3>
            <div class="content">${c.content}</div>
          </div>
        `).join('')}
        
        <div class="footer">Documento generado por Novel. Fecha de exportación: ${new Date().toLocaleDateString()}</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novel.title.replace(/\s+/g, '_')}_completo.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };
  /**
     * Procesa la carga de una imagen de portada para la entidad editada
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

      {/* Sección Superior: Título de Novela, Estado y Botón de Exportar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/5 gap-4">
        <div className="flex gap-4">
          <button
            onClick={onBack}
            title="Volver atrás"
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-white leading-tight">{novel.title}</h2>
              {novel.status === 'Finalizada' && (
                <div className="px-3 py-1 bg-[#c2a884]/20 border border-[#c2a884]/30 text-[#c2a884] rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md">
                  <Flag className="w-3 h-3" />
                  Finalizada
                </div>
              )}
            </div>
            <p className="text-zinc-500 text-sm">Enciclopedia del Mundo Digital</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportDoc}
            className="flex items-center gap-2 px-4 py-2 bg-[#9a7b4f]/10 border border-[#9a7b4f]/20 text-[#9a7b4f] rounded-xl hover:bg-[#9a7b4f]/20 transition-all font-bold shadow-sm"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline text-xs uppercase tracking-widest">Exportar .doc</span>
          </button>
        </div>
      </div>

      {/* Barra de Pestañas Navegables */}
      <div className="flex gap-2 p-1 bg-[#1a1715] rounded-xl w-fit border border-white/5 overflow-x-auto max-w-full">
        {[
          { id: 'chapters', label: 'Capítulos', icon: BookOpen },
          { id: 'characters', label: 'Personajes', icon: Users },
          { id: 'locations', label: 'Lugares', icon: MapPin },
          { id: 'lore', label: 'Mundo', icon: Sparkles },
          { id: 'graph', label: 'Mapa Visual', icon: Share2 },
          { id: 'chat', label: 'Chat con Novel', icon: MessageSquare },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-[#9a7b4f] text-[#f3f0eb] shadow-lg shadow-[#9a7b4f]/20"
                : "text-[#6d5a4a] hover:text-[#e8e4df] hover:bg-white/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenedor Activo Dinámico (Tabs) */}
      <div className="grid grid-cols-1 gap-8">
        <AnimatePresence mode="wait">

          {/* PESTAÑA: CAPÍTULOS */}
          {activeTab === 'chapters' && (
            <motion.div
              key="chapters"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#e8e4df]">Manuscrito ({chapters.length})</h3>
                <div className="flex gap-3">
                  {isLocalMode && (
                    <button
                      onClick={handleSyncToDrive}
                      disabled={isSyncing}
                      className="flex items-center gap-2 px-4 py-2 bg-[#9a7b4f]/10 text-[#9a7b4f] border border-[#9a7b4f]/20 rounded-xl hover:bg-[#9a7b4f]/20 transition-all font-bold text-xs uppercase"
                    >
                      {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Drive'}</span>
                    </button>
                  )}
                  {novel.status !== 'Finalizada' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setIsPrologue(true);
                          setIsAddingChapter(true);
                        }}
                        disabled={!!isAnalyzing || chapters.some(c => c.chapterNumber === 0)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#9a7b4f]/20 text-[#9a7b4f] border border-[#9a7b4f]/30 rounded-lg hover:bg-[#9a7b4f]/30 transition-all font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        Escribir Prólogo
                      </button>
                      <button
                        onClick={() => setIsAddingChapter(true)}
                        disabled={!!isAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 bg-[#9a7b4f] text-[#f3f0eb] rounded-lg hover:bg-[#866a43] transition-colors shadow-lg shadow-[#9a7b4f]/20 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        Escribir Capítulo
                      </button>
                    </div>
                  )}
                  {novel.status === 'Finalizada' && (
                    <button
                      onClick={handleResumeNovel}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-[#c2a884] text-[#141210] rounded-lg hover:bg-[#b19574] transition-all font-bold shadow-lg shadow-[#c2a884]/20 text-xs uppercase tracking-widest"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Reanudar Escritura
                    </button>
                  )}
                </div>
              </div>

              {/* Formulario/Editor de Capítulo nuevo o existente */}
              {isAddingChapter && (
                <div className="bg-[#1a1715] p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6">
                  <input
                    type="text"
                    placeholder="Título del Capítulo"
                    value={newChapter.title}
                    onChange={e => setNewChapter({ ...newChapter, title: e.target.value })}
                    className="w-full text-3xl font-bold bg-transparent border-none focus:ring-0 placeholder:text-[#2d2825] text-[#e8e4df]"
                  />
                  <textarea
                    placeholder="Escribe tu historia aquí..."
                    title="Contenido del capítulo"
                    aria-label="Contenido del capítulo"
                    value={newChapter.content}
                    onChange={e => setNewChapter({ ...newChapter, content: e.target.value })}
                    spellCheck="false"
                    className="w-full h-[500px] bg-transparent border-none focus:ring-0 resize-none text-[#b0a89e] leading-relaxed font-serif text-xl"
                  />
                  <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                    <button
                      onClick={() => {
                        setIsAddingChapter(false);
                        setEditingChapterId(null);
                        setIsPrologue(false);
                        setNewChapter({ title: '', content: '' });
                      }}
                      className="px-6 py-2 text-[#6d5a4a] hover:text-[#e8e4df]"
                    >
                      Descartar
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={handleAddChapter}
                      className="px-8 py-2 bg-[#9a7b4f] text-[#f3f0eb] rounded-xl font-bold hover:bg-[#866a43] shadow-xl disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                    >
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {editingChapterId ? 'Guardar Cambios' : 'Guardar Capítulo'}
                    </button>
                  </div>
                </div>
              )}

              {/* Listado de Capítulos del Manuscrito */}
              <div className="space-y-4">
                {chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    onClick={() => !isAnalyzing && setReadingChapter(chapter)}
                    className="bg-[#1a1715] rounded-3xl border border-white/5 p-8 shadow-xl hover:border-[#c2a884]/30 hover:bg-[#1e1a18] transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-xs font-black text-[#e8e4df] uppercase tracking-[0.2em] mb-2 px-3 py-1 bg-white/10 rounded-full w-fit">Capítulo {chapter.chapterNumber}</div>
                        <h4 className="text-2xl font-bold text-[#e8e4df]">{chapter.title}</h4>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {novel.status !== 'Finalizada' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnalyze(chapter);
                              }}
                              disabled={!!isAnalyzing}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold",
                                isAnalyzing === chapter.id
                                  ? "bg-[#9a7b4f]/10 text-[#9a7b4f]"
                                  : "bg-white/5 text-[#6d5a4a] hover:text-[#e8e4df] hover:bg-white/10"
                              )}
                            >
                              {isAnalyzing === chapter.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                              {isAnalyzing === chapter.id ? 'Analizando...' : 'Analizar con Novel'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewChapter({ title: chapter.title, content: chapter.content });
                                setEditingChapterId(chapter.id);
                                setIsPrologue(chapter.chapterNumber === 0);
                                setIsAddingChapter(true);
                              }}
                              disabled={!!isAnalyzing}
                              className="p-3 bg-white/5 text-[#6d5a4a] hover:text-[#e8e4df] hover:bg-white/10 rounded-xl transition-all border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Editar capítulo"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteChapter(chapter.id);
                              }}
                              disabled={!!isAnalyzing}
                              className={cn(
                                "p-3 rounded-xl transition-all shadow-lg hover:scale-110 active:scale-95 z-20 flex items-center gap-2 font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed",
                                deletingChapterId === chapter.id ? "bg-[#9a7b4f] text-[#f3f0eb]" : "bg-red-900 text-white"
                              )}
                              title={deletingChapterId === chapter.id ? "Confirmar borrado" : "Borrar capítulo"}
                            >
                              <Trash2 className="w-5 h-5" />
                              {deletingChapterId === chapter.id && <span>¿Borrar?</span>}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-[#b0a89e] line-clamp-4 leading-relaxed mb-6 font-serif text-lg italic opacity-80 border-l-4 border-white/5 pl-6">
                      {chapter.content}
                    </div>
                    <div className="flex justify-center mb-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReadingChapter(chapter);
                        }}
                        className="flex items-center gap-2 px-8 py-3 bg-[#c2a884]/10 text-[#c2a884] rounded-2xl hover:bg-[#c2a884]/20 transition-all font-black text-xs border border-[#c2a884]/20 uppercase tracking-widest shadow-lg shadow-[#c2a884]/5 group-hover:scale-105 active:scale-95"
                      >
                        <BookOpen className="w-4 h-4" />
                        Leer Capítulo Completo
                      </button>
                    </div>
                    <div className="text-[10px] text-[#6d5a4a] flex justify-between items-center font-bold tracking-widest uppercase">
                      <span>
                        Análisis de Novel: {
                          isAnalyzing === chapter.id
                            ? 'En progreso'
                            : chapter.analyzed
                              ? 'Completado'
                              : 'No analizado'
                        }
                      </span>
                      <span>{formatDate(chapter.createdAt)}</span>
                    </div>
                  </div>
                ))}

                {novel.status !== 'Finalizada' && chapters.length > 0 && (
                  <div className="mt-12 flex justify-center">
                    <button
                      onClick={handleOpenFinalReport}
                      className="group flex flex-col items-center gap-4 p-8 bg-[#c2a884]/5 hover:bg-[#c2a884]/10 border border-[#c2a884]/20 rounded-[2.5rem] transition-all"
                    >
                      <div className="w-16 h-16 bg-[#c2a884] text-[#141210] rounded-full flex items-center justify-center shadow-lg shadow-[#c2a884]/20 group-hover:scale-110 transition-transform">
                        <Flag className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <h4 className="text-[#e8e4df] font-black uppercase tracking-widest">Finalizar Novela</h4>
                        <p className="text-[#6d5a4a] text-xs mt-1">Obtén la devolución de Novel y concluye tu obra</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* PESTAÑAS DE ENTIDADES (PERSONAJES, LUGARES, LORE) */}
          {(activeTab === 'characters' || activeTab === 'locations' || activeTab === 'lore') && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-4">
                <h3 className="text-xl font-bold text-[#e8e4df]">
                  {activeTab === 'characters' ? 'Personajes' : activeTab === 'locations' ? 'Lugares' : 'Detalles del Mundo'}
                  ({entities.filter(e => e.type === (activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore')).length})
                </h3>
                {novel.status !== 'Finalizada' && (
                  <button
                    onClick={() => handleManualAddEntity(activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore')}
                    disabled={!!isAnalyzing}
                    className="flex items-center gap-2 px-4 py-2 bg-[#9a7b4f]/10 text-[#9a7b4f] border border-[#9a7b4f]/20 rounded-xl hover:bg-[#9a7b4f]/20 transition-all font-bold text-xs uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Ficha</span>
                  </button>
                )}
              </div>

              {/* Grilla de Tarjetas de las Entidades */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {entities
                  .filter(e => e.type === (activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore'))
                  .map(entity => (
                    <motion.div
                      layoutId={entity.id}
                      key={entity.id}
                      className="bg-[#1a1715] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl hover:shadow-black/20 transition-all flex flex-col group relative"
                    >
                      <div
                        className="h-48 p-8 flex flex-col justify-end relative overflow-hidden"
                        style={{ backgroundColor: entity.headerColor || (entity.type === 'character' ? '#2d2825' : entity.type === 'location' ? '#1e2420' : '#2b1e2a') }}
                      >
                        {entity.imageUrl && <img src={entity.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="relative flex justify-between items-end">
                          <div>
                            <div className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 w-fit max-w-full break-words",
                              entity.status === 'Vivo' || entity.status === 'En guerra' ? "bg-[#f3f0eb] text-[#2d2825]" : "bg-[#2d2825] text-[#b0a89e]"
                            )}>
                              {entity.status || (entity.type === 'character' ? 'Estado desconocido' : entity.type === 'location' ? 'Territorio' : 'Entidad del Mundo')}
                            </div>
                            <h4 className="text-3xl font-black text-[#e8e4df] leading-tight break-words">{entity.name}</h4>
                          </div>
                          {novel.status !== 'Finalizada' && (
                            <button
                              onClick={() => setEditingEntity(entity)}
                              title="Editar ficha"
                              aria-label="Editar ficha"
                              disabled={!!isAnalyzing}
                              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all opacity-0 group-hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cuerpo de la Tarjeta */}
                      <div className="p-8 space-y-8 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {entity.tags?.map((tag, i) => (
                            <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-[#b0a89e] border border-white/5 break-words max-w-full">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[#6d5a4a]">
                            <Info className="w-4 h-4" />
                            <h5 className="text-[10px] font-black uppercase tracking-widest">Información</h5>
                          </div>
                          <div className="text-[#e8e4df] text-lg leading-relaxed font-serif prose prose-invert opacity-90 italic">
                            <ReactMarkdown>{entity.summary}</ReactMarkdown>
                          </div>
                        </div>

                        {entity.openQuestions && (
                          <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <div className="flex items-center gap-2 text-[#b0a89e] mb-3">
                              <Flag className="w-4 h-4 text-[#c2a884]" />
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-[#c2a884]/80">Misterios Pendientes</h5>
                            </div>
                            <div className="text-[#b0a89e]/80 text-sm italic font-serif whitespace-pre-wrap">
                              {entity.openQuestions}
                            </div>
                          </div>
                        )}

                        {entity.resolvedQuestions && (
                          <div className="bg-green-500/5 p-6 rounded-3xl border border-green-500/10">
                            <div className="flex items-center gap-2 text-[#b0a89e] mb-3">
                              <Sparkles className="w-4 h-4 text-green-500" />
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-green-500/80">Misterios Resueltos</h5>
                            </div>
                            <div className="text-[#b0a89e]/80 text-sm italic font-serif whitespace-pre-wrap opacity-60">
                              {entity.resolvedQuestions}
                            </div>
                          </div>
                        )}

                        {/* Relaciones/Vínculos de la Entidad */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[#6d5a4a]">
                            <Share2 className="w-4 h-4" />
                            <h5 className="text-[10px] font-black uppercase tracking-widest">Vínculos Conocidos</h5>
                          </div>
                          <div className="space-y-2">
                            {relationships
                              .filter(r => r.sourceId === entity.id || r.targetId === entity.id)
                              .map(rel => {
                                const otherName = rel.sourceId === entity.id ? rel.targetName : rel.sourceName;
                                return (
                                  <div key={rel.id} className="flex flex-col p-4 bg-white/5 rounded-2xl text-sm border border-white/5 group/rel">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-black text-[#e8e4df] break-words">{rel.relationType}</span>
                                      <span className="text-[#6d5a4a]">con</span>
                                      <span className="font-bold text-[#e8e4df] group-hover/rel:text-[#b0a89e] transition-colors break-words">{otherName}</span>
                                    </div>
                                    <span className="text-xs text-[#b0a89e] mt-2 italic font-serif opacity-70">{rel.description}</span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Fechas e Información sobre aparición */}
                        <div className="pt-6 border-t border-white/5 text-[10px] text-[#6d5a4a] flex flex-col gap-2 font-bold tracking-widest uppercase">
                          <div className="flex justify-between">
                            <span>Primera aparición:</span>
                            <span className="text-[#e8e4df]">{entity.firstUpdatedChapterTitle || 'Prólogo'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Última aparición:</span>
                            <span className="text-[#e8e4df]">{entity.lastUpdatedChapterTitle || entity.firstUpdatedChapterTitle || 'Única'}</span>
                          </div>
                          <div className="flex justify-end pt-2 opacity-30">
                            {formatDate(entity.updatedAt)}
                          </div>
                          {novel.status === 'En Desarrollo' && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteEntity(entity.id);
                              }}
                              disabled={!!isAnalyzing}
                              className={cn(
                                "mt-4 w-full py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed",
                                deletingEntityId === entity.id ? "bg-[#9a7b4f] text-[#f3f0eb]" : "bg-red-900 text-white"
                              )}
                            >
                              {deletingEntityId === entity.id ? (
                                <>
                                  <X className="w-4 h-4" />
                                  ¿Confirmar?
                                </>
                              ) : (
                                "Eliminar del Mundo"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* PESTAÑA: GRAPH (MAPA VISUAL) */}
          {activeTab === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RelationshipGraph entities={entities} relationships={relationships} />
            </motion.div>
          )}

          {/* PESTAÑA: CHAT CON NOVEL */}
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <WorldChat entities={entities} chapters={chapters} novelTitle={novel.title} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ==========================================
          MODALES DE LA APLICACIÓN (MODALS)
          ========================================== */}

      {/* MODAL: REPORTE FINAL DE OBRA */}
      <AnimatePresence>
        {showFinalReportModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGeneratingReport && setShowFinalReportModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative w-full max-w-5xl bg-[#141210] rounded-[3rem] border border-[#c2a884]/20 shadow-[0_0_100px_rgba(194,168,132,0.1)] overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 bg-[#c2a884]/10 border-b border-[#c2a884]/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#c2a884] rounded-2xl shadow-lg shadow-[#c2a884]/20">
                    <Flag className="w-8 h-8 text-[#141210]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[#e8e4df] tracking-tight">Reporte Final de Obra</h3>
                    <p className="text-[#c2a884] text-xs font-bold uppercase tracking-widest">Opinión de Novel</p>
                  </div>
                </div>
                {!isGeneratingReport && (
                  <button onClick={() => setShowFinalReportModal(false)} title="Cerrar reporte" className="p-2 hover:bg-white/5 rounded-full text-[#6d5a4a]"><X /></button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {isGeneratingReport ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-6 py-20">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 text-[#c2a884] animate-spin" />
                      <Sparkles className="w-6 h-6 text-[#c2a884] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-[#e8e4df] animate-pulse">Novel está analizando tu historia...</p>
                      <p className="text-[#6d5a4a] text-sm mt-2">Cruzando destinos, cerrando arcos y evaluando tu estilo.</p>
                    </div>
                  </div>
                ) : finalReport ? (
                  <div className="space-y-12 pb-12">
                    {/* Resumen de Personajes */}
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-[#c2a884]" />
                        <h4 className="text-lg font-black text-[#e8e4df] uppercase tracking-[0.2em] border-b-2 border-[#c2a884]/20 pb-2 flex-1">Destino de los Personajes</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {finalReport.characterSummaries.map((char, i) => (
                          <div key={i} className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-3">
                            <h5 className="text-[#c2a884] font-bold text-xl">{char.name}</h5>
                            <div>
                              <p className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest mb-1">Resultado Final</p>
                              <p className="text-[#e8e4df] text-sm leading-relaxed">{char.outcome}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest mb-1">Evolución del Arco</p>
                              <p className="text-[#b0a89e] text-xs font-serif italic italic">{char.evolution}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Resumen de Conflictos Geográficos */}
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-[#c2a884]" />
                        <h4 className="text-lg font-black text-[#e8e4df] uppercase tracking-[0.2em] border-b-2 border-[#c2a884]/20 pb-2 flex-1">Estado del Mundo</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {finalReport.locationSummaries.map((loc, i) => (
                          <div key={i} className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-3">
                            <div className="flex justify-between items-start gap-4">
                              <h5 className="text-[#c2a884] font-bold text-xl leading-tight flex-1 break-words">{loc.name}</h5>
                              <span className="px-2 py-1 bg-[#c2a884]/20 text-[#c2a884] rounded text-[10px] font-black uppercase tracking-widest break-words max-w-[50%] text-right">{loc.state}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                loc.conflictStatus.toLowerCase().includes('resuelto') ? "bg-green-500" : "bg-red-500"
                              )} />
                              <p className="text-xs font-bold text-[#e8e4df]">{loc.conflictStatus}</p>
                            </div>
                            <p className="text-[#b0a89e] text-sm italic font-serif">{loc.resolution}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Feedback Global y Perfil del Escritor */}
                    <section className="bg-[#c2a884]/5 p-10 rounded-[3rem] border border-[#c2a884]/10 space-y-8">
                      <div className="text-center space-y-2">
                        <Palette className="w-12 h-12 text-[#c2a884] mx-auto mb-4" />
                        <h4 className="text-3xl font-black text-[#e8e4df]">Tu Perfil de Escritor</h4>
                        <div className="inline-block px-6 py-2 bg-[#c2a884] text-[#141210] rounded-full font-black uppercase tracking-widest text-lg shadow-xl shadow-[#c2a884]/20">
                          {finalReport.writerFeedback.profile}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                        <div className="space-y-6">
                          <div>
                            <h5 className="text-[10px] font-black text-[#c2a884] uppercase tracking-[0.2em] mb-3">Evolución de Estilo</h5>
                            <p className="text-[#e8e4df] leading-relaxed italic font-serif text-lg">{finalReport.writerFeedback.evolution}</p>
                          </div>
                          <div>
                            <h5 className="text-[10px] font-black text-[#c2a884] uppercase tracking-[0.2em] mb-3">Análisis Técnico</h5>
                            <p className="text-[#b0a89e] leading-relaxed text-sm">{finalReport.writerFeedback.styleAnalysis}</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-black/20 p-6 rounded-3xl border border-white/5">
                            <h5 className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" /> Fortalezas Detectadas
                            </h5>
                            <ul className="space-y-3">
                              {finalReport.writerFeedback.strengths.map((s, i) => (
                                <li key={i} className="flex gap-3 text-sm text-[#e8e4df]">
                                  <span className="text-green-500">✦</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-black/20 p-6 rounded-3xl border border-white/5">
                            <h5 className="text-[10px] font-black text-[#c2a884] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <RefreshCw className="w-4 h-4" /> Áreas de Crecimiento
                            </h5>
                            <ul className="space-y-3">
                              {finalReport.writerFeedback.areasForImprovement.map((s, i) => (
                                <li key={i} className="flex gap-3 text-sm text-[#e8e4df]">
                                  <span className="text-[#c2a884]">✦</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </section>

                    <div className="flex flex-col items-center gap-4 py-8">
                      <p className="text-[#6d5a4a] text-sm text-center max-w-md">
                        Al confirmar, la novela quedará bloqueada para edición. Siempre podrás reanudarla si decides expandir el universo.
                      </p>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setShowFinalReportModal(false)}
                          className="px-8 py-4 text-[#6d5a4a] font-bold hover:text-[#e8e4df] transition-colors"
                        >
                          Continuar Escribiendo
                        </button>
                        <button
                          onClick={handleConfirmFinalize}
                          disabled={isSaving}
                          className="px-12 py-4 bg-[#c2a884] text-[#141210] rounded-2xl font-black shadow-2xl shadow-[#c2a884]/20 hover:scale-105 transition-all text-lg active:scale-95 disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="animate-spin" /> : 'CONFIRMAR FINALIZAR'}
                        </button>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReadingChapter(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative w-full max-w-4xl bg-[#141210] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-[#c2a884] uppercase tracking-[0.2em] mb-1">Capítulo {readingChapter.chapterNumber}</div>
                  <h3 className="text-2xl font-bold text-[#e8e4df]">{readingChapter.title}</h3>
                </div>
                <button
                  onClick={() => setReadingChapter(null)}
                  title="Cerrar lectura"
                  aria-label="Cerrar lectura"
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[#6d5a4a] hover:text-[#e8e4df] transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-2xl mx-auto">
                  <div className="text-[#b0a89e] text-xl leading-[2] font-serif whitespace-pre-wrap selection:bg-[#c2a884]/30">
                    {readingChapter.content}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/5 flex justify-center">
                <button
                  onClick={() => setReadingChapter(null)}
                  className="px-8 py-3 bg-[#c2a884] text-[#141210] rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all"
                >
                  Cerrar Lectura
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITOR Y DETALLE DE LA ENTIDAD */}
      <AnimatePresence>
        {editingEntity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingEntity(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#1a1715] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div
                className="h-32 p-8 flex items-center justify-between"
                style={{ backgroundColor: editingEntity.headerColor || '#2d2825' }}
              >
                <h3 className="text-2xl font-black text-[#f3f0eb]">Editar Tarjeta</h3>
                <button onClick={() => setEditingEntity(null)} title="Cerrar modal" aria-label="Cerrar modal" className="p-2 bg-black/20 rounded-full text-white hover:bg-black/40 transition-colors"><X /></button>
              </div>

              <form onSubmit={handleUpdateEntity} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest">Nombre</label>
                    <input
                      type="text"
                      value={editingEntity.name}
                      title="Nombre de la entidad"
                      aria-label="Nombre de la entidad"
                      onChange={e => setEditingEntity({ ...editingEntity, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] focus:outline-none focus:ring-2 focus:ring-[#b45309]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest">Estado</label>
                    <input
                      type="text"
                      placeholder="Vivo, Muerto, En guerra..."
                      value={editingEntity.status || ''}
                      onChange={e => setEditingEntity({ ...editingEntity, status: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] focus:outline-none focus:ring-2 focus:ring-[#b45309]/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest text-[#c2a884]/80">Misterios Pendientes</label>
                    <textarea
                      placeholder="Misterios, secretos o preguntas sin resolver..."
                      title="Misterios pendientes"
                      aria-label="Misterios pendientes"
                      value={editingEntity.openQuestions || ''}
                      onChange={e => setEditingEntity({ ...editingEntity, openQuestions: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] h-24 focus:outline-none focus:ring-2 focus:ring-[#b45309]/20 font-serif"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest text-green-500/80">Misterios Resueltos</label>
                    <textarea
                      placeholder="Misterios que ya tienen respuesta..."
                      title="Misterios resueltos"
                      aria-label="Misterios resueltos"
                      value={editingEntity.resolvedQuestions || ''}
                      onChange={e => setEditingEntity({ ...editingEntity, resolvedQuestions: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] h-24 focus:outline-none focus:ring-2 focus:ring-[#b45309]/20 font-serif"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest">Resumen (Enciclopedia)</label>
                  <textarea
                    value={editingEntity.summary}
                    title="Resumen"
                    aria-label="Resumen de la enciclopedia"
                    placeholder="Escribe un resumen aquí..."
                    onChange={e => setEditingEntity({ ...editingEntity, summary: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] h-32 focus:outline-none focus:ring-2 focus:ring-[#b45309]/20 font-serif"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest">Etiquetas (separadas por coma)</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                    <Tag className="w-4 h-4 text-[#6d5a4a]" />
                    <input
                      type="text"
                      placeholder={editingEntity.type === 'character' ? "noble, guerrero, secreto..." : editingEntity.type === 'location' ? "lejano, peligroso, místico..." : "criatura, dios, objeto, raza..."}
                      value={editingEntity.tags?.join(', ') || ''}
                      onChange={e => setEditingEntity({ ...editingEntity, tags: e.target.value.split(',').map(s => s.trim()) })}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-[#e8e4df] placeholder:text-[#6d5a4a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest">Color de Cabecera</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['#2d2825', '#1e2420', '#2b1e2a', '#9a7b4f', '#4f7a9a', '#7a4f9a', '#9a4f4f', '#4f9a7a', '#1a1715'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingEntity({ ...editingEntity, headerColor: c })}
                          title={`Seleccionar color ${c}`}
                          aria-label={`Seleccionar color ${c}`}
                          className={cn(
                            "w-6 h-6 rounded-md border transition-all active:scale-90",
                            (editingEntity.headerColor || '#2d2825') === c ? "border-white scale-110 shadow-lg" : "border-white/10 hover:border-white/30"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          title="Color de cabecera"
                          aria-label="Seleccionar color de cabecera"
                          value={editingEntity.headerColor || '#2d2825'}
                          onChange={e => setEditingEntity({ ...editingEntity, headerColor: e.target.value })}
                          className="w-6 h-6 bg-transparent border-none cursor-pointer opacity-0 absolute inset-0 z-10"
                        />
                        <div className="w-6 h-6 rounded-md border border-white/20 flex items-center justify-center bg-white/5">
                          <Palette className="w-3 h-3 text-[#6d5a4a]" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest">Imagen de Portada</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] text-sm text-center cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        {editingEntity.imageUrl ? 'Cambiar Foto' : 'Subir Foto'}
                      </label>
                      {editingEntity.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditingEntity({ ...editingEntity, imageUrl: '' })}
                          className="px-4 py-2 bg-red-900/10 text-red-400 rounded-xl border border-red-500/10 text-sm"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest">Vinculaciones Directas</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingRel(!isAddingRel)}
                      className="text-[#9a7b4f] text-[10px] font-black uppercase tracking-widest hover:underline"
                    >
                      {isAddingRel ? 'Cancelar' : '+ Añadir Vínculo'}
                    </button>
                  </div>

                  {isAddingRel && (
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={newRelTargetId}
                          onChange={e => setNewRelTargetId(e.target.value)}
                          title="Seleccionar entidad a vincular"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] text-xs focus:ring-0"
                        >
                          <option value="">Vincular con...</option>
                          {entities
                            .filter(e => e.id !== editingEntity.id)
                            .map(e => <option key={e.id} value={e.id}>{e.name} ({e.type})</option>)}
                        </select>
                        <input
                          type="text"
                          placeholder="Tipo: Aliado, Pertenece a, Visto en..."
                          value={newRelType}
                          onChange={e => setNewRelType(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[#e8e4df] text-xs focus:ring-0"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddRelationship}
                        disabled={!newRelTargetId || !newRelType}
                        className="w-full py-2 bg-[#9a7b4f]/20 text-[#9a7b4f] rounded-xl font-bold text-xs uppercase hover:bg-[#9a7b4f]/30 disabled:opacity-30"
                      >
                        Crear Vinculación
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {relationships
                      .filter(r => r.sourceId === editingEntity.id || r.targetId === editingEntity.id)
                      .map(rel => {
                        const isSource = rel.sourceId === editingEntity.id;
                        const otherName = isSource ? rel.targetName : rel.sourceName;
                        const isPending = rel.isPending;

                        return (
                          <div
                            key={rel.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all",
                              isPending
                                ? "bg-[#c2a884]/5 border-[#c2a884]/20"
                                : "bg-white/[0.02] border-white/5"
                            )}
                          >
                            <div className="flex-1 flex items-center gap-3">
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isPending ? "bg-[#c2a884] animate-pulse" : "bg-[#9a7b4f]"
                              )} />
                              <div className="flex flex-col">
                                <input
                                  type="text"
                                  value={rel.relationType}
                                  title="Tipo de relación"
                                  onChange={async (e) => {
                                    const newValue = e.target.value;
                                    await storageService.updateRelationship(!!isLocalMode, novel.id, rel.id, {
                                      relationType: newValue,
                                      isUserDefined: true,
                                      isPending: false
                                    });

                                  }}
                                  className="bg-transparent border-none p-0 text-[#e8e4df] text-xs font-bold focus:ring-0 w-24 h-4"
                                />
                                <span className="text-[#6d5a4a] text-[10px] uppercase font-black tracking-widest leading-none">{otherName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await storageService.updateRelationship(!!isLocalMode, novel.id, rel.id, {
                                      isPending: false,
                                      isUserDefined: true
                                    });
                                  }}
                                  className="px-2 py-1 bg-[#c2a884]/20 text-[#c2a884] text-[10px] font-black uppercase rounded hover:bg-[#c2a884]/30"
                                >
                                  Confirmar
                                </button>
                              )}
                              <button
                                type="button"
                                title="Eliminar relación"
                                onClick={() => handleDeleteRelationship(rel.id)}
                                className="p-1.5 text-red-900/40 hover:text-red-900 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-[#6d5a4a] uppercase tracking-widest block">Mover Sección (Fijar Tipo)</label>
                  <div className="flex gap-2">
                    {[
                      { type: 'character', label: 'Personajes', icon: Users },
                      { type: 'location', label: 'Lugares', icon: MapPin },
                      { type: 'lore', label: 'Mundo', icon: Sparkles }
                    ].map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setEditingEntity({ ...editingEntity, type: opt.type as any, isTypeLocked: true })}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border transition-all font-bold text-[10px] uppercase",
                          editingEntity.type === opt.type
                            ? "bg-[#9a7b4f] border-[#9a7b4f] text-[#f3f0eb]"
                            : "bg-white/5 border-white/10 text-[#6d5a4a] hover:bg-white/10"
                        )}
                      >
                        <opt.icon className="w-3 h-3" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {editingEntity.isTypeLocked && (
                    <p className="text-[9px] text-[#c2a884]/60 font-medium italic">
                      * El tipo ha sido fijado manualmente y no cambiará automáticamente.
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Eliminar esta ficha permanentemente?')) {
                        handleDeleteEntity(editingEntity.id);
                        setEditingEntity(null);
                      }
                    }}
                    className="text-red-900 text-[10px] font-black uppercase tracking-widest hover:text-red-700 transition-colors"
                  >
                    Eliminar del Mundo
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingEntity(null)}
                      className="px-6 py-2 text-[#6d5a4a] hover:text-[#e8e4df] transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 px-8 py-2 bg-[#9a7b4f] text-[#f3f0eb] rounded-xl font-bold hover:bg-[#866a43] shadow-xl disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Guardar
                    </button>
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
