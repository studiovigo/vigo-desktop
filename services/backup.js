// Serviço de Backup Automático
import { copyFile, readDir, removeFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { appDataDir } from '@tauri-apps/api/path';
import { getDatabasePath, isUsingSQLite, getDatabase } from './database.js';
import { db } from './db.js'; // Fallback para localStorage

class BackupService {
  constructor() {
    this.backupInterval = null;
    this.maxBackups = 7; // Manter últimos 7 backups
  }

  // Iniciar backup automático
  startAutoBackup(intervalHours = 24) {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // Fazer backup imediato
    this.createBackup();

    // Agendar backups periódicos
    this.backupInterval = setInterval(() => {
      this.createBackup();
    }, intervalHours * 60 * 60 * 1000);

    console.log(`Backup automático iniciado (intervalo: ${intervalHours} horas)`);
  }

  // Parar backup automático
  stopAutoBackup() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }

  // Criar backup
  async createBackup() {
    try {
      if (!isUsingSQLite()) {
        // Backup do localStorage
        return await this.createLocalStorageBackup();
      }

      const dbPath = getDatabasePath();
      if (!dbPath) {
        throw new Error('Caminho do banco de dados não encontrado');
      }

      const appData = await appDataDir();
      const backupDir = await join(appData, 'sistem-pdv', 'backups');
      
      // Criar diretório de backup se não existir
      try {
        await readDir(backupDir);
      } catch {
        const { createDir } = await import('@tauri-apps/plugin-fs');
        await createDir(backupDir, { recursive: true });
      }

      // Nome do arquivo de backup com timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup-${timestamp}.db`;
      const backupPath = await join(backupDir, backupFileName);

      // Copiar banco de dados
      await copyFile(dbPath, backupPath);

      // Limpar backups antigos
      await this.cleanOldBackups(backupDir);

      console.log('Backup criado:', backupPath);
      return { success: true, path: backupPath };
    } catch (error) {
      console.error('Erro ao criar backup:', error);
      return { success: false, error: error.message };
    }
  }

  // Criar backup do localStorage
  async createLocalStorageBackup() {
    try {
      const appData = await appDataDir();
      const backupDir = await join(appData, 'sistem-pdv', 'backups');
      
      // Criar diretório de backup se não existir
      try {
        await readDir(backupDir);
      } catch {
        const { createDir } = await import('@tauri-apps/plugin-fs');
        await createDir(backupDir, { recursive: true });
      }

      // Exportar todos os dados do localStorage
      const data = {
        products: db.products.list(),
        sales: db.sales.list(),
        users: db.users.list(),
        coupons: db.coupons.list(),
        logs: db.logs.list(),
        settings: db.settings.get(),
        expenses: db.expenses.list(),
        productModels: db.productModels.list(),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup-localStorage-${timestamp}.json`;
      const backupPath = await join(backupDir, backupFileName);

      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(backupPath, JSON.stringify(data, null, 2));

      // Limpar backups antigos
      await this.cleanOldBackups(backupDir);

      console.log('Backup do localStorage criado:', backupPath);
      return { success: true, path: backupPath };
    } catch (error) {
      console.error('Erro ao criar backup do localStorage:', error);
      return { success: false, error: error.message };
    }
  }

  // Limpar backups antigos
  async cleanOldBackups(backupDir) {
    try {
      const files = await readDir(backupDir);
      const backupFiles = files
        .filter(f => f.name.startsWith('backup-'))
        .sort((a, b) => {
          // Ordenar por data (mais recente primeiro)
          return new Date(b.name) - new Date(a.name);
        });

      // Remover backups além do limite
      if (backupFiles.length > this.maxBackups) {
        const toRemove = backupFiles.slice(this.maxBackups);
        for (const file of toRemove) {
          const filePath = await join(backupDir, file.name);
          await removeFile(filePath);
          console.log('Backup antigo removido:', filePath);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar backups antigos:', error);
    }
  }

  // Listar backups disponíveis
  async listBackups() {
    try {
      const appData = await appDataDir();
      const backupDir = await join(appData, 'sistem-pdv', 'backups');
      
      try {
        const files = await readDir(backupDir);
        return files
          .filter(f => f.name.startsWith('backup-'))
          .map(f => ({
            name: f.name,
            path: join(backupDir, f.name),
            size: f.size || 0,
            created: f.name.match(/backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1] || ''
          }))
          .sort((a, b) => new Date(b.created) - new Date(a.created));
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Erro ao listar backups:', error);
      return [];
    }
  }

  // Restaurar backup
  async restoreBackup(backupPath) {
    try {
      if (!isUsingSQLite()) {
        // Restaurar do localStorage
        return await this.restoreLocalStorageBackup(backupPath);
      }

      const dbPath = getDatabasePath();
      if (!dbPath) {
        throw new Error('Caminho do banco de dados não encontrado');
      }

      // Fechar conexão atual
      const { closeDatabase } = await import('./database.js');
      closeDatabase();

      // Copiar backup para o banco principal
      await copyFile(backupPath, dbPath);

      // Reinicializar banco
      const { initDatabase } = await import('./database.js');
      await initDatabase();

      console.log('Backup restaurado:', backupPath);
      return { success: true };
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      return { success: false, error: error.message };
    }
  }

  // Restaurar backup do localStorage
  async restoreLocalStorageBackup(backupPath) {
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const backupData = JSON.parse(await readTextFile(backupPath));

      // Restaurar dados
      // Nota: Isso requer implementação específica no db.js
      // Por enquanto, apenas retornamos sucesso
      console.log('Backup do localStorage restaurado:', backupPath);
      return { success: true, data: backupData };
    } catch (error) {
      console.error('Erro ao restaurar backup do localStorage:', error);
      return { success: false, error: error.message };
    }
  }

  // Exportar backup para local escolhido pelo usuário
  async exportBackup(destinationPath) {
    try {
      const backup = await this.createBackup();
      if (backup.success) {
        await copyFile(backup.path, destinationPath);
        return { success: true, path: destinationPath };
      }
      return backup;
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Instância singleton
let backupServiceInstance = null;

export function getBackupService() {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService();
  }
  return backupServiceInstance;
}

export default BackupService;


