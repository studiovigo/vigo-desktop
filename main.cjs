const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let backendProcess;
let mainWindow;

// Função para verificar se o backend está rodando
function checkBackendHealth(maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      // Tenta conectar na porta 8080 - se conseguir, o backend está rodando
      const req = http.get('http://localhost:8080', (res) => {
        // Qualquer resposta significa que o servidor está rodando
        resolve(true);
      });
      
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Backend não iniciou a tempo'));
        } else {
          setTimeout(check, 1000);
        }
      });
      
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error('Backend não iniciou a tempo'));
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });
}

function createWindow() {
  // Cria a janela do navegador
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    // icon: path.join(__dirname, 'imag', 'ICONE SISTEMA.png'), // Comentado temporariamente se causar erro
    title: 'LB Brand - Sistema PDV',
    show: false // Não mostra até estar pronto
  });

  // Carrega o aplicativo
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    // Em desenvolvimento, aponta para o servidor de desenvolvimento
    mainWindow.loadURL('http://localhost:5173');
    // Abre o DevTools em desenvolvimento
    mainWindow.webContents.openDevTools();
  } else {
    // Em produção, carrega os arquivos buildados
    const htmlPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Carregando HTML de:', htmlPath);
    mainWindow.loadFile(htmlPath).catch(err => {
      console.error('Erro ao carregar arquivo:', err);
    });
  }

  // Mostra a janela quando estiver pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
      mainWindow.focus();
  });

  // Trata erros de carregamento
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('Erro ao carregar:', errorCode, errorDescription);
    console.error('URL:', validatedURL);
    if (isMainFrame) {
      console.error('Falha ao carregar página principal');
    }
  });

  // Log de console do renderer para debug
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}]:`, message);
  });

  // Log de erros do renderer
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Error ${errorCode}]:`, errorDescription);
    console.error('URL:', validatedURL);
  });

  // REMOVIDO: DevTools não abre mais automaticamente em produção
  // DevTools só pode ser aberto manualmente pelo desenvolvedor (Ctrl+Shift+I / Cmd+Alt+I)
  // Comportamento consistente em modo desenvolvimento, produção e versões empacotadas
  
  // Listener para erros de JavaScript
  mainWindow.webContents.on('unresponsive', () => {
    console.error('Janela ficou não responsiva');
  });
  
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderizador crashou');
  });
}

function startBackend() {
  // Em desenvolvimento, não inicia o backend (assume que já está rodando)
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    console.log('Modo desenvolvimento: assumindo que o backend já está rodando');
    return Promise.resolve();
  }

  // Em produção, inicia o backend
  // process.resourcesPath aponta para a pasta de recursos do Electron
  const backendPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'app', 'backend.jar')
    : path.join(__dirname, '..', 'backend', 'target', 'sistem-pdv-api-1.0.0.jar');
  
  // Verifica se o JAR existe
  if (!fs.existsSync(backendPath)) {
    console.error('Backend JAR não encontrado em:', backendPath);
    return Promise.reject(new Error('Backend JAR não encontrado'));
  }

  console.log('Iniciando backend em:', backendPath);

  // Inicia o servidor Java
  backendProcess = spawn('java', ['-jar', backendPath], {
    cwd: path.dirname(backendPath),
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('error', (error) => {
    console.error('Erro ao iniciar backend:', error);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend finalizado com código ${code}`);
  });

  // Aguarda o backend estar pronto (máximo 30 segundos)
  return checkBackendHealth(30).catch((error) => {
    console.error('Backend não iniciou:', error);
    // Continua mesmo assim, pode ser que o backend já esteja rodando
  });
}

// Quando o Electron estiver pronto
app.whenReady().then(() => {
  // Cria a janela imediatamente (não espera pelo backend)
  createWindow();
    
  // Inicia o backend em paralelo (apenas em produção)
  if (app.isPackaged) {
    startBackend().catch(err => {
      console.warn('Backend não iniciou, mas continuando:', err.message);
    });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Finaliza o backend quando todas as janelas forem fechadas
app.on('window-all-closed', function () {
  if (backendProcess) {
    console.log('Finalizando processo do backend...');
    backendProcess.kill();
    backendProcess = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Garante que o processo do backend seja finalizado ao fechar o app
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Trata erros não capturados
process.on('uncaughtException', (error) => {
  console.error('Erro não capturado:', error);
});

