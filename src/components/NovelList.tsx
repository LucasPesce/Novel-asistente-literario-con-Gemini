import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Edit2, Palette, Image as ImageIcon, X, Book } from 'lucide-react';
import { Novel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { localService } from '../services/localService';
import { googleDriveService } from '../services/googleDriveService';
import { storageService } from '../services/storageService';
import { useDialog } from '../components/DialogContext'; // <--- NUEVO HOOK

// ==========================================
// INTERFACES & PROPS
// ==========================================
interface NovelListProps {
  onSelect: (novel: Novel) => void;
  isLocalMode?: boolean;
}

export default function NovelList({ onSelect, isLocalMode }: NovelListProps) {
  // ==========================================
  // ESTADOS (STATES)
  // ==========================================
  const [novels, setNovels] = useState<Novel[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [editForm, setEditForm] = useState({ title: '', color: '', coverImage: '', status: 'En Desarrollo' as any });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Llamamos a nuestro sistema de alertas global
  const { showAlert, showConfirm } = useDialog();

  const activeNovels = novels.filter(n => !n.deletedAt);
  const trashedNovels = novels.filter(n => !!n.deletedAt);

  // ==========================================
  // EFECTOS (EFFECTS)
  // ==========================================
  useEffect(() => {
    const unsub = storageService.getNovels(!!isLocalMode, (list) => {
      setNovels([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
    return () => unsub();
  }, [isLocalMode]);

  useEffect(() => {
    if (trashedNovels.length > 0) {
      storageService.pruneExpiredNovelTrash(!!isLocalMode, trashedNovels);
    }
  }, [novels, isLocalMode]);

  // ==========================================
  // MANEJADORES DE EVENTOS (HANDLERS)
  // ==========================================

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, coverImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (isLocalMode) {
      if (novels.length === 0 && !localStorage.getItem('novel_directory_selected')) {
        showConfirm(
          'Configuración Local',
          '¿Deseas guardar tus archivos en una carpeta de tu PC? (Recomendado).\nSi cancelas, se guardarán solo en la caché del navegador.',
          'Seleccionar Carpeta',
          async () => {
            const success = await localService.requestDirectoryHandle();
            if (success) localStorage.setItem('novel_directory_selected', 'true');
            createNovelLocal();
          }
        );
        return; 
      }
      createNovelLocal();
      return;
    }

    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'novels'), {
        title: newTitle,
        authorId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'En Desarrollo',
        color: 'transparent'
      });
      setNewTitle('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'novels');
    }
  };

  const createNovelLocal = () => {
    const data = localService.getData();
    const newNovel: Novel = {
      id: crypto.randomUUID(),
      title: newTitle,
      authorId: 'local-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'En Desarrollo',
      color: 'transparent'
    };
    localService.saveData({ ...data, novels: [...data.novels, newNovel] });
    setNewTitle('');
    setIsAdding(false);
  };

  const handleTrashNovel = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    await storageService.trashNovel(!!isLocalMode, id);
    setDeletingId(null);
  };

  const handleStartEdit = (novel: Novel) => {
    setEditingNovel(novel);
    setEditForm({
      title: novel.title,
      color: novel.color || 'transparent',
      coverImage: novel.coverImage || '',
      status: novel.status || 'En Desarrollo'
    });
  };

  const handleSaveEdit = async () => {
    if (!editingNovel) return;
    const updates = { ...editForm, updatedAt: new Date().toISOString() };

    if (isLocalMode) {
      const data = localService.getData();
      const updatedData = { ...data, novels: data.novels.map(n => n.id === editingNovel.id ? { ...n, ...updates } : n) };
      localService.saveData(updatedData);
    } else {
      try {
        await updateDoc(doc(db, 'novels', editingNovel.id), updates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `novels/${editingNovel.id}`);
      }
    }
    setEditingNovel(null);
  };

  // ==========================================
  // DISEÑO VISUAL (RENDER)
  // ==========================================
  return (
    <div className="space-y-8 relative">
      {/* Cabecera y Pestañas */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-text mb-4">Biblioteca</h2>
          <div className="flex gap-2 p-1 bg-brand-card rounded-xl w-fit border border-brand-border">
            <button
              onClick={() => setActiveTab('active')}
              className={cn("flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
                activeTab === 'active' ? "bg-brand-primary text-zinc-950 shadow-md" : "text-brand-muted hover:text-brand-text hover:bg-white/5"
              )}
            >
              <Book className="w-4 h-4" /> Mis Novelas
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={cn("flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
                activeTab === 'trash' ? "bg-brand-error text-white shadow-md" : "text-brand-muted hover:text-brand-error hover:bg-white/5"
              )}
            >
              <Trash2 className="w-4 h-4" /> Papelera ({trashedNovels.length})
            </button>
          </div>
        </div>
        
        {activeTab === 'active' && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-brand-primary text-zinc-950 px-6 py-3 rounded-xl hover:bg-brand-secondary transition-all shadow-lg font-black cursor-pointer active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Novela</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'active' ? (
          <motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            
            {/* Formulario rápido de Nueva Novela */}
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-card p-8 rounded-3xl shadow-2xl border border-brand-border"
              >
                <form onSubmit={handleAddNovel} className="flex gap-4">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Título de la nueva novela..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="flex-1 px-6 py-3 bg-brand-bg border border-brand-border text-brand-text rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-medium placeholder:text-brand-muted"
                  />
                  <button type="submit" className="px-8 py-3 bg-brand-primary text-zinc-950 rounded-2xl font-bold hover:bg-brand-secondary transition-all shadow-lg cursor-pointer">
                    Crear
                  </button>
                  <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 text-brand-muted hover:text-brand-text transition-colors cursor-pointer">
                    Cancelar
                  </button>
                </form>
              </motion.div>
            )}

            {/* Grilla de Novelas Activas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeNovels.map((novel) => {
                const isTransparent = novel.color === 'transparent' || !novel.color;

                return (
                <div key={novel.id} className="relative group">
                  <motion.div
                    layoutId={novel.id}
                    onClick={() => onSelect(novel)}
                    className="cursor-pointer bg-brand-card rounded-[2.5rem] border border-brand-border shadow-sm hover:shadow-2xl hover:border-brand-primary/30 transition-all h-full flex flex-col items-stretch overflow-hidden"
                  >
                    <div
                      className={cn("h-64 relative flex items-center justify-center overflow-hidden transition-all duration-300", isTransparent ? "bg-brand-bg" : "")}
                      style={{ backgroundColor: isTransparent ? undefined : novel.color }}
                    >
                      {novel.coverImage ? (
                        <img src={novel.coverImage} alt={novel.title} className={cn("absolute inset-0 w-full h-full object-cover transition-all duration-300", isTransparent ? "opacity-100 mix-blend-normal" : "opacity-60 mix-blend-overlay")} />
                      ) : (
                        <div className="text-brand-muted/20 opacity-50">Sin Portada</div>
                      )}
                      {!isTransparent && <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />}

                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartEdit(novel); }}
                        className="absolute top-4 left-4 p-3 bg-brand-bg/50 backdrop-blur-md border border-brand-border rounded-xl text-brand-text opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-primary hover:text-zinc-950 hover:border-brand-primary cursor-pointer z-20 shadow-lg"
                        title="Personalizar"
                        aria-label="Personalizar portada"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-8 space-y-2 bg-brand-card z-10 relative">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="text-2xl font-black text-brand-text tracking-tight">{novel.title}</h3>
                        <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap", novel.status === 'Finalizada' ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30" : "bg-brand-muted/10 text-brand-muted border border-brand-border")}>
                          {novel.status || 'En Desarrollo'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          {novel.chapterCount || 0} Capítulos
                        </p>
                        <p className="text-brand-muted/60 text-xs font-bold uppercase tracking-wider">
                          Actualizado: {new Date(novel.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTrashNovel(novel.id); }}
                    className={cn(
                      "absolute top-4 right-4 p-3 shadow-xl rounded-xl opacity-0 group-hover:opacity-100 transition-all z-[100] cursor-pointer border flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest",
                      deletingId === novel.id 
                        ? "bg-brand-error text-white border-brand-error scale-110 opacity-100" 
                        : "bg-brand-bg/80 text-brand-muted border-brand-border hover:bg-brand-error hover:text-white hover:border-brand-error backdrop-blur-md"
                    )}
                    title={deletingId === novel.id ? "Confirmar borrado" : "Mover a papelera"}
                    aria-label="Mover novela a la papelera"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingId === novel.id && <span>¿BORRAR?</span>}
                  </button>
                </div>
              )})}
            </div>
          </motion.div>
        ) : (
          <motion.div key="trash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {trashedNovels.length === 0 ? (
              <div className="bg-brand-card rounded-[2.5rem] p-16 text-center border border-brand-border shadow-2xl">
                <Trash2 className="w-16 h-16 text-brand-muted mx-auto mb-4" />
                <p className="text-brand-text font-medium font-serif text-lg">La papelera de novelas está vacía.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {trashedNovels.map(novel => {
                  const deletedDate = novel.deletedAt ? new Date(novel.deletedAt) : new Date();
                  const daysRemaining = 30 - Math.floor((new Date().getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div key={novel.id} className="bg-brand-card rounded-[2rem] border border-brand-border p-8 shadow-xl flex flex-col md:flex-row justify-between md:items-center gap-6">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black text-brand-error uppercase tracking-widest bg-brand-error/10 border border-brand-error/20 px-3 py-1 rounded-full">
                            Papelera
                          </span>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            Se eliminará en {Math.max(1, daysRemaining)} días
                          </span>
                        </div>
                        <h4 className="text-xl font-bold text-brand-text">{novel.title}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await storageService.restoreNovel(!!isLocalMode, novel.id);
                            showAlert('Novela Restaurada', `"${novel.title}" ha sido restaurada a tu biblioteca.`, true);
                          }}
                          className="px-4 py-2 bg-brand-bg text-brand-muted border border-brand-border rounded-xl hover:bg-brand-primary hover:border-brand-primary hover:text-zinc-950 transition-all font-bold text-xs uppercase cursor-pointer shadow-sm"
                        >
                          Restaurar
                        </button>
                        <button
                          onClick={() => {
                            showConfirm(
                              'Eliminar Definitivamente',
                              `¿Estás seguro de que deseas destruir "${novel.title}" para siempre?\nEsta acción es irreversible y eliminará todos los capítulos y fichas asociadas.`,
                              'Destruir Novela',
                              async () => {
                                await storageService.deleteNovelPermanently(!!isLocalMode, novel.id);
                                if (isLocalMode) googleDriveService.deleteFromDrive(novel.title);
                                showAlert('Novela Eliminada', `"${novel.title}" ha sido destruida permanentemente.`);
                              }
                            );
                          }}
                          className="px-4 py-2 bg-brand-bg text-brand-muted border border-brand-border rounded-xl hover:bg-brand-error hover:border-brand-error hover:text-white transition-all font-bold text-xs uppercase cursor-pointer shadow-sm"
                        >
                          Eliminar Definitivamente
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Edición de Novela */}
      <AnimatePresence>
        {editingNovel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-brand-card w-full max-w-lg p-8 rounded-[2.5rem] border border-brand-border shadow-2xl space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-brand-text">Personalizar Novela</h3>
                <button onClick={() => setEditingNovel(null)} title="Cerrar edición" aria-label="Cerrar edición" className="p-2 hover:bg-brand-bg rounded-full text-brand-muted cursor-pointer"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-brand-muted uppercase mb-2 block">Título</label>
                  <input type="text" aria-label="Editar título de la novela" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-6 py-3 bg-brand-bg border border-brand-border text-brand-text rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-bold text-brand-muted uppercase mb-2 block">Estado de la Novela</label>
                  <div className="flex gap-2">
                    {['En Desarrollo', 'Finalizada'].map(s => (
                      <button key={s} type="button" onClick={() => setEditForm({ ...editForm, status: s as any })} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer", editForm.status === s ? "bg-brand-primary text-zinc-950 border-brand-primary" : "bg-brand-bg text-brand-muted border-brand-border hover:bg-brand-primary/10 hover:text-brand-primary")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-brand-muted uppercase mb-2 block tracking-widest">Filtro de Portada</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['transparent', '#9a7b4f', '#4f7a9a', '#7a4f9a', '#9a4f4f', '#4f9a7a', '#1a1715', '#2d2825', '#1e2420', '#2b1e2a'].map(c => (
                      <button key={c} onClick={() => setEditForm({ ...editForm, color: c })} title={c === 'transparent' ? "Sin color (Transparente)" : `Filtro ${c}`} aria-label={c === 'transparent' ? "Sin color" : `Color ${c}`} className={cn("w-8 h-8 rounded-lg border-2 transition-transform active:scale-95 flex items-center justify-center overflow-hidden cursor-pointer", editForm.color === c ? "border-brand-text scale-110 shadow-lg" : "border-brand-border hover:border-brand-muted", c === 'transparent' ? "bg-brand-bg relative" : "")} style={{ backgroundColor: c === 'transparent' ? undefined : c }} type="button">{c === 'transparent' && <div className="w-full h-[2px] bg-brand-error/50 rotate-45 absolute" />}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-brand-bg border border-brand-border rounded-xl px-4 py-2">
                    <Palette className="w-4 h-4 text-brand-muted" />
                    <span className="text-[10px] font-bold text-brand-muted uppercase flex-1">Color Personalizado</span>
                    <input type="color" value={editForm.color} title="Color personalizado" aria-label="Elegir color personalizado" onChange={e => setEditForm({ ...editForm, color: e.target.value })} className="w-10 h-8 bg-transparent border-none cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-brand-muted uppercase mb-2 block">Imagen de Portada</label>
                  <div className="flex gap-4">
                    <div className="h-24 w-16 bg-brand-bg rounded-xl border border-brand-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {editForm.coverImage ? <img src={editForm.coverImage} alt="Previsualización de la portada" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-brand-muted" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="novel-cover-upload" />
                      <label htmlFor="novel-cover-upload" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-bg border border-brand-border text-brand-text rounded-xl hover:bg-brand-primary/10 hover:text-brand-primary transition-all cursor-pointer text-sm font-bold"><ImageIcon className="w-4 h-4" />{editForm.coverImage ? 'Cambiar Imagen' : 'Subir Imagen'}</label>
                      {editForm.coverImage && <button type="button" onClick={() => setEditForm({ ...editForm, coverImage: '' })} className="text-[10px] font-black text-brand-error uppercase tracking-widest hover:text-red-400 cursor-pointer">Eliminar Imagen</button>}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleSaveEdit} className="w-full py-4 bg-brand-primary text-zinc-950 rounded-2xl font-black shadow-xl hover:bg-brand-secondary transition-all cursor-pointer">GUARDAR CAMBIOS</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}