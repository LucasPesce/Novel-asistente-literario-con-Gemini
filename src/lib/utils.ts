import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ==========================================
// UTILERÍAS GLOBALES (GLOBAL UTILITIES)
// ==========================================

/**
 * Combina y concatena clases de CSS de forma dinámica utilizando 'clsx' 
 * y resuelve colisiones/conflictos de clases de Tailwind CSS usando 'twMerge'.
 * 
 * @param inputs - Lista de valores de clase (strings, objetos, booleanos, arreglos)
 * @returns Un string limpio con todas las clases resueltas y aplicadas
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un valor de fecha (string, número o Date) en un formato estandarizado
 * para el idioma español (es-ES), incluyendo día, mes abreviado, año, hora y minutos.
 * 
 * @param date - Fecha a formatear
 * @returns Un string formateado (ej. "3 de jun. de 2026, 22:02")
 */
export function formatDate(date: string | number | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}