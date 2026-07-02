import { useState } from 'react';
import { Trash2, BookOpen, Users } from 'lucide-react';
import { Chapter, WorldEntity, Novel } from '../types';
import { storageService } from '../services/storageService';
import { useDialog } from '../components/DialogContext';
import { cn } from '../lib/utils';

interface TrashTabProps {
  trashedChapters: Chapter[];
  activeChapters: Chapter[];
  trashedEntities: WorldEntity[]; // <--- NUEVA PROPIEDAD
  novel: Novel;
  isLocalMode: boolean;
}

export default function TrashTab({
  trashedChapters, activeChapters, trashedEntities, novel, isLocalMode,
}: TrashTabProps) {
  
  const { showAlert, showConfirm } = useDialog();
  const [subTab, setSubTab] = useState<'chapters' | 'entities'>('chapters');

  const activeTrashList = subTab === 'chapters' ? trashedChapters : trashedEntities;

  const handleEmptyCurrentTrash = () => {
    showConfirm(
      'Vaciar Papelera',
      `¿Destruir permanentemente todos los ${subTab === 'chapters' ? 'capítulos' : 'fichas del mundo'} en la papelera?`,
      'Vaciar Papelera',
      () => {
        if (subTab === 'chapters') storageService.emptyTrash(!!isLocalMode, novel.id, trashedChapters);
        else storageService.emptyEntityTrash(!!isLocalMode, novel.id, trashedEntities);
      }
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Cabecera y Botón Vaciar */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 px-4">
        <div>
          <h3 className="text-xl font-bold text-brand-text mb-4">Papelera de Reciclaje</h3>
          <div className="flex gap-2 p-1 bg-brand-card rounded-xl w-fit border border-brand-border">
            <button onClick={() => setSubTab('chapters')} className={cn("flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer", subTab === 'chapters' ? "bg-brand-border text-brand-text shadow-sm" : "text-brand-muted hover:text-brand-text hover:bg-white/5")}>
              <BookOpen className="w-3.5 h-3.5" /> Capítulos ({trashedChapters.length})
            </button>
            <button onClick={() => setSubTab('entities')} className={cn("flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer", subTab === 'entities' ? "bg-brand-border text-brand-text shadow-sm" : "text-brand-muted hover:text-brand-text hover:bg-white/5")}>
              <Users className="w-3.5 h-3.5" /> Fichas ({trashedEntities.length})
            </button>
          </div>
        </div>
        
        {activeTrashList.length > 0 && (
          <button onClick={handleEmptyCurrentTrash} className="px-4 py-2 bg-brand-error/10 text-brand-error border border-brand-error/20 rounded-xl hover:bg-brand-error/25 transition-all font-bold text-xs uppercase cursor-pointer">
            Vaciar Papelera Actual
          </button>
        )}
      </div>

      {/* Listado Vacío */}
      {activeTrashList.length === 0 ? (
        <div className="bg-brand-card rounded-[2.5rem] p-16 text-center border border-brand-border shadow-2xl">
          <Trash2 className="w-16 h-16 text-brand-muted mx-auto mb-4" />
          <p className="text-brand-text font-medium font-serif text-lg">La papelera está vacía.</p>
        </div>
      ) : (
        /* Listado de Elementos */
        <div className="space-y-4">
          {activeTrashList.map((item: any) => {
            const deletedDate = item.deletedAt ? new Date(item.deletedAt) : new Date();
            const daysRemaining = 30 - Math.floor((new Date().getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
            const isChapter = subTab === 'chapters';

            return (
              <div key={item.id} className="bg-brand-card rounded-[2rem] border border-brand-border p-8 shadow-xl flex flex-col md:flex-row justify-between md:items-center gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black text-brand-error uppercase tracking-widest bg-brand-error/10 border border-brand-error/20 px-3 py-1 rounded-full">
                      Papelera
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Se eliminará en {Math.max(1, daysRemaining)} días
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-brand-text">{isChapter ? item.title : item.name}</h4>
                  <p className="text-brand-muted text-xs font-bold uppercase tracking-widest">
                    {isChapter ? `Orden original: ${item.chapterNumber === 0 ? 'Prólogo' : 'Capítulo ' + item.chapterNumber}` : `Ficha de: ${item.type === 'character' ? 'Personaje' : item.type === 'location' ? 'Lugar' : 'Mundo'}`}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (isChapter) {
                        const regularChapters = activeChapters.filter(c => c.chapterNumber > 0);
                        const nextNumber = regularChapters.length > 0 ? Math.max(...regularChapters.map(c => c.chapterNumber)) + 1 : 1;
                        await storageService.restoreChapter(!!isLocalMode, novel.id, item.id, item.chapterNumber === 0 ? 0 : nextNumber);
                      } else {
                        await storageService.restoreEntity(!!isLocalMode, novel.id, item.id);
                      }
                      showAlert('Elemento Restaurado', `"${isChapter ? item.title : item.name}" regresó a la novela con éxito.`, true);
                    }}
                    className="px-4 py-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-xl hover:bg-brand-primary/20 transition-all font-bold text-xs uppercase cursor-pointer"
                  >
                    Restaurar
                  </button>
                  <button
                    onClick={() => {
                      showConfirm(
                        'Eliminar Definitivamente',
                        `¿Estás seguro de que deseas destruir "${isChapter ? item.title : item.name}" para siempre?`,
                        'Destruir',
                        async () => {
                          if (isChapter) await storageService.deleteChapterPermanently(!!isLocalMode, novel.id, item.id);
                          else await storageService.deleteEntityPermanently(!!isLocalMode, novel.id, item.id);
                        }
                      );
                    }}
                    className="px-4 py-2 bg-brand-error/10 text-brand-error border border-brand-error/20 rounded-xl hover:bg-brand-error/25 transition-all font-bold text-xs uppercase cursor-pointer"
                  >
                    Eliminar Definitivamente
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}