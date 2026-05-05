
import { driveService } from './driveService';
import { googleAuthService } from './googleAuth';
import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';

export class RestoreService {
  /**
   * Fetches the list of available backups from Drive
   */
  public async getAvailableBackups() {
    try {
      if (!googleAuthService.isConnected()) {
        throw new Error('Google Drive is not connected');
      }
      return await driveService.listBackups();
    } catch (e: any) {
      console.error('Failed to list backups:', e);
      throw e;
    }
  }

  /**
   * Downloads and restores a specific backup file
   */
  public async restoreBackup(fileId: string, event: Electron.IpcMainInvokeEvent) {
    const tempPath = path.join(app.getPath('temp'), `restore_${Date.now()}.db`);
    const dbPath = path.join(app.getPath('userData'), 'pos.db');
    const bakPath = path.join(app.getPath('userData'), `pos_pre_restore_${Date.now()}.db.bak`);

    try {
      // 1. Download to temp with progress
      await driveService.downloadFile(fileId, tempPath, (progress) => {
        event.sender.send('restore-progress', { status: 'downloading', progress });
      });

      // 2. Notify start of restoration
      event.sender.send('restore-progress', { status: 'restoring', progress: 100 });

      // 3. Backup current DB if it exists
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, bakPath);
      }

      // 4. Close and replace DB
      // Note: In main.ts, we'll need to call the actual DB replacement logic
      // For now, this service handles the file operations.
      // We'll use a callback or return success to main.ts to handle the reload.
      
      fs.copyFileSync(tempPath, dbPath);
      
      // 5. Cleanup temp
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      return { success: true, message: 'Restore completed. App will now reload.' };
    } catch (e: any) {
      console.error('Restore failed:', e);
      // Try to recover if we were mid-replace (advanced logic would go here)
      return { success: false, message: e.message };
    }
  }
}

export const restoreService = new RestoreService();
