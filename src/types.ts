// =========================================================================
// 1. MODELOS DEL MANUSCRITO (NOVELA & CAPÍTULOS)
// =========================================================================

/**
 * Estructura de un proyecto de Novela
 */
export interface Novel {
  id: string;                                 // Identificador único (UUID o Firestore ID)
  title: string;                              // Título de la novela
  authorId: string;                           // ID del autor (Firebase Auth UID o 'local-user')
  createdAt: string;                          // Fecha de creación en formato ISO string
  updatedAt: string;                          // Fecha de última modificación en formato ISO string
  coverImage?: string;                        // Imagen de portada (Base64 string o URL)
  color?: string;                             // Color de fondo para la tarjeta de interfaz
  status?: 'En Desarrollo' | 'Finalizada';    // Estado operativo del manuscrito
  chapterCount?: number;                      // Contador optimizado del total de capítulos
  chapters?: Chapter[];                       // Lista opcional de capítulos (Caché local)
  entities?: WorldEntity[];                   // Lista opcional de fichas del mundo (Caché local)
  relationships?: Relationship[];             // Lista opcional de relaciones (Caché local)
  deletedAt?: string;
}

/**
 * Estructura de un capítulo o manuscrito individual
 */
export interface Chapter {
  id: string;                                 // ID único del capítulo
  novelId: string;                            // ID de la novela a la que pertenece
  title: string;                              // Título del capítulo o prólogo
  content: string;                            // Cuerpo o texto completo del capítulo
  chapterNumber: number;                      // Orden del capítulo (el Prólogo es el número 0)
  createdAt: string;                          // Fecha de creación en formato ISO string
  updatedAt: string;                          // Fecha de actualización en formato ISO string
  analyzed?: boolean;                         // Flag para indicar si la IA ya procesó el capítulo
  deletedAt?: string;                         // Guardará la fecha de borrado lógico

}

// =========================================================================
// 2. MODELOS DE LA ENCICLOPEDIA (MUNDO & LORE)
// =========================================================================

/**
 * Categorías válidas de fichas para la enciclopedia del mundo
 */
export type EntityType = 'character' | 'location' | 'lore';

/**
 * Ficha de la enciclopedia de mundo (Entidad)
 */
export interface WorldEntity {
  id: string;                                 // ID único de la ficha
  novelId: string;                            // ID de la novela asociada
  name: string;                               // Nombre del personaje, lugar o concepto de lore
  type: EntityType;                           // Categoría de la entidad
  summary: string;                            // Resumen descriptivo (Soporta Markdown)
  openQuestions?: string;                     // Preguntas abiertas/misterios sin resolver (IA)
  resolvedQuestions?: string;                 // Misterios resueltos a lo largo de la obra
  isTypeLocked?: boolean;                     // Bloquea el tipo para evitar que la IA lo cambie
  lastUpdatedChapterId?: string;              // ID del último capítulo donde apareció la entidad
  lastUpdatedChapterTitle?: string;           // Título del último capítulo donde apareció
  firstUpdatedChapterId?: string;             // ID del capítulo donde se creó/apareció primero
  firstUpdatedChapterTitle?: string;          // Título del capítulo de primera aparición
  updatedAt: string;                          // Fecha de última actualización de la ficha
  status?: string;                            // Estado situacional (ej: 'Vivo', 'Muerto', 'Destruido')
  tags?: string[];                            // Etiquetas descriptivas secundarias
  headerColor?: string;                       // Color hexadecimal de la cabecera de la ficha
  imageUrl?: string;                          // Foto/Avatar de la ficha (Base64 o URL)
}

// =========================================================================
// 3. MODELOS DE VÍNCULOS (RELACIONES)
// =========================================================================

/**
 * Conector físico o situacional entre dos entidades de la enciclopedia
 */
export interface Relationship {
  id: string;                                 // ID único del vínculo
  novelId: string;                            // ID de la novela asociada
  sourceId: string;                           // ID de la entidad origen (Foco)
  targetId: string;                           // ID de la entidad destino (Orbita)
  sourceName: string;                         // Nombre de la entidad origen (Desnormalizado para D3)
  targetName: string;                         // Nombre de la entidad destino (Desnormalizado para D3)
  relationType: string;                       // Tipo de relación (ej: 'Aliado', 'Gobernante de', 'Nacido en')
  description: string;                        // Contexto o descripción breve del vínculo
  isUserDefined?: boolean;                    // Indica si el vínculo fue creado o confirmado por el usuario
  isPending?: boolean;                        // Indica si requiere confirmación del usuario tras ser hallada por IA
  updatedAt: string;                          // Fecha de última actualización del vínculo
}

// =========================================================================
// 4. MODELOS DE TRANSFERENCIA (AI DTO)
// =========================================================================

/**
 * Estructura de transferencia de datos (DTO) enviada por Gemini al analizar un texto
 */
export interface AnalysisResult {
  entities: {
    name: string;
    type: EntityType;
    summary: string;
    openQuestions: string;
    resolvedQuestions?: string;
    status?: string;
  }[];
  relationships: {
    source: string;
    target: string;
    type: string;
    description: string;
  }[];
}
