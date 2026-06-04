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

// ==========================================
// COMPONENTE PRINCIPAL (APPLICATION ROOT)
// ==========================================
export default function App() {
  // ==========================================
  // ESTADOS (STATES)
  // ==========================================
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
      const proceed = confirm('No se pudo acceder a una carpeta local (posiblemente por restricciones del navegador o de la vista previa).\n\n¿Deseas continuar en MODO LOCAL usando solo el almacenamiento del navegador?\n(Tus datos no se guardarán como archivos en tu PC, pero se mantendrán en este navegador)');
      if (proceed) {
        setIsLocalMode(true);
        localStorage.setItem('novel_app_mode', 'local');
      }
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
        alert('¡Google Drive vinculado con éxito!');
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        alert('El navegador bloqueó la ventana emergente. Por favor, actívala para poder ingresar.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log('Login popup cancelled');
      } else {
        console.error('Error de autenticación:', error);
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
      <div className="min-h-screen flex items-center justify-center bg-[#0e0d0c]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/5 border-t-[#9a7b4f] rounded-full animate-spin"></div>
          <p className="text-[#6d5a4a] font-medium animate-pulse">Cargando tu universo...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // DISEÑO VISUAL PRINCIPAL (JSX RENDER)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0e0d0c] font-sans text-[#e8e4df] selection:bg-[#9a7b4f]/30 selection:text-[#f3f0eb]">
      <Navbar onExitLocalMode={handleExitLocalMode} isLocalMode={isLocalMode} />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* CASO A: Pantalla de Bienvenida (Sin Autenticar / Sin Modo Local activo) */}
        {!user && !isLocalMode ? (
          <div className="max-w-4xl mx-auto mt-32 text-center space-y-12">
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex p-4 bg-[#9a7b4f]/10 rounded-3xl text-[#9a7b4f] mb-4"
              >
                <img src="/logo.png" alt="Logo Grande" className="w-16 h-16 object-contain" />
              </motion.div>

              <h1 className="text-6xl font-black text-[#e8e4df] tracking-tight leading-none">
                Novel
              </h1>
              <p className="text-xl text-[#b0a89e] max-w-2xl mx-auto leading-relaxed">
                Construye tus mundos, Novel te ayudará a desarrollarlos y analizarlos.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!showSyncOptions ? (
                <button
                  onClick={() => setShowSyncOptions(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-6 px-12 py-5 bg-[#9a7b4f] text-[#f3f0eb] rounded-3xl hover:bg-[#866a43] transition-all font-black shadow-2xl shadow-[#9a7b4f]/20 group active:scale-95"
                >
                  COMENZAR EXPANSIÓN
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <button
                    onClick={handleEnterLocalMode}
                    className="flex flex-col items-center gap-2 px-8 py-6 bg-[#1a1715] border border-white/10 text-[#e8e4df] rounded-3xl hover:bg-[#251f1c] transition-all font-bold shadow-xl group w-48"
                  >
                    <Monitor className="w-8 h-8 text-[#9a7b4f] group-hover:rotate-12 transition-transform mb-2" />
                    <span>MODO LOCAL</span>
                    <span className="text-[10px] text-[#6d5a4a] font-medium">(Tus archivos en tu PC)</span>
                  </button>
                  <button
                    onClick={login}
                    className="flex flex-col items-center gap-2 px-8 py-6 bg-[#9a7b4f] text-white rounded-3xl hover:bg-[#866a43] transition-all font-bold shadow-xl shadow-[#9a7b4f]/20 w-48"
                  >
                    <Cloud className="w-8 h-8 text-white/50 mb-2" />
                    <span>GOOGLE DRIVE</span>
                    <span className="text-[10px] text-white/40 font-medium">(Sincronizado en la nube)</span>
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