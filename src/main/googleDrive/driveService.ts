
import { google, drive_v3 } from 'googleapis';
import { googleAuthService } from './googleAuth';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class DriveService {
  private drive(): drive_v3.Drive {
    return google.drive({ version: 'v3', auth: googleAuthService.getClient() });
  }

  /**
   * Finds or creates the main "POS Backups" folder
   */
  private async getOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    const drive = this.drive();
    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return folder.data.id!;
  }

  /**
   * Uploads a file to Google Drive
   */
  public async uploadFile(filePath: string, fileName: string): Promise<string> {
    if (!googleAuthService.isConnected()) {
      throw new Error('Google Drive is not connected');
    }

    const drive = this.drive();
    
    // 1. Get/Create "POS Backups" folder
    const mainFolderId = await this.getOrCreateFolder('POS Backups');
    
    // 2. Get/Create device specific folder
    const deviceName = os.hostname();
    const deviceFolderId = await this.getOrCreateFolder(deviceName, mainFolderId);

    // 3. Upload file
    const fileMetadata = {
      name: fileName,
      parents: [deviceFolderId]
    };

    const media = {
      mimeType: filePath.endsWith('.json') ? 'application/json' : 'application/x-sqlite3',
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    return response.data.id!;
  }

  /**
   * Lists all backup files in the "POS Backups" folder (including subfolders)
   */
  public async listBackups(): Promise<any[]> {
    if (!googleAuthService.isConnected()) return [];
    
    const drive = this.drive();
    // 1) Ensure we have the root folder.
    const mainFolderId = await this.getOrCreateFolder('POS Backups');

    // 2) Collect child device folders under "POS Backups".
    const folderRes = await drive.files.list({
      q: `'${mainFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 200,
    });
    const folderIds = (folderRes.data.files || []).map((f) => f.id).filter(Boolean) as string[];

    // Include root folder itself in case files were uploaded directly there.
    const parentIds = [mainFolderId, ...folderIds];
    if (parentIds.length === 0) return [];

    const parentQuery = parentIds.map((id) => `'${id}' in parents`).join(' or ');
    const response = await drive.files.list({
      q: `(${parentQuery}) and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name, size, createdTime, parents)',
      orderBy: 'createdTime desc',
      spaces: 'drive',
      pageSize: 500,
    });

    const files = (response.data.files || []).filter((f) => {
      const n = (f.name || '').toLowerCase();
      // Only show database backups in restore list to prevent restoring JSON/non-DB files.
      return n.endsWith('.db');
    });
    
    return files.map(f => ({
      id: f.id,
      name: f.name,
      size: parseInt(f.size || '0'),
      date: f.createdTime,
    }));
  }

  /**
   * Downloads a file from Google Drive with progress tracking
   */
  public async downloadFile(fileId: string, destPath: string, onProgress: (progress: number) => void): Promise<void> {
    const drive = this.drive();
    
    const meta = await drive.files.get({ fileId, fields: 'size' });
    const totalSize = parseInt(meta.data.size || '0');
    
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    
    return new Promise((resolve, reject) => {
      const dest = fs.createWriteStream(destPath);
      let downloadedSize = 0;

      res.data
        .on('data', (chunk: any) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress);
          }
        })
        .on('error', (err: any) => {
          reject(err);
        })
        .pipe(dest);

      dest.on('finish', () => resolve());
      dest.on('error', (err: any) => reject(err));
    });
  }
}

export const driveService = new DriveService();
