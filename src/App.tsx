import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, driveProvider } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import Navbar from './components/Navbar';
import NovelList from './components/NovelList';
import NovelView from './components/NovelView';
import { Novel } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Cloud } from 'lucide-react';
import { localService } from './services/localService';
import { googleDriveService } from './services/googleDriveService';
import { useDialog } from './components/DialogContext';

// ==========================================
// COMPONENTE PRINCIPAL (APPLICATION ROOT)
// ==========================================
export default function App() {
  // ==========================================
  // ESTADOS (STATES)
  // ==========================================
  const { showAlert, showConfirm } = useDialog();
  const [user, loading] = useAuthState(auth);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ==========================================
  // EFECTOS (EFFECTS)
  // ==========================================

  // Recupera y restaura de forma automática la sesión del Modo Local al iniciar la app
  useEffect(() => {
    const savedMode = localStorage.getItem('novel_app_mode');
    if (savedMode === 'local') {
      setIsLocalMode(true);
      localService.restoreDirectoryHandle();
    }
  }, []);

  // ==========================================
  // MANEJADORES DE EVENTOS (HANDLERS)
  // ==========================================

  /**
   * Inicializa el Modo Local. Solicita acceso a la carpeta física del dispositivo
   * y guarda el estado en caché. Si falla (por restricciones de navegador),
   * ofrece un fallback seguro guardando los datos únicamente en la base de datos del navegador.
   */
  const handleEnterLocalMode = async () => {
    const success = await localService.requestDirectoryHandle();
    if (success) {
      setIsLocalMode(true);
      localStorage.setItem('novel_app_mode', 'local');
    } else {
      showConfirm(
        'Modo Navegador',
        'No se pudo acceder a una carpeta local (por restricciones del navegador o vista previa).\n\n¿Deseas continuar en MODO LOCAL usando solo la caché del navegador? (Tus datos no se guardarán como archivos en tu PC).',
        'Continuar',
        () => {
          setIsLocalMode(true);
          localStorage.setItem('novel_app_mode', 'local');
        }
      );
    }
  };

  /**
   * Finaliza la sesión del Modo Local limpiando los identificadores de sesión en disco
   */
  const handleExitLocalMode = () => {
    setIsLocalMode(false);
    localStorage.removeItem('novel_app_mode');
    setSelectedNovel(null);
  };

  /**
   * Abre la ventana popup de Google OAuth para autenticar al usuario en Firebase,
   * solicita permisos para Google Drive y almacena de forma segura el token de acceso obtenido.
   */
  const login = async () => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      const result = await signInWithPopup(auth, driveProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        googleDriveService.setAccessToken(credential.accessToken);
        showAlert('Conexión Exitosa', '¡Google Drive vinculado correctamente!', true);
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        showAlert('Ventana Bloqueada', 'El navegador bloqueó la ventana emergente. Por favor, actívala para poder ingresar.');
      } else if (error.code !== 'auth/cancelled-popup-request') {
        console.error('Error de autenticación:', error);
        showAlert('Error', 'Hubo un problema al intentar iniciar sesión.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ==========================================
  // DISEÑO VISUAL (RENDER CONEXIÓN / LOADING)
  // ==========================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin"></div>
          <p className="text-brand-muted font-medium animate-pulse">Cargando tu universo...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // DISEÑO VISUAL PRINCIPAL (JSX RENDER)
  // ==========================================
  return (
    <div className="min-h-screen bg-brand-bg font-sans text-brand-text selection:bg-brand-primary/30 selection:text-brand-text transition-colors duration-300">
      <Navbar onExitLocalMode={handleExitLocalMode} isLocalMode={isLocalMode} />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* CASO A: Pantalla de Bienvenida (Sin Autenticar / Sin Modo Local activo) */}
        {!user && !isLocalMode ? (
          <div className="max-w-4xl mx-auto mt-32 text-center space-y-12">
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex p-4 bg-brand-primary/10 rounded-3xl text-brand-primary mb-4"
              >
                <img src="/logo.png" alt="Logo Grande" className="w-16 h-16 object-contain" />
              </motion.div>

              <h1 className="text-6xl font-black text-brand-text tracking-tight leading-none">
                Novel
              </h1>
              <p className="text-xl text-brand-muted max-w-2xl mx-auto leading-relaxed">
                Construye tus mundos, Novel te ayudará a desarrollarlos y analizarlos.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!showSyncOptions ? (
                <button
                  onClick={() => setShowSyncOptions(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-6 px-12 py-5 bg-brand-primary text-zinc-950 rounded-3xl hover:bg-brand-secondary transition-all font-black shadow-2xl shadow-brand-primary/20 group active:scale-95 cursor-pointer"
                >
                  COMENZAR EXPANSIÓN
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <button
                    onClick={handleEnterLocalMode}
                    className="flex flex-col items-center gap-2 px-8 py-6 bg-brand-card border border-brand-border text-brand-text rounded-3xl hover:bg-brand-primary/10 transition-all font-bold shadow-xl group w-48 cursor-pointer"
                  >
                    <Monitor className="w-8 h-8 text-brand-primary group-hover:rotate-12 transition-transform mb-2" />
                    <span>MODO LOCAL</span>
                    <span className="text-[10px] text-brand-muted font-medium">(Tus archivos en tu PC)</span>
                  </button>
                  <button
                    onClick={login}
                    className="flex flex-col items-center gap-2 px-8 py-6 bg-brand-primary text-zinc-950 rounded-3xl hover:bg-brand-secondary transition-all font-bold shadow-xl shadow-brand-primary/20 w-48 cursor-pointer"
                  >
                    <Cloud className="w-8 h-8 text-zinc-950/60 mb-2" />
                    <span>GOOGLE DRIVE</span>
                    <span className="text-[10px] text-zinc-950/60 font-medium">(Sincronizado en la nube)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (

          /* CASO B: Panel Principal de Novelas (Autenticado o en Modo Local activo) */
          <AnimatePresence mode="wait">
            {!selectedNovel ? (
              // Ver Lista completa de Novelas creadas
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <NovelList onSelect={setSelectedNovel} isLocalMode={isLocalMode} />
              </motion.div>
            ) : (
              // Ver Detalle e interfaces interactivas de una Novela seleccionada
              <motion.div
                key="view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <NovelView
                  novel={selectedNovel}
                  onBack={() => setSelectedNovel(null)}
                  isLocalMode={isLocalMode}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}