import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// =========================================================================
// PUNTO DE ENTRADA DE LA APLICACIÓN (ENTRY POINT)
// =========================================================================

// Busca el elemento contenedor con el ID 'root' en el index.html [2]
const container = document.getElementById('root');

// Validamos que el contenedor exista en el DOM (el operador '!' asume que sí existe [2],
// pero aquí lo procesamos con buenas prácticas para inicializarlo de manera segura)
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}