import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Handler global para ignorar erros de extensões do navegador
window.addEventListener('error', (event) => {
  // Ignorar erros de extensões do Firefox/Chrome
  const errorMessage = event.message?.toLowerCase() || '';
  const errorFilename = event.filename?.toLowerCase() || '';
  
  if (
    errorMessage.includes('moz-extension://') ||
    errorMessage.includes('chrome-extension://') ||
    errorMessage.includes('g_elementbeingmutationobserved') ||
    errorMessage.includes("can't access property") ||
    errorMessage.includes("cannot read property") ||
    errorMessage.includes('deref') ||
    errorMessage.includes('control') ||
    errorFilename.includes('moz-extension://') ||
    errorFilename.includes('chrome-extension://') ||
    errorFilename.includes('content_script.js')
  ) {
    event.preventDefault();
    event.stopPropagation();
    // Silenciar o erro (não logar no console)
    return false;
  }
}, true);

// Handler para Promise rejections de extensões
window.addEventListener('unhandledrejection', (event) => {
  const reason = (event.reason?.message || event.reason?.toString() || '').toLowerCase();
  if (
    reason.includes('moz-extension://') ||
    reason.includes('chrome-extension://') ||
    reason.includes('g_elementbeingmutationobserved') ||
    reason.includes("can't access property") ||
    reason.includes("cannot read property") ||
    reason.includes('deref') ||
    reason.includes('control') ||
    reason.includes('content_script')
  ) {
    event.preventDefault();
    return false;
  }
});

// Garantir que o elemento root existe
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Elemento root não encontrado!');
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
    );
  } catch (error) {
    console.error('Erro ao renderizar aplicação:', error);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6; padding: 20px;">
        <div style="background: white; padding: 32px; border-radius: 12px; max-width: 500px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 16px;">Erro ao Carregar Aplicação</h1>
          <p style="color: #6b7280; margin-bottom: 24px;">${error.message}</p>
          <button onclick="window.location.reload()" style="padding: 12px 24px; background: #d9b53f; color: white; border: none; border-radius: 999px; cursor: pointer; font-weight: 600;">
            Recarregar Página
          </button>
        </div>
      </div>
    `;
  }
}


