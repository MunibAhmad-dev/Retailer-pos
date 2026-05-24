import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import url from 'url';
import { shell, app } from 'electron';
import fs from 'fs';
import path from 'path';

// --- Production Logging Logic ---
const LOG_PATH = path.join(app.getPath('userData'), 'google-auth.log');
const log = (msg: string, data?: any) => {
  const line = `[${new Date().toISOString()}] ${msg} ${data ? JSON.stringify(data) : ''}\n`;
  fs.appendFileSync(LOG_PATH, line);
  console.log(`[GoogleAuth] ${msg}`, data || '');
};

const CLIENT_ID = "997460265293-at775rhu7jojvhmeuk6jjn0irammnmuq.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_PORT = 8599;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

const TOKEN_PATH = path.join(app.getPath('userData'), 'google_tokens.json');

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;
  private authServer: http.Server | null = null;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    this.loadTokens();
  }

  private loadTokens() {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        this.oauth2Client.setCredentials(tokens);
        log('Tokens loaded from disk');
      }
    } catch (e) {
      log('Error loading tokens', e);
    }
  }

  private saveTokens(tokens: any) {
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      log('Tokens saved to disk');
    } catch (e) {
      log('Error saving tokens', e);
    }
  }

  public getClient(): OAuth2Client {
    return this.oauth2Client;
  }

  public isConnected(): boolean {
    const creds = this.oauth2Client.credentials;
    return !!(creds && (creds.access_token || creds.refresh_token));
  }

  /** Clears stored tokens — must call connect() again after this */
  public disconnect(): void {
    try {
      this.oauth2Client.setCredentials({});
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
        log('Tokens deleted from disk (disconnect)');
      }
    } catch (e) {
      log('Error during disconnect', e);
    }
  }

  /**
   * Starts a local server to listen for the OAuth2 callback
   */
  public async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 1. Generate Auth URL
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        prompt: 'consent'
      });

      log('Generated Auth URL', authUrl);

      // 2. Setup local server with timeout
      if (this.authServer) {
        this.authServer.close();
      }

      this.authServer = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url!, true);
          const query = parsedUrl.query;
          log('Incoming redirect request', parsedUrl.path);

          if (query.error) {
            log('Auth error received from Google', query.error);
            res.end(`Authentication failed: ${query.error}. You can close this window.`);
            this.cleanupServer();
            return resolve(false);
          }

          if (query.code) {
            const code = query.code as string;
            log('Extracted code, exchanging for tokens...');

            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            this.saveTokens(tokens);
            
            log('Token exchange successful');

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #f4f7f6;">
                  <div style="background: white; padding: 40px; border-radius: 12px; display: inline-block; shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h1 style="color: #4CAF50;">✅ Connection Successful!</h1>
                    <p style="color: #666;">Your Google Drive is now linked to Retail POS.</p>
                    <p style="font-size: 0.8em; color: #999;">You can safely close this browser tab.</p>
                  </div>
                </body>
              </html>
            `);
            
            this.cleanupServer();
            resolve(true);
          }
        } catch (e) {
          log('Token exchange failed', e);
          res.end('Authentication process failed. Please try again.');
          this.cleanupServer();
          reject(e);
        }
      });

      // 3. Handle port conflicts
      this.authServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log('Port 8599 is already in use. Retrying auth failed.');
          reject(new Error('Local authentication port (8599) is occupied by another app.'));
        } else {
          log('Server error', err);
          reject(err);
        }
      });

      this.authServer.listen(REDIRECT_PORT, () => {
        log(`Listening for redirect on port ${REDIRECT_PORT}`);
        shell.openExternal(authUrl);
      });

      // 4. Set safety timeout (5 minutes)
      setTimeout(() => {
        if (this.authServer) {
          log('Authentication timed out after 5 minutes');
          this.cleanupServer();
          resolve(false);
        }
      }, 5 * 60 * 1000);
    });
  }

  private cleanupServer() {
    if (this.authServer) {
      this.authServer.close();
      this.authServer = null;
      log('Local server closed');
    }
  }

  public async getAccessToken(): Promise<string | null> {
    try {
      const { token } = await this.oauth2Client.getAccessToken();
      return token || null;
    } catch (e) {
      log('Failed to refresh access token', e);
      return null;
    }
  }
}

export const googleAuthService = new GoogleAuthService();

