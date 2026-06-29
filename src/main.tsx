import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DialogProvider } from '../src/components/DialogContext.tsx'; 
import './index.css';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <DialogProvider>  
        <App />
      </DialogProvider>
    </StrictMode>,
  );
}