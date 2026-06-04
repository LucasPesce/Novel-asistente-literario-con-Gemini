import { useState, useRef, useEffect } from 'react';
import { WorldEntity, Chapter } from '../types';
import { getAIClient } from '../lib/gemini';
import { Send, User, Bot, Loader2, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface WorldChatProps {
  entities: WorldEntity[];
  chapters: Chapter[];
  novelTitle: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function WorldChat({ entities, chapters, novelTitle }: WorldChatProps) {
  // ==========================================
  // ESTADOS Y REFERENCIAS (STATES & REFS)
  // ==========================================
  
  // Mensaje de bienvenida inicial (configurado con la personalidad de "Chat con Novel")
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `¡Hola, creador/a! 👋 Soy **Chat con Novel**, tu compañero de locuras literarias para "${novelTitle}". He husmeado en tu Biblia del Mundo (con permiso, ¡claro!) y estoy listo para echarte una mano. Prepárate para una ración de honestidad brutal pero cariñosa, algún que otro chiste malo para romper el hielo y, sobre todo, muchas ganas de que tu historia sea épica. ¿Qué drama o misterio vamos a desentrañar hoy?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // EFECTOS (EFFECTS)
  // ==========================================
  
  // Mantiene el scroll en la parte inferior automáticamente al recibir o enviar mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ==========================================
  // MANEJADORES DE EVENTOS (HANDLERS)
  // ==========================================

  /**
   * Gestiona el envío del mensaje del usuario a la API de Chat de Gemini.
   * Configura las instrucciones de sistema (System Instructions) inyectando la base
   * de datos completa del mundo literario y el historial secuencial de la conversación.
   */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const ai = getAIClient();
      
      // Inyección de contexto de la enciclopedia de la novela como directriz de sistema
      const systemInstruction = `
        PROYECTO: ${novelTitle}
        PERSONAJES Y LUGARES: ${JSON.stringify(entities.map(e => ({
          name: e.name,
          type: e.type,
          summary: e.summary,
          status: e.status,
          misterios_pendientes: e.openQuestions,
          misterios_resueltos: e.resolvedQuestions
        })))}
        RESUMEN DE CAPÍTULOS: ${chapters.map(c => `Cap ${c.chapterNumber}: ${c.title}`).join(', ')}
        
        INSTRUCCIONES PARA LA IA (Chat con Novel):
        Eres un compañero de escritura inteligente, EMPÁTICO, AMABLE y con un SENTIDO DEL HUMOR chispeante.
        - TU PERSONALIDAD: Eres alegre, haces bromas inteligentes y usas un tono cercano (puedes usar emojis con moderación). No eres una máquina fría, eres un amigo que ama las buenas historias.
        - TU OBJETIVO: Ayudar al autor a llegar a un resultado "congruente y satisfactorio".
        - BALANCE: Debes señalar tanto las FORTALEZAS como las DEBILIDADES.
        - CRÍTICA CONSTRUCTIVA: Si encuentras una falla, señala el error con humor pero ofrece siempre una sugerencia creativa para arreglarlo. No seas condescendiente, sé motivador.
        - EVITA EL BLOQUEO: Si algo está perfecto, ¡haz una fiesta! Dile al autor que ha dado en el clavo y que esa parte ya brilla por sí sola.
        - EVOLUCIÓN: A medida que el autor pule su mundo, celebra su progreso y dile que cada vez te lo pones más difícil para encontrar fallos.
        - Usa Markdown para resaltar nombres o términos importantes.
      `;

      // Inicialización del flujo conversacional con historial en formato Gemini SDK
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: systemInstruction
        },
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      });

      const result = await chat.sendMessage({ message: userMsg });
      const responseText = result.text || '';
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error: any) {
      console.error('Chat Error:', error);
      if (error.message === 'API_KEY_MISSING') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ **Falta la API Key de Gemini.** Por favor, configúrala en el menú superior (el ícono de la llave 🔑) para poder hablar conmigo.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, hubo un error al procesar tu consulta. Reintenta en un momento.' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // DISEÑO VISUAL (RENDER)
  // ==========================================
  return (
    <div className="flex flex-col h-[700px] bg-[#1a1715] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
      
      {/* Cabecera del Chat */}
      <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#9a7b4f]/10 p-2 rounded-xl">
            <Sparkles className="w-5 h-5 text-[#9a7b4f]" />
          </div>
          <div>
            <h3 className="font-bold text-[#e8e4df]">Chat con Novel</h3>
            <p className="text-[10px] text-[#6d5a4a] font-black uppercase tracking-widest">Amable, Divertido y Constructivo</p>
          </div>
        </div>
      </div>

      {/* Historial de la Conversación */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0e0d0c]">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-4 max-w-[85%]", m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto")}>
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
              m.role === 'user' ? "bg-[#9a7b4f] border-[#9a7b4f] text-[#f3f0eb]" : "bg-white/5 border-white/10 text-[#9a7b4f]"
            )}>
              {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div className={cn(
              "p-4 rounded-3xl text-sm leading-relaxed shadow-sm",
              m.role === 'user' ? "bg-[#9a7b4f] text-[#f3f0eb]" : "bg-[#1a1715] border border-white/5 text-[#b0a89e]"
            )}>
              <div className={cn("markdown-body prose prose-sm", m.role === 'user' ? "prose-invert" : "prose-invert text-[#b0a89e]")}>
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        
        {/* Indicador de carga conversacional (Pensando...) */}
        {isLoading && (
          <div className="flex gap-4 mr-auto animate-pulse">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#9a7b4f]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div className="bg-[#1a1715] border border-white/5 p-4 rounded-3xl text-[#6d5a4a] text-sm">
              Analizando tu universo...
            </div>
          </div>
        )}
      </div>

      {/* Formulario de Entrada de Texto */}
      <form onSubmit={handleSend} className="p-6 bg-[#0e0d0c] border-t border-white/5">
        <div className="relative">
          <input
            type="text"
            value={input}
            title="Escribir mensaje"
            aria-label="Escribir mensaje para Novel"
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre la trama, personajes o consistencia..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-[#e8e4df] focus:outline-none focus:ring-2 focus:ring-[#9a7b4f]/20 placeholder:text-[#6d5a4a] text-sm"
          />
          <button
            type="submit"
            title="Enviar mensaje"
            aria-label="Enviar mensaje"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 bottom-2 px-4 bg-[#9a7b4f] text-[#f3f0eb] rounded-xl hover:bg-[#866a43] disabled:opacity-50 transition-all font-bold"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

    </div>
  );
}