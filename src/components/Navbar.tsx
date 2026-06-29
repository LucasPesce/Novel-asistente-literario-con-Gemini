import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useState } from 'react';
import { User, Orbit, Key } from 'lucide-react';
import { useDialog } from '../components/DialogContext';

// ==========================================
// INTERFACES & PROPS
// ==========================================
interface NavbarProps {
  isLocalMode?: boolean;
  onExitLocalMode?: () => void;
}

export default function Navbar({ isLocalMode, onExitLocalMode }: NavbarProps) {
  // ==========================================
  // ESTADOS (STATES)
  // ==========================================
  const [user] = useAuthState(auth);

  // Estado para verificar si el usuario tiene un token de Drive guardado localmente
  const [isDriveConnected] = useState(!!localStorage.getItem('google_drive_token'));
  const { showAlert, showPrompt } = useDialog();
  // ==========================================
  // MANEJADORES DE EVENTOS (HANDLERS)
  // ==========================================

  /**
   * Abre un prompt para que el usuario configure su propia API Key de Gemini
   * y la guarda de manera segura en el almacenamiento de su navegador.
   */
const handleSetApiKey = () => {
    const currentKey = localStorage.getItem('user_gemini_api_key') || '';
    showPrompt(
      'Configurar Gemini AI',
      'Ingresa tu API Key de Google Gemini (consíguela gratis en aistudio.google.com). Se guardará de forma segura en tu navegador:',
      currentKey,
      'Guardar Llave',
      (newKey) => {
        if (newKey.trim()) {
          localStorage.setItem('user_gemini_api_key', newKey.trim());
          showAlert('Clave Guardada', 'Tu API Key ha sido configurada con éxito.', true);
        }
      }
    );
  };

  /**
   * Cierra la sesión activa de Firebase Authentication
   */
  const logout = () => signOut(auth);

  // ==========================================
  // DISEÑO VISUAL (RENDER)
  // ==========================================
  return (
    <nav className="border-b border-brand-border bg-brand-card/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          {/* Logo y Nombre de la Aplicación */}
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Novel Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-brand-text">
              Novel
            </span>
          </div>

          <div className="flex items-center gap-4">

            {/* BOTÓN API KEY */}
            <button
              onClick={handleSetApiKey}
              className="p-2 text-brand-muted hover:text-brand-primary transition-colors cursor-pointer"
              title="Configurar API Key de Gemini"
              aria-label="Configurar API Key de Gemini"
            >
              <Key className="w-5 h-5" />
            </button>

            {/* Indicador de Google Drive (Solo en Modo Local sincronizado) */}
            {isLocalMode && isDriveConnected && (
              <div className="flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-full text-[10px] font-bold uppercase tracking-widest animate-in fade-in zoom-in duration-300">
                <Orbit className="w-3 h-3 animate-pulse" />
                <span className="hidden sm:inline">Drive Activo</span>
              </div>
            )}

            {/* Sección de Usuario / Botón Salir */}
            {(user || isLocalMode) ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-brand-muted">
                  {!isLocalMode && (
                    <>
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline">{user?.displayName}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={isLocalMode ? onExitLocalMode : logout}
                  className="px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-primary transition-colors cursor-pointer"
                >
                  Salir
                </button>
              </div>
            ) : null}

          </div>
        </div>
      </div>
    </nav>
  );
}