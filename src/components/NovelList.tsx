import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Plus, Book, Trash2, Edit2, Palette, Image as ImageIcon, X } from 'lucide-react';
import { Novel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { localService } from '../services/localService';
import { googleDriveService } from '../services/googleDriveService';
import { storageService } from '../services/storageService';

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
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
  const [editForm, setEditForm] = useState({ title: '', color: '', coverImage: '', status: 'En Desarrollo' as any });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ==========================================
  // EFECTOS (EFFECTS)
  // ==========================================
  
  // Escucha cambios y carga las novelas desde la base de datos correspondiente (Local o Firestore)
  useEffect(() => {
    const unsub = storageService.getNovels(!!isLocalMode, (list) => {
      setNovels([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });

    return () => unsub();
  }, [isLocalMode]);

  // ==========================================
  // MANEJADORES DE EVENTOS (HANDLERS)
  // ==========================================

  /**
   * Lee la imagen cargada por el usuario, la convierte en un string Base64
   * y la guarda temporalmente en el formulario como portada.
   */
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

  /**
   * Crea una nueva novela en blanco
   * - En Modo Local: Verifica si debe solicitar acceso a una carpeta y escribe localmente.
   * - En Modo Conectado: Inserta el registro en Firebase Firestore.
   */
  const handleAddNovel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // --- Flujo Modo Local ---
    if (isLocalMode) {
      if (novels.length === 0 && !localStorage.getItem('novel_directory_selected')) {
        const choice = confirm('¿Deseas guardar tus archivos en una carpeta de tu dispositivo? (Recomendado para modo local)\n\nCancelar para continuar usando solo el almacenamiento del navegador.');
        if (choice) {
          const success = await localService.requestDirectoryHandle();
          if (success) {
            localStorage.setItem('novel_directory_selected', 'true');
          }
        }
      }

      const data = localService.getData();
      const newNovel: Novel = {
        id: crypto.randomUUID(),
        title: newTitle,
        authorId: 'local-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'En Desarrollo',
      };
      const updatedData = { ...data, novels: [...data.novels, newNovel] };
      localService.saveData(updatedData);
      setNewTitle('');
      setIsAdding(false);
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'novels'), {
        title: newTitle,
        authorId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'En Desarrollo',
      });
      setNewTitle('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'novels');
    }
  };

  /**
   * Elimina una novela de la base de datos.
   * Cuenta con un sistema de doble confirmación preventiva (doble clic) para evitar accidentes.
   */
  const handleDeleteNovel = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }

    // --- Flujo Modo Local ---
    if (isLocalMode) {
      const data = localService.getData();
      const novelToDelete = data.novels.find(n => n.id === id);
      const updatedData = { ...data, novels: data.novels.filter(n => n.id !== id) };
      localService.saveData(updatedData);

      if (novelToDelete) {
        googleDriveService.deleteFromDrive(novelToDelete.title);
      }

      setDeletingId(null);
      return;
    }

    // --- Flujo Modo Conectado (Nube) ---
    try {
      await deleteDoc(doc(db, 'novels', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `novels/${id}`);
    }
  };

  /**
   * Carga el formulario de personalización con la información actual de la novela seleccionada.
   */
  const handleStartEdit = (novel: Novel) => {
    setEditingNovel(novel);
    setEditForm({
      title: novel.title,
      color: novel.color || '#9a7b4f',
      coverImage: novel.coverImage || '',
      status: novel.status || 'En Desarrollo'
    });
  };

  /**
   * Guarda las ediciones hechas a la novela (título, color, portada o estado)
   */
  const handleSaveEdit = async () => {
    if (!editingNovel) return;

    const updates = {
      title: editForm.title,
      color: editForm.color,
      coverImage: editForm.coverImage,
      status: editForm.status,
      updatedAt: new Date().toISOString()
    };

    if (isLocalMode) {
      const data = localService.getData();
      const updatedData = {
        ...data,
        novels: data.novels.map(n => n.id === editingNovel.id ? { ...n, ...updates } : n)
      };
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
    <div className="space-y-8">
      
      {/* Cabecera y botón de creación */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-[#e8e4df]">Mis Novelas</h2>
          <p className="text-[#6d5a4a]">Administra tus mundos y personajes</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-[#1a1715] border border-white/10 text-[#e8e4df] px-6 py-2 rounded-xl hover:bg-[#251f1c] transition-all shadow-sm font-bold"
        >
          <Plus className="w-5 h-5 text-[#f3f0eb]" />
          <span>Nueva Novela</span>
        </button>
      </div>

      <AnimatePresence>
        
        {/* Formulario rápido de Nueva Novela */}
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[#1a1715] p-8 rounded-3xl shadow-2xl border border-white/5"
          >
            <form onSubmit={handleAddNovel} className="flex gap-4">
              <input
                autoFocus
                type="text"
                placeholder="Título de la novela..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-[#e8e4df] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#b45309]/20 font-medium placeholder:text-[#6d5a4a]"
              />
              <button
                type="submit"
                className="px-8 py-3 bg-[#9a7b4f] text-[#f3f0eb] rounded-2xl font-bold hover:bg-[#866a43] transition-all shadow-lg"
              >
                Crear
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 text-[#6d5a4a] hover:text-[#e8e4df] transition-colors"
              >
                Cancelar
              </button>
            </form>
          </motion.div>
        )}

        {/* Modal de Personalización / Edición */}
        {editingNovel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <div className="bg-[#1a1715] w-full max-w-lg p-8 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-[#e8e4df]">Personalizar Novela</h3>
                <button 
                  onClick={() => setEditingNovel(null)} 
                  title="Cerrar edición" 
                  aria-label="Cerrar edición"
                  className="p-2 hover:bg-white/5 rounded-full text-[#6d5a4a]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Edición de Título */}
                <div>
                  <label className="text-xs font-bold text-[#6d5a4a] uppercase mb-2 block">Título</label>
                  <input
                    type="text"
                    aria-label="Editar título de la novela"
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-6 py-3 bg-white/5 border border-white/10 text-[#e8e4df] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#9a7b4f]/20"
                  />
                </div>

                {/* Edición de Estado */}
                <div>
                  <label className="text-xs font-bold text-[#6d5a4a] uppercase mb-2 block">Estado de la Novela</label>
                  <div className="flex gap-2">
                    {['En Desarrollo', 'Finalizada'].map(s => (
                      <button
                        key={s}
                        onClick={() => setEditForm({ ...editForm, status: s as any })}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                          editForm.status === s
                            ? "bg-[#9a7b4f] text-white border-[#9a7b4f]"
                            : "bg-white/5 text-[#6d5a4a] border-white/10 hover:bg-white/10"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Edición de Colores de Fondo */}
                <div>
                  <label className="text-xs font-bold text-[#6d5a4a] uppercase mb-2 block tracking-widest">Paleta de Colores</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['#9a7b4f', '#4f7a9a', '#7a4f9a', '#9a4f4f', '#4f9a7a', '#1a1715', '#2d2825', '#1e2420', '#2b1e2a'].map(c => (
                      <button
                        key={c}
                        onClick={() => setEditForm({ ...editForm, color: c })}
                        title={`Seleccionar color ${c}`}
                        aria-label={`Seleccionar color ${c}`}
                        className={cn(
                          "w-8 h-8 rounded-lg border-2 transition-transform active:scale-95",
                          editForm.color === c ? "border-white scale-110 shadow-lg" : "border-white/10 hover:border-white/30"
                        )}
                        style={{ backgroundColor: c }}
                        type="button"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                    <Palette className="w-4 h-4 text-[#6d5a4a]" />
                    <span className="text-[10px] font-bold text-[#6d5a4a] uppercase flex-1">Color Personalizado</span>
                    <input
                      type="color"
                      value={editForm.color}
                      title="Color personalizado"
                      aria-label="Elegir color personalizado"
                      onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-10 h-8 bg-transparent border-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Carga de Imagen de Portada */}
                <div>
                  <label className="text-xs font-bold text-[#6d5a4a] uppercase mb-2 block">Imagen de Portada</label>
                  <div className="flex gap-4">
                    <div className="h-24 w-16 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {editForm.coverImage ? (
                        <img src={editForm.coverImage} alt="Previsualización de la portada" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-[#6d5a4a]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="novel-cover-upload"
                      />
                      <label
                        htmlFor="novel-cover-upload"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-[#e8e4df] rounded-xl hover:bg-white/10 transition-all cursor-pointer text-sm font-bold"
                      >
                        <ImageIcon className="w-4 h-4" />
                        {editForm.coverImage ? 'Cambiar Imagen' : 'Subir Imagen'}
                      </label>
                      {editForm.coverImage && (
                        <button
                          onClick={() => setEditForm({ ...editForm, coverImage: '' })}
                          className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400"
                        >
                          Eliminar Imagen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveEdit}
                className="w-full py-4 bg-[#9a7b4f] text-white rounded-2xl font-black shadow-xl hover:bg-[#866a43] transition-all"
              >
                GUARDAR CAMBIOS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grilla / Listado de Tarjetas de Novela */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {novels.map((novel) => (
          <div key={novel.id} className="relative group">
            <motion.div
              layoutId={novel.id}
              onClick={() => onSelect(novel)}
              className="cursor-pointer bg-[#1a1715] rounded-[2.5rem] border border-white/5 shadow-sm hover:shadow-2xl hover:border-white/10 transition-all h-full flex flex-col items-stretch overflow-hidden"
            >
              {/* Cabecera de la Tarjeta con Color / Portada */}
              <div
                className="h-40 relative flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: novel.color || '#1a1715' }}
              >
                {novel.coverImage && (
                  <img src={novel.coverImage} alt={novel.title} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <Book className="w-12 h-12 text-white/20 relative z-10" />

                {/* Botón rápido para Editar / Personalizar Tarjeta */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(novel);
                  }}
                  className="absolute top-4 left-4 p-2 bg-white/10 backdrop-blur-md rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20"
                  title="Personalizar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Contenido e Información Básica de la Novela */}
              <div className="p-8 space-y-2">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-2xl font-black text-[#e8e4df] tracking-tight">{novel.title}</h3>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                    novel.status === 'Finalizada' ? "bg-[#c2a884]/20 text-[#c2a884] border border-[#c2a884]/30" : "bg-[#9a7b4f]/20 text-[#9a7b4f] border border-[#9a7b4f]/30"
                  )}>
                    {novel.status || 'En Desarrollo'}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[#e8e4df]/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    {novel.chapterCount || 0} Capítulos
                  </p>
                  <p className="text-[#6d5a4a] text-xs font-bold uppercase tracking-wider">
                    Actualizado: {new Date(novel.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Botón de Borrado con Confirmación (Solo visible en Hover) */}
            <button
              id={`delete-novel-${novel.id}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteNovel(novel.id);
              }}
              className={cn(
                "absolute top-4 right-4 p-2 shadow-2xl text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all z-[100] cursor-pointer ring-2 ring-black/20 hover:scale-110 active:scale-95 flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest",
                deletingId === novel.id ? "bg-[#9a7b4f] scale-110 opacity-100" : "bg-red-950/80 text-red-400 hover:bg-red-900 border border-red-900/50"
              )}
              title={deletingId === novel.id ? "Confirmar borrado" : "Borrar novela"}
            >
              <Trash2 className="w-4 h-4" />
              {deletingId === novel.id && <span>¿BORRAR?</span>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
