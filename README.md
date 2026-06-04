<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🦉 Novel: Asistente Literario de IA | Luc Pesce

![Estado](https://img.shields.io/badge/Estado-Desarrollo-orange)
![React](https://img.shields.io/badge/React-19.x-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwindcss)
![Motion](https://img.shields.io/badge/Motion-12.x-f0189a?logo=framer)
![Firebase](https://img.shields.io/badge/Firebase-12.x-FFCA28?logo=firebase&logoColor=black)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.x-8E75C2?logo=googlegemini&logoColor=white)

Asistente de escritura y diseño literario inteligente. Novel analiza automáticamente los capítulos de tu manuscrito utilizando Inteligencia Artificial para extraer personajes, lugares, elementos de lore y tejer un mapa interactivo de relaciones, consolidando una Biblia de Mundo dinámica y escalable.

🌐 **[Ver Demo en Vivo](https://ai.studio/apps/c8e9c684-382d-4f6e-b1a7-4cde21fd9ac8)**

---

## 🚀 Características Principales

* **Arquitectura Local-First con Sincronización:** Diseñada bajo el paradigma de soberanía de datos. Permite trabajar de manera 100% local escribiendo archivos directamente en tu PC mediante la *File System Access API* [4], o sincronizar el progreso de forma remota en tu cuenta de *Google Drive* [5].
* **Extracción de Lore con IA:** Motor de análisis estructurado basado en la API de Gemini que extrae entidades, actualiza estados de personajes, recopila misterios/preguntas y registra descubrimientos a medida que avanzas en la lectura de manuscritos.
* **Mapa Estelar de Vínculos:** Renderizado interactivo 2D de relaciones personales y geográficas utilizando simulaciones físicas y fuerzas de colisión de *D3.js*.
* **Coach Literario Inteligente:** Chat conversacional continuo con la IA ("Chat con Novel") alimentado por el contexto en tiempo real de tu Biblia de Mundo para debatir consistencia de tramas, arcos de personajes y lluvia de ideas.
* **Seguridad y Costo Cero (BYOK):** Implementación de la arquitectura *Bring Your Own Key* (Trae tu propia clave). La app no almacena tus datos en servidores costosos de terceros; cada usuario ingresa su API Key de Gemini, la cual se gestiona de forma segura a nivel de cliente (`localStorage`).

---

## 🛠️ Stack Tecnológico

* **Core & Render:** React 19, TypeScript, Vite.
* **Procesamiento de IA:** Google Gen AI SDK (Gemini 3 Flash Preview).
* **Base de Datos & Auth:** Firebase Firestore, Firebase Authentication (Google Login).
* **Integración Cloud:** Google Drive v3 API (REST Multipart).
* **Persistencia Local:** File System Access API [4], IndexedDB (para persistir accesos de carpetas), localStorage (Caché rápida).
* **Visuales y Animaciones:** Tailwind CSS v4 [1], Motion (anteriormente Framer Motion), D3.js (Grafo de fuerzas), Mammoth (procesador DOCX), Lucide Icons, React Markdown.

---

## ⚙️ Instalación y Uso Local

Para clonar y ejecutar este proyecto en tu entorno de desarrollo local, sigue estos pasos:

### 1. Clonar el repositorio y acceder a la carpeta
```bash
git clone https://github.com/lucaspesce/Novel.git
cd Novel



### 2. Instalar dependencias
```bash
npm install

3. Configurar tu entorno de Firebase
Para que el login de Google y la sincronización funcionen, debes enlazar tu propio proyecto de Firebase:
Crea un proyecto en la .Consola de Firebase
Habilita (Proveedor Google) y AuthenticationFirestore Database (Modo de prueba).
Reemplaza los valores del archivo en la raíz con tus credenciales.firebase-applet-config.json
Modifica para conectar con tu base de datos principal (src/lib/firebase.tsgetFirestore(app)).

4. Habilitar Google Drive API (Opcional para sincronización)
Si deseas usar la sincronización con Google Drive:
Ve a tu proyecto gemelo en la .Google Cloud Console
Busca e instala la y haz clic en Google Drive APIHabilitar.

5. Iniciar el servidor local
### 2. Instalar dependencias
```bash
npm run dev

El servidor de desarrollo de Vite se ejecutará en .http://localhost:3000

🔑 Cómo comenzar a usar el Asistente
Una vez iniciada la aplicación en tu navegador local:
Configurar tu API Key de Gemini:
Haz clic en el ícono de la en la barra de navegación superior.Llave (🔑)
Consigue tu API Key gratuita en .Google AI Studio
Pégala en el prompt y presiona aceptar. La clave quedará guardada de forma segura en tu propio navegador.
Crear o Importar tu Novela:
Haz clic en para iniciar desde cero.Nueva Novela
Elige si deseas vincular una carpeta local en tu PC (Modo Local recomendado) o continuar usando la nube.
Escribir o Importar Manuscritos:
Crea un capítulo y copia tu texto, o importa un archivo o y deja que la IA lo separe por capítulos..docx.txt
Haz clic en en cualquier capítulo para ver cómo se genera y actualiza automáticamente tu enciclopedia del mundo."Analizar con Novel"

📁 Estructura del Proyecto
Breve desglose de la distribución de componentes y servicios del sistema:

src/
 ├── components/       # Componentes interactivos (Navbar, NovelList, NovelView, Graph, Chat)
 ├── services/         # Adaptadores de datos (storageService, localService, googleDriveService)
 ├── lib/              # Configuración y clientes de APIs (firebase, gemini, utils)
 ├── types.ts          # Esquemas de tipados estrictos e interfaces del sistema
 ├── main.tsx          # Punto de entrada de renderizado de la app
 └── index.css         # Configuración del tema y variables en Tailwind CSS v4

👨‍💻 Autor
Lucas Baquero Lazcano (Luc Pesce)
Analista en Sistemas | Frontend Developer
LinkedIn
