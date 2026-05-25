import os from 'os';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import Database from 'better-sqlite3';

// AES-256-GCM Configuration
// In a real production app, the secret should be obfuscated or derived
const SECRET_KEY = Buffer.from('4a616e75617279203173742c2032303236204c6963656e736520536563726574', 'hex'); // 32 bytes
const IV_LENGTH = 12; // For GCM
const AUTH_TAG_LENGTH = 16;

export type LicenseDurationUnit = 'days' | 'weeks' | 'months' | 'years';

export interface LicenseData {
  id: string;
  issuedTo: string; // Business name
  issuedForFingerprint: string;
  durationDays: number;
  maxDevices: number;
  issuedAt: string;
  expiresAt: string;
}

export class LicenseManager {
  private db: Database.Database;
  private readonly macSalt = 'pos-mac-salt-v2';

  constructor(db: Database.Database) {
    this.db = db;
    this.initDb();
  }

  private initDb() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS app_license (
          id TEXT PRIMARY KEY,
          license_key TEXT NOT NULL, -- The full encrypted block
          activated_at DATETIME,
          status TEXT DEFAULT 'pending',
          max_devices INTEGER NOT NULL DEFAULT 1,
          expires_at TEXT NOT NULL,
          issued_for_fingerprint TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_license_activations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          license_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          activated_at TEXT NOT NULL,
          device_name TEXT NOT NULL,
          UNIQUE (license_id, fingerprint)
        );
      `);
    } catch (e) {
      console.error('LicenseManager initDb failed:', e);
    }
  }

  private getSystemUuid(): string {
    try {
      if (process.platform === 'win32') {
        const out = execFileSync('wmic', ['csproduct', 'get', 'uuid'], { encoding: 'utf8', timeout: 5000 });
        const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2 && lines[1].toLowerCase() !== 'uuid') return lines[1];
      }
      if (process.platform === 'darwin') {
        const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8', timeout: 5000 });
        const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match?.[1]) return match[1];
      }
      const linuxSeed = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model || 'unknown-cpu'
      ].join('|');
      return crypto.createHash('sha256').update(linuxSeed).digest('hex');
    } catch (e) {
      console.warn('getSystemUuid failed, using fallback:', e);
      const fallback = [os.hostname(), os.platform(), os.arch()].join('|');
      return crypto.createHash('sha256').update(fallback).digest('hex');
    }
  }

  /**
   * Generates a unique device fingerprint using OS metadata
   */
  public async getDeviceFingerprint(): Promise<string> {
    const interfaces = os.networkInterfaces();
    const macs: string[] = [];
    
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      
      for (const entry of iface) {
        // Filter out internal, local-only, or virtual-style MACs
        if (
          !entry.internal && 
          entry.mac && 
          entry.mac !== '00:00:00:00:00:00' && 
          !entry.mac.startsWith('00:05:69') && // VMware
          !entry.mac.startsWith('08:00:27') && // VirtualBox
          !entry.mac.startsWith('00:1c:42')    // Parallels
        ) {
          macs.push(entry.mac);
        }
      }
    }

    // Sort and take the first stable MAC
    const firstMac = macs.sort()[0] || 'no-mac';
    const macHash = crypto.createHash('sha256').update(`${this.macSalt}:${firstMac}`).digest('hex');
    const cpuModel = os.cpus()[0]?.model || 'unknown-cpu';
    const cpuCores = String(os.cpus().length);
    const systemUuid = this.getSystemUuid();

    // Include the current UTC date so the fingerprint changes every 24 hours.
    // This prevents a screenshot of today's fingerprint being used tomorrow
    // to generate an offline license key.
    const todayUtc = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    const data = [
      os.hostname(),
      os.platform(),
      os.arch(),
      cpuModel,
      cpuCores,
      macHash,
      systemUuid,
      todayUtc,  // daily rotation
    ].join('::');

    const finalHash = crypto.createHash('sha256').update(data).digest('hex');
    console.log('Generated fingerprint:', finalHash, 'based on MAC:', firstMac, 'UUID:', systemUuid, 'date:', todayUtc);
    return finalHash;
  }

  public getDeviceName(): string {
    return os.hostname();
  }

  /**
   * Wipes the local license from SQLite (called when admin revokes via cloud).
   */
  public clearLicense(): void {
    try {
      this.db.prepare('DELETE FROM app_license').run();
      this.db.prepare('DELETE FROM app_license_activations').run();
    } catch (e) {
      console.error('clearLicense failed:', e);
    }
  }

  /**
   * Encrypts license data into a shareable string
   */
  public encryptLicense(data: LicenseData): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
    
    const json = JSON.stringify(data);
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  public buildLicense(input: {
    issuedTo: string;
    issuedForFingerprint: string;
    durationValue: number;
    durationUnit: LicenseDurationUnit;
    maxDevices?: number;
  }): LicenseData {
    const now = new Date();
    const expiresAt = new Date(now);
    const value = Math.max(1, Math.floor(Number(input.durationValue) || 1));
    const maxDevices = Math.min(5, Math.max(1, Math.floor(Number(input.maxDevices) || 1)));
    const unit = input.durationUnit;

    if (unit === 'days') expiresAt.setDate(expiresAt.getDate() + value);
    if (unit === 'weeks') expiresAt.setDate(expiresAt.getDate() + value * 7);
    if (unit === 'months') expiresAt.setMonth(expiresAt.getMonth() + value);
    if (unit === 'years') expiresAt.setFullYear(expiresAt.getFullYear() + value);

    const durationDays = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    return {
      id: crypto.randomUUID(),
      issuedTo: input.issuedTo?.trim() || 'Unknown Business',
      issuedForFingerprint: input.issuedForFingerprint,
      durationDays,
      maxDevices,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * Decrypts and verifies a license string
   */
  public decryptLicense(licenseKey: string): LicenseData | null {
    try {
      const [ivHex, authTagHex, encryptedData] = licenseKey.split(':');
      if (!ivHex || !authTagHex || !encryptedData) return null;

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('License decryption failed:', error);
      return null;
    }
  }

  /**
   * Validates the currently stored license
   */
  public async validateLocalLicense(): Promise<{ valid: boolean; reason?: string; data?: LicenseData }> {
    const row = this.db.prepare('SELECT license_key FROM app_license LIMIT 1').get() as any;
    if (!row) return { valid: false, reason: 'No license found' };

    const data = this.decryptLicense(row.license_key);
    if (!data) return { valid: false, reason: 'Invalid license format' };

    // 1. Check Expiry
    const now = new Date();
    const expiry = new Date(data.expiresAt);
    if (now > expiry) return { valid: false, reason: 'License expired', data };

    // 2. Check Fingerprint — empty string means "any device" (used for cloud-approved licenses)
    if (data.issuedForFingerprint) {
      const currentFingerprint = await this.getDeviceFingerprint();
      if (data.issuedForFingerprint !== currentFingerprint) {
        return { valid: false, reason: 'Hardware mismatch', data };
      }
    }

    return { valid: true, data };
  }

  /**
   * Activates a new license key
   */
  public async activateLicense(licenseKey: string): Promise<{ success: boolean; error?: string }> {
    const data = this.decryptLicense(licenseKey);
    if (!data) return { success: false, error: 'Invalid license key' };

    // Always resolve the current fingerprint (used for activation records below)
    const currentFingerprint = await this.getDeviceFingerprint();

    // Empty issuedForFingerprint = cloud-approved license; skip device check
    if (data.issuedForFingerprint && data.issuedForFingerprint !== currentFingerprint) {
      return { success: false, error: 'This license is not for this device' };
    }

    const now = new Date();
    if (now > new Date(data.expiresAt)) {
      return { success: false, error: 'This license has already expired' };
    }

    try {
      const existingLicense = this.db.prepare('SELECT id FROM app_license WHERE id = ?').get(data.id) as any;
      if (!existingLicense) {
        this.db.prepare('DELETE FROM app_license').run();
        this.db.prepare('DELETE FROM app_license_activations').run();
        this.db.prepare(`
          INSERT INTO app_license (id, license_key, activated_at, status, max_devices, expires_at, issued_for_fingerprint)
          VALUES (?, ?, ?, 'active', ?, ?, ?)
        `).run(data.id, licenseKey, now.toISOString(), data.maxDevices, data.expiresAt, data.issuedForFingerprint);
      } else {
        this.db.prepare(`
          UPDATE app_license
          SET license_key = ?, activated_at = ?, status = 'active', max_devices = ?, expires_at = ?, issued_for_fingerprint = ?
          WHERE id = ?
        `).run(licenseKey, now.toISOString(), data.maxDevices, data.expiresAt, data.issuedForFingerprint, data.id);
      }

      const existingActivation = this.db.prepare(
        'SELECT id FROM app_license_activations WHERE license_id = ? AND fingerprint = ?'
      ).get(data.id, currentFingerprint) as any;

      if (!existingActivation) {
        const usedCountRow = this.db.prepare(
          'SELECT COUNT(*) as cnt FROM app_license_activations WHERE license_id = ?'
        ).get(data.id) as any;
        const usedCount = Number(usedCountRow?.cnt || 0);

        if (usedCount >= data.maxDevices) {
          return { success: false, error: 'Activation limit reached for this license' };
        }

        this.db.prepare(`
          INSERT INTO app_license_activations (license_id, fingerprint, activated_at, device_name)
          VALUES (?, ?, ?, ?)
        `).run(data.id, currentFingerprint, now.toISOString(), this.getDeviceName());
      } else {
        this.db.prepare(`
          UPDATE app_license_activations
          SET activated_at = ?, device_name = ?
          WHERE license_id = ? AND fingerprint = ?
        `).run(now.toISOString(), this.getDeviceName(), data.id, currentFingerprint);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
