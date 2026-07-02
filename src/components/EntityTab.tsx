import { useState } from 'react';
import { Plus, Info, Flag, Edit2, Trash2, Search, Filter, Sparkles, Share2 } from 'lucide-react';
import { WorldEntity, Relationship, EntityType, Novel } from '../types';
import ReactMarkdown from 'react-markdown';
import { formatDate, cn } from '../lib/utils';
import { useDialog } from '../components/DialogContext';

// ==========================================
// INTERFACES & PROPS
// ==========================================
interface EntityTabProps {
  entities: WorldEntity[];
  relationships: Relationship[];
  novel: Novel;
  activeTab: 'characters' | 'locations' | 'lore';
  isAnalyzing: string | null;
  deletingEntityId: string | null;
  setEditingEntity: (e: WorldEntity | null) => void;
  handleManualAddEntity: (type: EntityType) => void | Promise<void>;
  handleTrashEntity: (id: string) => void | Promise<void>;
}

export default function EntityTab({
  entities, relationships, novel, activeTab, isAnalyzing, setEditingEntity, handleManualAddEntity, handleTrashEntity,
}: EntityTabProps) {

  const { showConfirm } = useDialog();

  // ESTADOS DE FILTRO Y BÚSQUEDA
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  // Obtener estados únicos para el filtro desplegable
  const uniqueStatuses = Array.from(new Set(entities.filter(e => e.type === (activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore')).map(e => e.status || ''))).filter(Boolean);

  // Filtrado compuesto (Por Tab, Búsqueda y Estado)
  const filteredEntities = entities.filter(e => {
    if (e.type !== (activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore')) return false;
    if (statusFilter !== 'Todos' && e.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return e.name.toLowerCase().includes(term) || e.tags?.some(t => t.toLowerCase().includes(term)) || e.summary.toLowerCase().includes(term);
    }
    return true;
  });

  // Altura dinámica: si hay fotos, las tarjetas son más altas
  const hasAnyImage = filteredEntities.some(e => e.imageUrl && e.imageUrl.trim() !== '');

  return (
    <div className="space-y-6">

      {/* Cabecera y Controles */}
      <div className="flex flex-col md:flex-row justify-between md:items-center px-4 gap-4">
        <h3 className="text-xl font-bold text-brand-text">
          {activeTab === 'characters' ? 'Personajes' : activeTab === 'locations' ? 'Lugares' : 'Detalles del Mundo'} ({filteredEntities.length})
        </h3>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* BUSCADOR */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-brand-muted absolute left-3" />
            <input
              type="text"
              placeholder="Buscar por nombre, etiqueta..."
              title="Buscar"
              aria-label="Buscar fichas"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-brand-card border border-brand-border text-brand-text rounded-xl text-xs focus:ring-2 focus:ring-brand-primary/50 outline-none w-full sm:w-64 transition-all"
            />
          </div>

          {/* FILTRO DE ESTADO */}
          <div className="relative flex items-center bg-brand-card border border-brand-border rounded-xl px-3 py-2 cursor-pointer">
            <Filter className="w-4 h-4 text-brand-muted mr-2" />
            <select
              value={statusFilter}
              title="Filtrar por estado"
              aria-label="Filtrar por estado"
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-brand-text text-xs outline-none cursor-pointer pr-4 appearance-none"
            >
              <option value="Todos" className="bg-brand-bg text-brand-text">Todos los estados</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status} className="bg-brand-bg text-brand-text">{status}</option>
              ))}
            </select>
          </div>

          {novel.status !== 'Finalizada' && (
            <button
              onClick={() => handleManualAddEntity(activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore')}
              disabled={!!isAnalyzing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-xl hover:bg-brand-primary/20 transition-all font-bold text-xs uppercase disabled:opacity-30 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> <span>Crear</span>
            </button>
          )}
        </div>
      </div>

      {filteredEntities.length === 0 ? (
        <div className="bg-brand-card rounded-[2.5rem] p-16 text-center border border-brand-border shadow-md">
          <Info className="w-12 h-12 text-brand-muted mx-auto mb-4 opacity-50" />
          <p className="text-brand-text font-serif text-lg">No hay fichas que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEntities.map(entity => {
            // Evaluamos si el usuario eligió "transparente" para quitar los filtros
            const isTransparent = entity.headerColor === 'transparent';

            return (
              <div key={entity.id} className={cn("bg-brand-card rounded-[2.5rem] border border-brand-border overflow-hidden shadow-2xl hover:shadow-brand-primary/5 transition-all flex flex-col group relative", hasAnyImage ? "h-[1300px]" : "h-[950px]")}>

                {/* 1. CABECERA DE LA TARJETA */}
                <div
                  className={cn("p-8 flex flex-col justify-end relative overflow-hidden shrink-0 transition-all duration-300", hasAnyImage ? "h-80" : "h-48", isTransparent ? "bg-brand-bg" : "")}
                  style={{ backgroundColor: isTransparent ? undefined : (entity.headerColor || 'var(--bg-card)') }}
                >
                  {entity.imageUrl && (
                    <img
                      src={entity.imageUrl}
                      alt={`Imagen de ${entity.name}`}
                      className={cn("absolute inset-0 w-full h-full object-cover transition-all duration-300", isTransparent ? "opacity-100 mix-blend-normal" : "opacity-50 mix-blend-overlay")}
                    />
                  )}
                  {/* Degradado oscuro protector para garantizar que el texto blanco siempre se lea bien */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                  <div className="relative flex justify-between items-end">
                    <div>
                      <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 w-fit max-w-full break-words transition-colors duration-300", entity.status === 'Vivo' || entity.status === 'En guerra' ? "bg-brand-text text-brand-bg" : "bg-brand-muted/20 text-brand-muted border border-brand-border")}>{entity.status || 'Estado desconocido'}</div>
                      <h4 className="text-3xl font-black text-white leading-tight break-words drop-shadow-md">{entity.name}</h4>
                    </div>
                    {novel.status !== 'Finalizada' && (
                      <button onClick={() => setEditingEntity(entity)} title="Editar ficha" aria-label="Editar ficha" disabled={!!isAnalyzing} className="p-3 bg-brand-primary/20 border border-brand-primary/30 hover:bg-brand-primary hover:text-zinc-950 rounded-2xl text-brand-primary transition-all opacity-0 group-hover:opacity-100 disabled:opacity-20 cursor-pointer shadow-lg"><Edit2 className="w-5 h-5" /></button>
                    )}
                  </div>
                </div>

                {/* 2. CUERPO DE LA TARJETA (CON SCROLLBAR INTERNO Y RESTAURADO AL 100%) */}
                <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                  {/* ETIQUETAS */}
                  {entity.tags && entity.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {entity.tags.map((tag, i) => <span key={i} className="px-3 py-1 bg-brand-bg border border-brand-border rounded-full text-[10px] font-bold text-brand-muted break-words max-w-full shadow-sm">#{tag}</span>)}
                    </div>
                  )}

                  {/* RESUMEN */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-brand-muted"><Info className="w-4 h-4" /><h5 className="text-[10px] font-black uppercase tracking-widest">Información</h5></div>
                    <div className="text-brand-text text-sm md:text-base leading-relaxed font-serif prose prose-invert opacity-90 italic"><ReactMarkdown>{entity.summary}</ReactMarkdown></div>
                  </div>

                  {/* MISTERIOS PENDIENTES */}
                  {entity.openQuestions && entity.openQuestions.trim().length > 0 && (
                    <div className="bg-brand-bg/50 p-5 rounded-3xl border border-brand-border shadow-inner">
                      <div className="flex items-center gap-2 text-brand-muted mb-3">
                        <Flag className="w-4 h-4 text-brand-primary" />
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-primary/80">Misterios Pendientes</h5>
                      </div>
                      <div className="text-brand-muted text-xs italic font-serif whitespace-pre-wrap">
                        {entity.openQuestions}
                      </div>
                    </div>
                  )}

                  {/* MISTERIOS RESUELTOS */}
                  {entity.resolvedQuestions && entity.resolvedQuestions.trim().length > 0 && (
                    <div className="bg-brand-success/5 p-5 rounded-3xl border border-brand-success/20 shadow-inner">
                      <div className="flex items-center gap-2 text-brand-muted mb-3">
                        <Sparkles className="w-4 h-4 text-brand-success" />
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-success/80">Misterios Resueltos</h5>
                      </div>
                      <div className="text-brand-muted/80 text-xs italic font-serif whitespace-pre-wrap opacity-80">
                        {entity.resolvedQuestions}
                      </div>
                    </div>
                  )}

                  {/* VÍNCULOS / RELACIONES */}
                  {relationships.filter(r => r.sourceId === entity.id || r.targetId === entity.id).length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-brand-muted">
                        <Share2 className="w-4 h-4" />
                        <h5 className="text-[10px] font-black uppercase tracking-widest">Vínculos Conocidos</h5>
                      </div>
                      <div className="space-y-2">
                        {relationships
                          .filter(r => r.sourceId === entity.id || r.targetId === entity.id)
                          .map(rel => {
                            const otherName = rel.sourceId === entity.id ? rel.targetName : rel.sourceName;
                            return (
                              <div key={rel.id} className="flex flex-col p-3 bg-brand-bg/50 rounded-2xl text-xs border border-brand-border group/rel">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-black text-brand-text break-words">{rel.relationType}</span>
                                  <span className="text-brand-muted">con</span>
                                  <span className="font-bold text-brand-text group-hover/rel:text-brand-primary transition-colors break-words">{otherName}</span>
                                </div>
                                <span className="text-[10px] text-brand-muted mt-1.5 italic font-serif opacity-80">{rel.description}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. PIE FIJO CON BOTONES */}
                <div className="px-6 py-5 border-t border-brand-border text-[10px] text-brand-muted flex flex-col gap-2 font-bold tracking-widest uppercase shrink-0 bg-brand-card/50">
                  <div className="flex justify-between"><span>Aparición:</span><span className="text-brand-text">{entity.firstUpdatedChapterTitle || 'Única'}</span></div>
                  {novel.status === 'En Desarrollo' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showConfirm(
                          'Mover a Papelera',
                          `¿Estás seguro de que deseas enviar "${entity.name}" a la papelera?`,
                          'Aceptar',
                          () => handleTrashEntity(entity.id)
                        );
                      }}
                      disabled={!!isAnalyzing}
                      className="mt-2 w-full py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer bg-brand-error/10 text-brand-error border border-brand-error/20 hover:bg-brand-error hover:text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Mover a Papelera
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}