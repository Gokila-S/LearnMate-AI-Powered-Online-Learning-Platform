import fs from 'fs';
import path from 'path';

// Lazy import googleapis only if credentials present to avoid extra dependency requirement if unused
let driveClient = null;
let driveAuthMode = null; // 'service' | 'oauth'

async function getDrive(forceRefresh = false) {
  if (driveClient && !forceRefresh) return driveClient;

  const { GOOGLE_DRIVE_PARENT_FOLDER_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } = process.env;
  if (!GOOGLE_DRIVE_PARENT_FOLDER_ID) {
    console.warn('[DriveUpload] Skipping: missing GOOGLE_DRIVE_PARENT_FOLDER_ID');
    return null;
  }
  console.log('[DriveUpload] Initializing Google Drive client');
  let google;
  try {
    ({ google } = await import('googleapis'));
  } catch (impErr) {
    console.error('[DriveUpload] googleapis package not installed. Run `npm i googleapis` in server folder.', impErr.message);
    return null;
  }

  // Prefer OAuth if tokens available
  const tokenPath = path.join(process.cwd(), 'oauth', 'drive-tokens.json');
  if (GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && fs.existsSync(tokenPath)) {
    try {
      const raw = fs.readFileSync(tokenPath, 'utf8');
      const tokens = JSON.parse(raw);
      const { OAuth2 } = google.auth;
      const oAuth2Client = new OAuth2(
        GOOGLE_OAUTH_CLIENT_ID,
        GOOGLE_OAUTH_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
      );
      oAuth2Client.setCredentials(tokens);
      driveClient = google.drive({ version: 'v3', auth: oAuth2Client });
      driveAuthMode = 'oauth';
      console.log('[DriveUpload] Drive client ready (OAuth tokens)');
      return driveClient;
    } catch (e) {
      console.error('[DriveUpload] Failed loading OAuth tokens, falling back to service account if present:', e.message);
    }
  }

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    console.warn('[DriveUpload] No OAuth tokens and no service account credentials; skipping.');
    return null;
  }
  const auth = new google.auth.JWT(
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive']
  );
  driveClient = google.drive({ version: 'v3', auth });
  driveAuthMode = 'service';
  console.log('[DriveUpload] Drive client ready (service account)');
  return driveClient;
}

// Upload a local file (produced by multer) to Drive and make it streamable.
// Returns { driveFileId, webViewLink, webContentLink }
export async function uploadVideoToDrive(localFilePath, originalName) {
  try {
    const drive = await getDrive();
    if (!drive) return null; // Not configured
  console.log('[DriveUpload] Upload start:', originalName, '-> folder', process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID, 'mode=', driveAuthMode);
    const fileMetadata = {
      name: originalName || path.basename(localFilePath),
      parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID]
    };
    const media = {
      mimeType: 'video/mp4', // heuristic; Drive will sniff real type
      body: fs.createReadStream(localFilePath)
    };
    const createRes = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id'
    });
    const fileId = createRes.data.id;
    console.log('[DriveUpload] File created id=', fileId);
    // Set permission (anyone with link can view) - adjust as needed
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    console.log('[DriveUpload] Public read permission set');
    const getRes = await drive.files.get({ fileId, fields: 'id, webViewLink, webContentLink' });
    console.log('[DriveUpload] Metadata fetched');
    return {
      driveFileId: fileId,
      webViewLink: getRes.data.webViewLink,
      webContentLink: getRes.data.webContentLink
    };
  } catch (err) {
    if (err && typeof err.message === 'string' && /Service Accounts do not have storage quota/i.test(err.message)) {
      console.error('[DriveUpload] Failed: Service account has no personal storage quota. You must either:');
      console.error('  1) Use a Shared Drive (create one, share it with the service account, and set GOOGLE_DRIVE_PARENT_FOLDER_ID to a folder inside it), OR');
      console.error('  2) Delegate domain-wide authority & impersonate a real user with storage (advanced), OR');
      console.error('  3) Switch to OAuth user flow for uploads.');
      console.error('Falling back to local file. Full error:', err.message);
    } else {
      console.error('[DriveUpload] Failed, falling back to local file:', err.message);
    }
    return null;
  }
}

// Delete a file from Drive by its fileId (best-effort)
export async function deleteDriveFile(fileId) {
  if (!fileId) return false;
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const drive = await getDrive(attempt === 2); // second attempt forces refresh
      if (!drive) return false;
      console.log('[DriveUpload] Deleting Drive file id=', fileId, 'mode=', driveAuthMode, 'attempt=', attempt);
      await drive.files.delete({ fileId });
      console.log('[DriveUpload] File deleted id=', fileId);
      return true;
    } catch (err) {
      const msg = err?.message || String(err);
      lastErr = msg;
      if (/File not found/i.test(msg) || /404/.test(msg)) {
        console.warn('[DriveUpload] delete: already gone (404) fileId=', fileId);
        return true;
      }
      // If auth related error, retry once with force refresh
      if (attempt === 1 && /(auth|unauthorized|invalid_grant|credentials)/i.test(msg)) {
        console.warn('[DriveUpload] delete auth issue, retrying with fresh client:', msg);
        continue;
      }
      console.warn('[DriveUpload] delete failed (no retry)', msg);
      return false;
    }
  }
  console.warn('[DriveUpload] delete ultimately failed:', lastErr);
  return false;
}

// Expose current auth mode (for diagnostics / response enrichment)
export function getDriveAuthMode() {
  return driveAuthMode; // may be null if not initialized yet
}

export default { uploadVideoToDrive, deleteDriveFile, getDriveAuthMode };