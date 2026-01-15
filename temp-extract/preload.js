// preload.js
// Este arquivo é executado antes que o conteúdo da página seja carregado
// Ele fornece uma ponte segura entre o processo de renderização e o processo principal

const { contextBridge } = require('electron');

// Expõe APIs seguras para o processo de renderização
contextBridge.exposeInMainWorld('electronAPI', {
  // Adicione aqui APIs que você queira expor de forma segura
  // Por exemplo:
  // getVersion: () => process.versions.electron,
  // platform: process.platform
});

