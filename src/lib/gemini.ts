import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Chapter, WorldEntity } from "../types";

// ==========================================
// PROPS / INTERFACES
// ==========================================

/**
 * Estructura del reporte literario final generado por la IA al concluir la obra
 */
export interface FinalReport {
  characterSummaries: { name: string; outcome: string; evolution: string }[];
  locationSummaries: {
    name: string;
    state: string;
    conflictStatus: string;
    resolution: string;
  }[];
  writerFeedback: {
    evolution: string;
    styleAnalysis: string;
    profile: string;
    strengths: string[];
    areasForImprovement: string[];
  };
}

/**
 * Estructura para la segmentación automática de un texto masivo en capítulos
 */
export interface SplitResult {
  chapters: { title: string; content: string }[];
}

// ==========================================
// CLIENTE IA (BYOK - BRING YOUR OWN KEY)
// ==========================================

/**
 * Instancia y devuelve dinámicamente un cliente del SDK de Google Gen AI.
 * Prioriza la clave guardada en el navegador del usuario (BYOK) antes de
 * recurrir a la variable de entorno local.
 */
export function getAIClient() {
  const apiKey =
    localStorage.getItem("user_gemini_api_key") ||
    process.env.GEMINI_API_KEY ||
    "";
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
}

// ==========================================
// SERVICIOS DE IA (CORE FUNCTIONS)
// ==========================================

/**
 * Genera una crítica literaria exhaustiva y perfil del autor basados
 * en la recopilación total de capítulos y fichas del mundo.
 */
export async function generateFinalReport(
  novelTitle: string,
  chapters: Chapter[],
  entities: WorldEntity[],
): Promise<FinalReport> {
  const ai = getAIClient();

  const prompt = `
    Eres un Crítico Literario de Élite y un Mentor de Escritores AI. La novela "${novelTitle}" ha finalizado y el autor espera tu devolución. 
    REGLA PRINCIPAL: DIRÍGETE AL AUTOR DIRECTAMENTE EN SEGUNDA PERSONA ("Tú", "Tu estilo", "Has logrado..."). Nunca hables de él en tercera persona.

    INFORMACIÓN DISPONIBLE (BASE DE DATOS DEL MUNDO Y MANUSCRITO):
    - Capítulos: ${chapters.map((c) => `Cap ${c.chapterNumber}: ${c.title}`).join(", ")}
    - Registros de Personajes, Lugares y Lore: ${JSON.stringify(
      entities.map((e) => ({
        name: e.name,
        type: e.type,
        summary: e.summary,
        status: e.status,
        tags: e.tags,
        misterios_resueltos: e.resolvedQuestions,
        misterios_pendientes: e.openQuestions,
      })),
    )}

    TU MISIÓN ES GENERAR UN REPORTE DE CIERRE MAGISTRAL:

    1. INVENTARIO FINAL DE PERSONAJES Y LUGARES (OBLIGATORIO): 
       Debes incluir a TODOS los personajes y lugares que figuran en los registros proporcionados. No omitas ninguno.
       - Para Personajes: Describe su "Outcome" final (destino definitivo) y su arco de transformación.
       - Para Lugares: Define su estado final y la resolución de cualquier conflicto geográfico o social asociado.

    2. PERFIL DE ESCRITOR (PROFUNDO Y DIRECTO):
       Toma toda la obra como evidencia para construir un perfil psicológico y técnico del usuario. HÁBLALE DE TÚ.
       - Describe su "Voz Narrativa" (ej: "Tienes una voz...").
       - Analiza su relación con el conflicto: ¿Confrontas a tus personajes o los proteges?
       - Define su estilo: ¿Eres minimalista, recargado, lírico, crudo?
       - Perfil: Crea una descripción extensa (mínimo 2 párrafos) sobre quién es como escritor, mirándolo directamente a los ojos.

    3. ANÁLISIS DE EVOLUCIÓN:
       Compara cómo empezó la narrativa y cómo terminó. ¿Hubo madurez en su estilo? (ej: "Empezaste con timidez, pero al final...").

    4. FORTALEZAS Y DESAFÍOS:
       Sé honesto y constructivo. Identifica 3 fortalezas claras y 3 áreas específicas donde puede subir de nivel en su siguiente obra. (ej: "Tus puntos fuertes son...").
    
    Adopta una personalidad de mentor literario prestigioso: cálido pero riguroso. Valora su esfuerzo por terminar el libro, pero no temas señalar la verdad artística.

    FORMATO DE RESPUESTA: JSON strictly following the schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          characterSummaries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                outcome: { type: Type.STRING },
                evolution: { type: Type.STRING },
              },
              required: ["name", "outcome", "evolution"],
            },
          },
          locationSummaries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                state: { type: Type.STRING },
                conflictStatus: { type: Type.STRING },
                resolution: { type: Type.STRING },
              },
              required: ["name", "state", "conflictStatus", "resolution"],
            },
          },
          writerFeedback: {
            type: Type.OBJECT,
            properties: {
              evolution: { type: Type.STRING },
              styleAnalysis: { type: Type.STRING },
              profile: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              areasForImprovement: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "evolution",
              "styleAnalysis",
              "profile",
              "strengths",
              "areasForImprovement",
            ],
          },
        },
        required: ["characterSummaries", "locationSummaries", "writerFeedback"],
      },
    },
  });

  return JSON.parse(response.text || "{}") as FinalReport;
}

/**
 * Analiza un capítulo individual y extrae de forma estructurada entidades del mundo
 * (personajes, ubicaciones, lore) y sus relaciones geográficas o personales.
 */
export async function analyzeChapter(
  chapterContent: string,
  existingEntities: string = "Ninguna hasta ahora.",
  existingRelationships: string = "Ninguna hasta ahora.",
): Promise<AnalysisResult> {
  const ai = getAIClient();

  const prompt = `
    Eres un asistente experto para escritores de novelas. Tu tarea es analizar el capítulo proporcionado y extraer o actualizar información sobre el "World Bible" (Personajes, Lugares y Relaciones).

    CONTEXTO ACTUAL (Úsalo como base para NO repetir información y para EXTENDER lo que ya se sabe):
    - Entidades actuales: ${existingEntities}
    - Relaciones actuales: ${existingRelationships}

    NUEVO CAPÍTULO A ANALIZAR:
    ${chapterContent}

    INSTRUCCIONES CRÍTICAS:
    1. PERSONAJES: Identifica quiénes aparecen o son mencionados. Determina su ESTADO (Vivo, Muerto, Desaparecido, etc.). NOTA: Identifica su ORIGEN (de dónde vienen) y UBICACIÓN actual (dónde están).
    2. LUGARES: Identifica dónde ocurre la acción. Determina su ESTADO (En paz, En guerra, Destruido, etc.). NOTA: Identifica qué lugares están DENTRO de otros (ej: un castillo dentro de una ciudad, un pueblo dentro de un reino).
    3. DETALLES DEL MUNDO (Lore): Identifica rasgos del mundo, objetos o conceptos.
    4. CUESTIONES ABIERTAS: Nota misterios o preguntas que el capítulo plantea. Si algo de lo que estaba "Abierto" en el contexto actual se ha resuelto en este capítulo, indícalo explícitamente en 'resolvedQuestions' y NO lo incluyas en 'openQuestions'.
    5. RELACIONES: Identifica vínculos importantes. 
       CRÍTICO: Incluye relaciones geográficas y situacionales:
       - "Originario de" (Personaje -> Lugar)
       - "Ubicado en / Pertenece a" (Lugar -> Lugar)
       - "Visto en / Se encuentra en" (Personaje -> Lugar)
       - Además de las relaciones personales clásicas (Aliado, Enemigo, Familia).
    6. INTEGRACIÓN: Tu respuesta para entidades existentes debe ser un resumen ACUMULATIVO.
    
    PARA MISTERIOS/PREGUNTAS:
    - En 'openQuestions': Lista SOLO los misterios que siguen sin respuesta (incluyendo los nuevos).
    - En 'resolvedQuestions': Lista SOLO aquellos misterios del contexto previo que se han aclarado en ESTE capítulo.

    FORMATO DE RESPUESTA:
    Devuelve estrictamente un objeto JSON con campos:
    entities: [{ name, type, summary, status, openQuestions }]
    relationships: [{ source, target, type, description }]
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                  enum: ["character", "location", "lore"],
                },
                summary: {
                  type: Type.STRING,
                  description:
                    "Resumen detallado de lo que se sabe hasta ahora.",
                },
                status: {
                  type: Type.STRING,
                  description:
                    "Estado actual (Vivo, Muerto, En guerra, Objeto: Funcional, Perdido, etc.)",
                },
                openQuestions: {
                  type: Type.STRING,
                  description: "Lista de misterios o preguntas sin resolver.",
                },
                resolvedQuestions: {
                  type: Type.STRING,
                  description:
                    "Misterios que se han resuelto en este capítulo.",
                },
              },
              required: ["name", "type", "summary", "status", "openQuestions"],
            },
          },
          relationships: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: {
                  type: Type.STRING,
                  description: "Nombre del personaje o lugar de origen.",
                },
                target: {
                  type: Type.STRING,
                  description: "Nombre del personaje o lugar de destino.",
                },
                type: {
                  type: Type.STRING,
                  description:
                    "Tipo de vínculo (ej: Padre, Amigo, Enemigo, Gobernante de).",
                },
                description: {
                  type: Type.STRING,
                  description: "Contexto adicional del vínculo.",
                },
              },
              required: ["source", "target", "type", "description"],
            },
          },
        },
        required: ["entities", "relationships"],
      },
    },
  });

  const text = response.text || "{}";
  return JSON.parse(text) as AnalysisResult;
}

/**
 * Segmenta de forma automática un manuscrito masivo o archivo importado
 * dividiéndolo de manera lógica en capítulos discretos con sus respectivos títulos sugeridos.
 */
export async function splitIntoChapters(
  fullText: string,
): Promise<SplitResult> {
  const prompt = `
    Eres un asistente editorial altamente capacitado. He recibido un manuscrito largo que necesito dividir en capítulos lógicos.
    
    INSTRUCCIONES:
    1. Analiza el siguiente texto y detecta dónde comienza y termina cada capítulo.
    2. Usa marcadores de texto (como "Capítulo", "Capitulo", secciones numeradas, o cambios drásticos de escena) para identificar las divisiones.
    3. Si no hay títulos explícitos, intenta inventar un título corto y descriptivo basándote en el contenido de cada sección detectada.
    4. Devuelve un objeto JSON con una lista de capítulos, cada uno con 'title' y 'content'.
    
    TEXTO DEL MANUSCRITO:
    ${fullText.slice(0, 50000)} // Limit to avoid token issues, though 5.0 flash handles more, let's stay safe
  `;

  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ["title", "content"],
            },
          },
        },
        required: ["chapters"],
      },
    },
  });

  const text = response.text || '{"chapters": []}';
  return JSON.parse(text) as SplitResult;
}