import { Plus, BookOpen, Trash2, Loader2, RefreshCw, Edit2, Sparkles, ArrowUp, ArrowDown, Flag, Database } from 'lucide-react';
import { Chapter, Novel } from '../types';
import { cn, formatDate } from '../lib/utils';

// ==========================================
// INTERFACES & PROPS
// ==========================================
interface ChapterTabProps {
  activeChapters: Chapter[];
  novel: Novel;
  isLocalMode: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  isAddingChapter: boolean;
  isAnalyzing: string | null;
  newChapter: { title: string; content: string };
  isPrologue: boolean;
  editingChapterId: string | null;
  deletingChapterId: string | null;
  setIsAddingChapter: (v: boolean) => void;
  setNewChapter: (v: { title: string; content: string }) => void;
  setIsPrologue: (v: boolean) => void;
  setEditingChapterId: (v: string | null) => void;
  setReadingChapter: (v: Chapter | null) => void;
  handleSyncToDrive: () => Promise<void>;
  handleMoveChapter: (index: number, direction: 'up' | 'down') => Promise<void>;
  handleAnalyze: (chapter: Chapter) => Promise<void>;
  handleDeleteChapter: (id: string) => Promise<void>;
  handleAddChapter: (e: React.FormEvent) => Promise<void>;
  handleOpenFinalReport: () => Promise<void>;
  handleResumeNovel: () => void | Promise<void>;
}

export default function ChapterTab({
  activeChapters,
  novel,
  isLocalMode,
  isSaving,
  isSyncing,
  isAddingChapter,
  isAnalyzing,
  newChapter,
  isPrologue,
  editingChapterId,
  deletingChapterId,
  setIsAddingChapter,
  setNewChapter,
  setIsPrologue,
  setEditingChapterId,
  setReadingChapter,
  handleSyncToDrive,
  handleMoveChapter,
  handleAnalyze,
  handleDeleteChapter,
  handleAddChapter,
  handleOpenFinalReport,
  handleResumeNovel,
}: ChapterTabProps) {
  return (
    <div className="space-y-6">

      {/* Cabecera de la sección de capítulos y controles de barra */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-brand-text">Manuscrito ({activeChapters.length})</h3>
        <div className="flex gap-3">

          {/* Botón de Sincronización a Drive */}
          {isLocalMode && (
            <button
              onClick={handleSyncToDrive}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-brand-card border border-brand-border text-brand-muted rounded-xl hover:bg-brand-primary hover:border-brand-primary hover:text-zinc-950 transition-all font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Drive'}</span>
            </button>
          )}

          {novel.status !== 'Finalizada' && (
            <div className="flex gap-2">
              {/* Botones de creación manual */}
              <button
                onClick={() => {
                  setIsPrologue(true);
                  setIsAddingChapter(true);
                }}
                disabled={!!isAnalyzing || activeChapters.some(c => c.chapterNumber === 0)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-card border border-brand-border text-brand-muted rounded-lg hover:bg-brand-primary hover:border-brand-primary hover:text-zinc-950 transition-all font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Escribir Prólogo
              </button>
              <button
                onClick={() => setIsAddingChapter(true)}
                disabled={!!isAnalyzing}
                className="flex items-center gap-2 px-4 py-2 bg-brand-card border border-brand-border text-brand-muted rounded-lg hover:bg-brand-primary hover:border-brand-primary hover:text-zinc-950 transition-colors shadow-sm hover:shadow-lg hover:shadow-brand-primary/20 font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Escribir Capítulo
              </button>
            </div>
          )}

          {/* Botón de Reanudar */}
          {novel.status === 'Finalizada' && (
            <button
              onClick={handleResumeNovel}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-card border border-brand-border text-brand-muted rounded-lg hover:bg-brand-primary hover:border-brand-primary hover:text-zinc-950 transition-all font-bold shadow-sm hover:shadow-lg text-xs uppercase tracking-widest cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Reanudar Escritura
            </button>
          )}
        </div>
      </div>

      {/* Editor de Capítulo (Modo de creación/edición) */}
      {isAddingChapter && (
        <form onSubmit={handleAddChapter} className="bg-brand-card p-8 rounded-3xl border border-brand-border shadow-2xl space-y-6">
          <input
            type="text"
            placeholder="Título del Capítulo"
            value={newChapter.title}
            onChange={e => setNewChapter({ ...newChapter, title: e.target.value })}
            className="w-full text-3xl font-bold bg-transparent border-none focus:ring-0 placeholder:text-brand-muted/50 text-brand-text"
          />
          <textarea
            placeholder="Escribe tu historia aquí..."
            title="Contenido del capítulo"
            aria-label="Contenido del capítulo"
            value={newChapter.content}
            onChange={e => setNewChapter({ ...newChapter, content: e.target.value })}
            spellCheck="false"
            className="w-full h-[500px] bg-transparent border-none focus:ring-0 resize-none text-brand-muted leading-relaxed font-serif text-xl"
          />
          <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
            <button
              type="button"
              onClick={() => {
                setIsAddingChapter(false);
                setEditingChapterId(null);
                setIsPrologue(false);
                setNewChapter({ title: '', content: '' });
              }}
              className="px-6 py-2 text-brand-muted hover:text-brand-text cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-2 bg-brand-bg text-brand-muted border border-brand-border rounded-xl font-bold hover:bg-brand-primary hover:text-zinc-950 hover:border-brand-primary shadow-sm hover:shadow-xl disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingChapterId ? 'Guardar Cambios' : 'Guardar Progreso'}
            </button>
          </div>
        </form>
      )}

      {/* Listado de Capítulos del Manuscrito */}
      <div className="space-y-4">
        {activeChapters.map((chapter, index) => {
          const hasPrologue = activeChapters.length > 0 && activeChapters[0].chapterNumber === 0;
          const isThisPrologue = chapter.chapterNumber === 0;
          const displayNum = hasPrologue ? index : index + 1;
          const displayLabel = isThisPrologue ? 'Prólogo' : `Capítulo ${displayNum}`;

          return (
            <div
              key={chapter.id}
              onClick={() => !isAnalyzing && setReadingChapter(chapter)}
              className="bg-brand-card rounded-3xl border border-brand-border p-8 shadow-xl hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-all group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs font-black text-brand-primary uppercase tracking-[0.2em] mb-2 px-3 py-1 bg-brand-primary/10 rounded-full w-fit">
                    {displayLabel}
                  </div>
                  <h4 className="text-2xl font-bold text-brand-text">{chapter.title}</h4>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {novel.status !== 'Finalizada' && (
                    <>
                      {/* Botón de Analizar (Opaco -> Brilla en Oro) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnalyze(chapter);
                        }}
                        disabled={!!isAnalyzing}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer border shadow-sm",
                          isAnalyzing === chapter.id
                            ? "bg-brand-primary/20 text-brand-primary border-brand-primary/30"
                            : "bg-brand-bg text-brand-muted border-brand-border hover:bg-brand-primary hover:text-zinc-950 hover:border-brand-primary hover:shadow-md hover:shadow-brand-primary/20"
                        )}
                      >
                        {isAnalyzing === chapter.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {isAnalyzing === chapter.id ? 'Analizando...' : 'Analizar con Novel'}
                      </button>

                      {/* Botón de Editar Capítulo */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewChapter({ title: chapter.title, content: chapter.content });
                          setEditingChapterId(chapter.id);
                          setIsPrologue(isThisPrologue);
                          setIsAddingChapter(true);
                        }}
                        disabled={!!isAnalyzing}
                        className="p-3 bg-brand-bg text-brand-muted hover:bg-brand-primary hover:text-zinc-950 hover:border-brand-primary rounded-xl transition-all border border-brand-border cursor-pointer shadow-sm disabled:opacity-30"
                        title="Editar capítulo"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>

                      {/* Botones de Reordenamiento (Flechas) */}
                      {index > (activeChapters.some(c => c.chapterNumber === 0) ? 1 : 0) && chapter.chapterNumber !== 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveChapter(index, 'up'); }}
                          disabled={!!isAnalyzing || isSaving}
                          className="p-3 bg-brand-bg text-brand-muted hover:bg-brand-primary hover:text-zinc-950 hover:border-brand-primary rounded-xl transition-all border border-brand-border cursor-pointer shadow-sm disabled:opacity-30"
                          title="Mover arriba"
                        >
                          <ArrowUp className="w-5 h-5" />
                        </button>
                      )}
                      {index < activeChapters.length - 1 && chapter.chapterNumber !== 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveChapter(index, 'down'); }}
                          disabled={!!isAnalyzing || isSaving}
                          className="p-3 bg-brand-bg text-brand-muted hover:bg-brand-primary hover:text-zinc-950 hover:border-brand-primary rounded-xl transition-all border border-brand-border cursor-pointer shadow-sm disabled:opacity-30"
                          title="Mover abajo"
                        >
                          <ArrowDown className="w-5 h-5" />
                        </button>
                      )}

                      {/* Botón de Borrar (Opaco -> Brilla en Rojo) */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteChapter(chapter.id);
                        }}
                        disabled={!!isAnalyzing}
                        className={cn(
                          "p-3 rounded-xl transition-all shadow-sm z-20 flex items-center gap-2 font-bold text-xs disabled:opacity-30 cursor-pointer border",
                          deletingChapterId === chapter.id
                            ? "bg-brand-error text-white border-brand-error hover:scale-110 active:scale-95"
                            : "bg-brand-bg text-brand-muted border-brand-border hover:bg-brand-error hover:text-white hover:border-brand-error hover:scale-110 active:scale-95"
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
              <div className="text-brand-muted line-clamp-4 leading-relaxed mb-6 font-serif text-lg italic opacity-80 border-l-4 border-brand-border pl-6">
                {chapter.content}
              </div>
              <div className="flex justify-center mb-6">
                {/* Botón de Leer Capítulo Completo */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReadingChapter(chapter);
                  }}
                  className="flex items-center gap-2 px-8 py-3 bg-brand-bg text-brand-muted border border-brand-border hover:bg-brand-secondary hover:border-brand-secondary hover:text-zinc-950 rounded-2xl transition-all font-black text-xs uppercase tracking-widest shadow-sm hover:shadow-lg hover:shadow-brand-secondary/20 active:scale-95 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  Leer Capítulo Completo
                </button>
              </div>
              <div className="text-[10px] text-brand-muted flex justify-between items-center font-bold tracking-widest uppercase">
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
          );

        })}

        {/* Sección del Reporte Final de Obra */}
        {novel.status !== 'Finalizada' && activeChapters.length > 0 && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={handleOpenFinalReport}
              className="group flex flex-col items-center gap-4 p-10 bg-brand-card border border-brand-border text-brand-text rounded-[2.5rem] transition-all hover:bg-gradient-to-br hover:from-brand-primary hover:to-brand-secondary hover:text-zinc-950 hover:border-brand-primary/30 hover:scale-105 hover:shadow-2xl hover:shadow-brand-primary/20 cursor-pointer"
            >
              <div className="w-16 h-16 bg-brand-bg text-brand-primary rounded-full flex items-center justify-center shadow-lg border border-brand-border group-hover:border-transparent group-hover:bg-zinc-950 group-hover:text-brand-primary group-hover:rotate-12 transition-all">
                <Flag className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h4 className="text-brand-text font-black uppercase tracking-widest text-lg group-hover:text-zinc-950 transition-colors">Finalizar Novela</h4>
                <p className="text-brand-muted text-xs font-bold mt-1 group-hover:text-zinc-900/70 transition-colors">¡Felicitaciones! Celebra la culminación de tu obra y obtén tu informe</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}