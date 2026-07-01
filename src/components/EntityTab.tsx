import { Plus, Users, MapPin, Sparkles, Share2, Info, Flag, Edit2, X, Trash2 } from 'lucide-react';
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
  handleDeleteEntity: (id: string) => void | Promise<void>;
}

export default function EntityTab({
  entities,
  relationships,
  novel,
  activeTab,
  isAnalyzing,
  setEditingEntity,
  handleManualAddEntity,
  handleDeleteEntity,
}: EntityTabProps) {

  const { showConfirm } = useDialog();
  const filteredEntities = entities.filter(e => e.type === (activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore'));
  // Detecta si en esta pestaña actual hay al menos una tarjeta con imagen
  const hasAnyImage = filteredEntities.some(e => e.imageUrl && e.imageUrl.trim() !== '');

  return (
    <div className="space-y-6">

      {/* Cabecera y botón de creación de fichas */}
      <div className="flex justify-between items-center px-4">
        <h3 className="text-xl font-bold text-brand-text">
          {activeTab === 'characters' ? 'Personajes' : activeTab === 'locations' ? 'Lugares' : 'Detalles del Mundo'}
          ({filteredEntities.length})
        </h3>
        {novel.status !== 'Finalizada' && (
          <button
            onClick={() => handleManualAddEntity(activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore')}
            disabled={!!isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-xl hover:bg-brand-primary/20 transition-all font-bold text-xs uppercase disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Ficha</span>
          </button>
        )}
      </div>

      {/* Grilla de Tarjetas de la Enciclopedia */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredEntities.map(entity => (
          <div
            key={entity.id}
            className={cn(
              "bg-brand-card rounded-[2.5rem] border border-brand-border overflow-hidden shadow-2xl hover:shadow-brand-primary/5 transition-all flex flex-col group relative",
              hasAnyImage ? "h-[1550px]" : "h-[1000px]" 
            )}
          >
{/* 1. CABECERA DE LA TARJETA (FIJA) */}
            <div
              className={cn(
                "p-8 flex flex-col justify-end relative overflow-hidden shrink-0 transition-all",
                hasAnyImage ? "h-110" : "h-48" // PORTADA DINÁMICA
              )}
              style={{ backgroundColor: entity.headerColor || (entity.type === 'character' ? '#2d2825' : entity.type === 'location' ? '#1e2420' : '#2b1e2a') }}
            >
              {entity.imageUrl && <img src={entity.imageUrl} alt={`Imagen de ${entity.name}`} className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="relative flex justify-between items-end">
                <div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 w-fit max-w-full break-words transition-colors duration-300",
                    entity.status === 'Vivo' || entity.status === 'En guerra' ? "bg-brand-text text-brand-bg" : "bg-brand-muted/20 text-brand-muted border border-brand-border"
                  )}>
                    {entity.status || (entity.type === 'character' ? 'Estado desconocido' : entity.type === 'location' ? 'Territorio' : 'Entidad del Mundo')}
                  </div>
                  <h4 className="text-3xl font-black text-white leading-tight break-words drop-shadow-md">{entity.name}</h4>
                </div>
                {novel.status !== 'Finalizada' && (
                  <button
                    onClick={() => setEditingEntity(entity)}
                    title="Editar ficha"
                    aria-label="Editar ficha"
                    disabled={!!isAnalyzing}
                    className="p-3 bg-brand-primary/20 border border-brand-primary/30 hover:bg-brand-primary hover:text-zinc-950 rounded-2xl text-brand-primary transition-all opacity-0 group-hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. CUERPO DE LA TARJETA (CON SCROLLBAR INTERNO) */}
            <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

              {/* Etiquetas */}
              {entity.tags && entity.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entity.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-brand-bg border border-brand-border rounded-full text-[10px] font-bold text-brand-muted break-words max-w-full shadow-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Información Resumida */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-brand-muted">
                  <Info className="w-4 h-4" />
                  <h5 className="text-[10px] font-black uppercase tracking-widest">Información</h5>
                </div>
                <div className="text-brand-text text-sm md:text-base leading-relaxed font-serif prose prose-invert opacity-90 italic">
                  <ReactMarkdown>{entity.summary}</ReactMarkdown>
                </div>
              </div>

              {/* Misterios Pendientes */}
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

              {/* Misterios Resueltos */}
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

              {/* Vínculos / Relaciones */}
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

            {/* 3. PIE DE LA TARJETA (FIJO AL FONDO) */}
            <div className="px-6 py-5 border-t border-brand-border text-[10px] text-brand-muted flex flex-col gap-2 font-bold tracking-widest uppercase shrink-0 bg-brand-card/50">
              <div className="flex justify-between">
                <span>Primera aparición:</span>
                <span className="text-brand-text">{entity.firstUpdatedChapterTitle || 'Prólogo'}</span>
              </div>
              <div className="flex justify-between">
                <span>Última aparición:</span>
                <span className="text-brand-text">{entity.lastUpdatedChapterTitle || entity.firstUpdatedChapterTitle || 'Única'}</span>
              </div>
              <div className="flex justify-end pt-1 opacity-40">
                {formatDate(entity.updatedAt)}
              </div>

              {/* Botón de Borrar con Modal Global Estilizado */}
              {novel.status === 'En Desarrollo' && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showConfirm(
                      'Eliminar del Mundo',
                      `¿Estás seguro de que deseas eliminar permanentemente a "${entity.name}"? Toda la información y sus vínculos se perderán.`,
                      'Eliminar Ficha',
                      () => handleDeleteEntity(entity.id)
                    );
                  }}
                  disabled={!!isAnalyzing}
                  className="mt-2 w-full py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer bg-brand-error/10 text-brand-error border border-brand-error/20 hover:bg-brand-error hover:text-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar del Mundo
                </button>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}