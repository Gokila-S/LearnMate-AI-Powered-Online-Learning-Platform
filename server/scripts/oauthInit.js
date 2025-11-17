// Script to initialize OAuth tokens for Google Drive using a personal Gmail account.
// Usage:
//  1. Ensure env vars: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
//  2. (Optional) set GOOGLE_OAUTH_REDIRECT_URI (else uses 'urn:ietf:wg:oauth:2.0:oob')
//  3. Run: node scripts/oauthInit.js
//  4. Open the printed URL, authorize, copy the code, paste back.
//  5. drive-tokens.json stored under ./oauth/ (gitignored if you add rule).

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Ensure .env is loaded when running directly via `node scripts/oauthInit.js`
dotenv.config();

async function main() {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } = process.env;
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    console.error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in environment.');
    console.error('DEBUG VALUES =>', {
      GOOGLE_OAUTH_CLIENT_ID_PRESENT: !!GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET_PRESENT: !!GOOGLE_OAUTH_CLIENT_SECRET,
      NODE_ENV: process.env.NODE_ENV
    });
    console.error('Did you run this command from the server directory? Current cwd=', process.cwd());
    console.error('If not, run:  cd server && node scripts/oauthInit.js');
    process.exit(1);
  }
  let google;
  try { ({ google } = await import('googleapis')); } catch (e) { console.error('googleapis not installed:', e.message); process.exit(1); }

  const { OAuth2 } = google.auth;
  const client = new OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, redirect);
  const scopes = ['https://www.googleapis.com/auth/drive.file'];
  const authUrl = client.generateAuthUrl({ access_type: 'offline', scope: scopes, prompt: 'consent' });
  console.log('\nAuthorize this app by visiting this URL:\n', authUrl, '\n');

  process.stdout.write('Enter the authorization code here: ');
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    const code = chunk.trim();
    if (!code) return;
    try {
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const outDir = path.join(process.cwd(), 'oauth');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, 'drive-tokens.json');
      fs.writeFileSync(outFile, JSON.stringify(tokens, null, 2));
      console.log('\n[OAuthInit] Tokens saved to', outFile);
      console.log('[OAuthInit] Refresh token present:', !!tokens.refresh_token);
      console.log('[OAuthInit] You can now restart the server; uploads will use OAuth.');
      process.exit(0);
    } catch (err) {
      console.error('Failed to exchange code:', err.message);
      process.exit(1);
    }
  });
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
