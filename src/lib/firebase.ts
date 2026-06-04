import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// ==========================================
// INICIALIZACIÓN DE SERVICIOS (FIREBASE INIT)
// ==========================================
const app = initializeApp(firebaseConfig);

// Instancia global de la base de datos Firestore (Por defecto)
export const db = getFirestore(app);

// Instancia global del sistema de autenticación
export const auth = getAuth(app);

// Proveedores de autenticación mediante Google OAuth
export const googleProvider = new GoogleAuthProvider();
export const driveProvider = new GoogleAuthProvider();

// Configuración de alcances (Scopes) requeridos para la integración con Google Drive
driveProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveProvider.addScope('https://www.googleapis.com/auth/drive.install');

// ==========================================
// TIPOS E INTERFACES DE DIAGNÓSTICO
// ==========================================

/**
 * Enumeración para clasificar los tipos de operaciones que fallan en Firestore
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Estructura del reporte detallado de un fallo en la base de datos
 */
interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

// ==========================================
// UTILERÍA DE CONTROL DE ERRORES (ERROR HANDLING)
// ==========================================

/**
 * Centraliza y formatea los fallos generados durante operaciones de Firestore.
 * Imprime un JSON detallado en la consola y lanza una excepción estructurada
 * para facilitar el diagnóstico del desarrollador.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}