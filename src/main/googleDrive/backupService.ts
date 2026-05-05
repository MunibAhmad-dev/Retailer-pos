import { driveService } from './driveService';
import { googleAuthService } from './googleAuth';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import dayjs from 'dayjs';

const QUEUE_PATH = path.join(app.getPath('userData'), 'backup_queue.json');
const LOG_PATH = path.join(app.getPath('userData'), 'pos-drive-backup.log');

export class BackupService {
  private isWorking = false;

  constructor() {
    // Start periodic queue check
    setInterval(() => this.processQueue(), 1000 * 60 * 15); // Check every 15 mins
  }

  private log(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${error ? `\nError: ${JSON.stringify(error)}` : ''}\n`;
    fs.appendFileSync(LOG_PATH, logEntry);
  }

  /**
   * Adds a file to the backup queue if offline or upload fails
   */
  private addToQueue(filePath: string) {
    let queue: string[] = [];
    if (fs.existsSync(QUEUE_PATH)) {
      queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
    }
    if (!queue.includes(filePath)) {
      queue.push(filePath);
      fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue));
    }
  }

  /**
   * Attempts to upload all files in the queue
   */
  public async processQueue() {
    if (this.isWorking || !googleAuthService.isConnected()) return;
    this.isWorking = true;

    try {
      if (!fs.existsSync(QUEUE_PATH)) return;
      let queue: string[] = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
      const remainingQueue: string[] = [];

      for (const filePath of queue) {
        if (!fs.existsSync(filePath)) continue;
        
        try {
          const fileName = `Backup_${dayjs().format('YYYY-MM-DD_HH-mm')}_${path.basename(filePath)}`;
          await driveService.uploadFile(filePath, fileName);
          this.log(`Successfully uploaded queued backup: ${filePath}`);
        } catch (e) {
          this.log(`Failed to upload queued backup: ${filePath}`, e);
          remainingQueue.push(filePath);
        }
      }

      fs.writeFileSync(QUEUE_PATH, JSON.stringify(remainingQueue));
    } catch (e) {
      this.log('Error processing backup queue', e);
    } finally {
      this.isWorking = false;
    }
  }

  /**
   * Manually triggers a backup
   */
  public async triggerBackup(sourcePath: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!googleAuthService.isConnected()) {
        return { success: false, message: 'Google Drive not connected' };
      }

      // 1. Check internet connection (simple fetch check or just try)
      try {
        const fileName = `Backup_Manual_${dayjs().format('YYYY-MM-DD_HH-mm')}_${path.basename(sourcePath)}`;
        await driveService.uploadFile(sourcePath, fileName);
        this.log(`Manual backup successful: ${sourcePath}`);
        return { success: true, message: 'Backup uploaded successfully' };
      } catch (e) {
        // If failed (likely offline), add to queue
        this.addToQueue(sourcePath);
        this.log(`Backup failed/offline, added to queue: ${sourcePath}`, e);
        return { success: true, message: 'Offline. Backup added to queue for sync.' };
      }
    } catch (e) {
      this.log('Backup trigger error', e);
      return { success: false, message: 'Backup failed' };
    }
  }

  /**
   * Returns the last successful backup timestamp
   */
  public getLastBackupTime(): string | null {
    const META_PATH = path.join(app.getPath('userData'), 'backup_meta.json');
    if (fs.existsSync(META_PATH)) {
      try {
        const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
        return meta.lastDriveBackup || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Schedules a weekly backup
   */
  public scheduleWeeklyBackup(sourcePath: string) {
    const META_PATH = path.join(app.getPath('userData'), 'backup_meta.json');
    
    // Check every hour
    setInterval(async () => {
       if (!googleAuthService.isConnected()) return;

       let lastBackup = dayjs().subtract(8, 'days'); // Default to a week ago
       if (fs.existsSync(META_PATH)) {
          const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
          lastBackup = dayjs(meta.lastDriveBackup);
       }

       const daysSinceLastBackup = dayjs().diff(lastBackup, 'days');
       if (daysSinceLastBackup >= 7) {
          const result = await this.triggerBackup(sourcePath);
          if (result.success) {
             fs.writeFileSync(META_PATH, JSON.stringify({ lastDriveBackup: dayjs().toISOString() }));
             this.log('Automated weekly backup completed successfully.');
          }
       }
    }, 1000 * 60 * 60); // Every 1 hour
  }
}

export const backupService = new BackupService();
