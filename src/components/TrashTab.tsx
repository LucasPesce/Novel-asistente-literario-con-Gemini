import { Trash2 } from 'lucide-react';
import { Chapter, Novel } from '../types';
import { storageService } from '../services/storageService';
import { useDialog } from '../components/DialogContext'; 

// ==========================================
// INTERFACES & PROPS
// ==========================================
interface TrashTabProps {
  trashedChapters: Chapter[];
  activeChapters: Chapter[];
  novel: Novel;
  isLocalMode: boolean;
}

export default function TrashTab({
  trashedChapters,
  activeChapters,
  novel,
  isLocalMode,
}: TrashTabProps) {
  
  // Usamos el hook de diálogos estéticos
  const { showAlert, showConfirm } = useDialog();

  return (
    <div className="space-y-6">
      
      {/* Cabecera de la sección de papelera y botón de vaciado manual */}
      <div className="flex justify-between items-center px-4">
        <div>
          <h3 className="text-xl font-bold text-brand-text">Papelera de Capítulos</h3>
          <p className="text-xs text-brand-muted mt-1">Los manuscritos eliminados se conservarán aquí por 30 días antes de destruirse para siempre.</p>
        </div>
        {trashedChapters.length > 0 && (
          <button
            onClick={() => {
              // IMPLEMENTAMOS SHOW CONFIRM 
              showConfirm(
                'Vaciar Papelera',
                '¿Estás seguro de que deseas vaciar la papelera? Esta acción destruirá los archivos permanentemente.',
                'Vaciar Papelera',
                () => storageService.emptyTrash(!!isLocalMode, novel.id, trashedChapters)
              );
            }}
            className="px-4 py-2 bg-brand-error/10 text-brand-error border border-brand-error/20 rounded-xl hover:bg-brand-error/25 transition-all font-bold text-xs uppercase cursor-pointer"
          >
            Vaciar Papelera
          </button>
        )}
      </div>

      {/* Caso A: Estado de papelera vacía */}
      {trashedChapters.length === 0 ? (
        <div className="bg-brand-card rounded-[2.5rem] p-16 text-center border border-brand-border shadow-2xl">
          <Trash2 className="w-16 h-16 text-brand-muted mx-auto mb-4" />
          <p className="text-brand-text font-medium font-serif text-lg">La papelera está vacía.</p>
        </div>
      ) : (
        
        /* Caso B: Listado de Capítulos en la papelera */
        <div className="space-y-4">
          {trashedChapters.map((chapter) => {
            const deletedDate = chapter.deletedAt ? new Date(chapter.deletedAt) : new Date();
            const daysRemaining = 30 - Math.floor((new Date().getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={chapter.id}
                className="bg-brand-card rounded-[2rem] border border-brand-border p-8 shadow-xl flex flex-col md:flex-row justify-between md:items-center gap-6"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black text-brand-error uppercase tracking-widest bg-brand-error/10 border border-brand-error/20 px-3 py-1 rounded-full">
                      Papelera
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Se eliminará de forma automática en {Math.max(1, daysRemaining)} días
                    </span>
                  </div>
                  <h4 className="text-xl font-bold text-brand-text">{chapter.title}</h4>
                  <p className="text-brand-muted text-xs font-bold uppercase tracking-widest">
                    Orden original: {chapter.chapterNumber === 0 ? 'Prólogo' : `Capítulo ${chapter.chapterNumber}`}
                  </p>
                </div>

                <div className="flex gap-2">
                  {/* Botón de Restaurar al manuscrito principal */}
                  <button
                    onClick={async () => {
                      const regularChapters = activeChapters.filter(c => c.chapterNumber > 0);
                      const nextNumber = regularChapters.length > 0
                        ? Math.max(...regularChapters.map(c => c.chapterNumber)) + 1
                        : 1;

                      await storageService.restoreChapter(!!isLocalMode, novel.id, chapter.id, chapter.chapterNumber === 0 ? 0 : nextNumber);
                      
                      // IMPLEMENTAMOS SHOW ALERT DE ÉXITO
                      showAlert('Capítulo Restaurado', `El "${chapter.title}" regresó al manuscrito con éxito.`, true);
                    }}
                    className="px-4 py-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-xl hover:bg-brand-primary/20 transition-all font-bold text-xs uppercase cursor-pointer"
                  >
                    Restaurar
                  </button>
                  
                  {/* Botón de borrado definitivo */}
                  <button
                    onClick={() => {
                      // IMPLEMENTAMOS SHOW CONFIRM
                      showConfirm(
                        'Eliminar Definitivamente',
                        `¿Estás seguro de que deseas eliminar permanentemente "${chapter.title}"?\nEsta acción destruirá el manuscrito de forma irreversible.`,
                        'Destruir Capítulo',
                        async () => {
                          await storageService.deleteChapterPermanently(!!isLocalMode, novel.id, chapter.id);
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