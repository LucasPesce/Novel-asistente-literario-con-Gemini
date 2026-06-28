import { Plus, Users, MapPin, Sparkles, Share2, Info, Flag, Edit2, X } from 'lucide-react'; 
import { WorldEntity, Relationship, EntityType } from '../types'; 
import ReactMarkdown from 'react-markdown';
import { formatDate, cn } from '../lib/utils'; 

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
  handleManualAddEntity: (type: EntityType) => Promise<void>;
  handleDeleteEntity: (id: string) => Promise<void>;
}

import { Novel } from '../types';

export default function EntityTab({
  entities,
  relationships,
  novel,
  activeTab,
  isAnalyzing,
  deletingEntityId,
  setEditingEntity,
  handleManualAddEntity,
  handleDeleteEntity,
}: EntityTabProps) {
  const filteredEntities = entities.filter(e => e.type === (activeTab === 'characters' ? 'character' : activeTab === 'locations' ? 'location' : 'lore'));

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
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-xl hover:bg-brand-primary/20 transition-all font-bold text-xs uppercase disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
            className="bg-brand-card rounded-[2.5rem] border border-brand-border overflow-hidden shadow-2xl hover:shadow-brand-primary/5 transition-all flex flex-col group relative"
          >
            {/* Cabecera de la Tarjeta (Fondo o Imagen) */}
            <div
              className="h-48 p-8 flex flex-col justify-end relative overflow-hidden"
              style={{ backgroundColor: entity.headerColor || (entity.type === 'character' ? '#2d2825' : entity.type === 'location' ? '#1e2420' : '#2b1e2a') }}
            >
              {entity.imageUrl && <img src={entity.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-overlay" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="relative flex justify-between items-end">
                <div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 w-fit max-w-full break-words transition-colors duration-300",
                    entity.status === 'Vivo' || entity.status === 'En guerra' ? "bg-brand-text text-brand-bg" : "bg-brand-muted/20 text-brand-muted"
                  )}>
                    {entity.status || (entity.type === 'character' ? 'Estado desconocido' : entity.type === 'location' ? 'Territorio' : 'Entidad del Mundo')}
                  </div>
                  <h4 className="text-3xl font-black text-brand-text leading-tight break-words">{entity.name}</h4>
                </div>
                {novel.status !== 'Finalizada' && (
                  <button
                    onClick={() => setEditingEntity(entity)}
                    title="Editar ficha"
                    aria-label="Editar ficha"
                    disabled={!!isAnalyzing}
                    className="p-3 bg-brand-primary/10 hover:bg-brand-primary/20 rounded-2xl text-brand-primary transition-all opacity-0 group-hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
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
                  <span key={i} className="px-3 py-1 bg-brand-bg/50 rounded-full text-[10px] font-bold text-brand-muted border border-brand-border break-words max-w-full">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Sección de Información Resumida */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-brand-muted">
                  <Info className="w-4 h-4" />
                  <h5 className="text-[10px] font-black uppercase tracking-widest">Información</h5>
                </div>
                <div className="text-brand-text text-lg leading-relaxed font-serif prose prose-invert opacity-90 italic">
                  <ReactMarkdown>{entity.summary}</ReactMarkdown>
                </div>
              </div>

              {/* Misterios Pendientes (Si existen) */}
              {entity.openQuestions && (
                <div className="bg-brand-bg/30 p-6 rounded-3xl border border-brand-border">
                  <div className="flex items-center gap-2 text-brand-muted mb-3">
                    <Flag className="w-4 h-4 text-brand-primary" />
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-primary/80">Misterios Pendientes</h5>
                  </div>
                  <div className="text-brand-muted/80 text-sm italic font-serif whitespace-pre-wrap">
                    {entity.openQuestions}
                  </div>
                </div>
              )}

              {/* Misterios Resueltos (Si existen) */}
              {entity.resolvedQuestions && (
                <div className="bg-brand-success/5 p-6 rounded-3xl border border-brand-success/15">
                  <div className="flex items-center gap-2 text-brand-muted mb-3">
                    <Sparkles className="w-4 h-4 text-brand-success" />
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-success/80">Misterios Resueltos</h5>
                  </div>
                  <div className="text-brand-muted/80 text-sm italic font-serif whitespace-pre-wrap opacity-60">
                    {entity.resolvedQuestions}
                  </div>
                </div>
              )}

              {/* Relaciones / Vínculos de la Ficha */}
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
                        <div key={rel.id} className="flex flex-col p-4 bg-brand-bg/30 rounded-2xl text-sm border border-brand-border group/rel">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-brand-text break-words">{rel.relationType}</span>
                            <span className="text-brand-muted">con</span>
                            <span className="font-bold text-brand-text group-hover/rel:text-brand-muted transition-colors break-words">{otherName}</span>
                          </div>
                          <span className="text-xs text-brand-muted mt-2 italic font-serif opacity-70">{rel.description}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Pie de la Tarjeta (Apariciones y Eliminación) */}
              <div className="pt-6 border-t border-brand-border text-[10px] text-brand-muted flex flex-col gap-2 font-bold tracking-widest uppercase">
                <div className="flex justify-between">
                  <span>Primera aparición:</span>
                  <span className="text-brand-text">{entity.firstUpdatedChapterTitle || 'Prólogo'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Última aparición:</span>
                  <span className="text-brand-text">{entity.lastUpdatedChapterTitle || entity.firstUpdatedChapterTitle || 'Única'}</span>
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
                      "mt-4 w-full py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30 cursor-pointer",
                      deletingEntityId === entity.id 
                        ? "bg-brand-primary text-zinc-950" 
                        : "bg-brand-error/20 text-brand-error border border-brand-error/20 hover:bg-brand-error/30"
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
          </div>
        ))}
      </div>
    </div>
  );
}