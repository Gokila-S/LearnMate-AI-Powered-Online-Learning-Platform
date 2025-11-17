# Google Drive Video Upload Integration

The platform can optionally upload lesson video files to Google Drive using a Service Account. If Drive credentials are **not** provided, videos remain on local disk under `uploads/lessons`.

## 1. Create a Google Cloud Project & Service Account
1. Go to https://console.cloud.google.com/
2. Create (or select) a project.
3. Enable the Google Drive API.
4. Create a Service Account (IAM & Admin > Service Accounts).
5. Generate a JSON key.

## 2. Prepare Environment Variables (server/.env)
Add the following (example):
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_PARENT_FOLDER_ID=XXXXXXXXXXXXXXXXXXXXXXX   # Folder where videos will be stored
```
Notes:
* Escape newlines in the private key with `\n` if placing in a single-line .env entry.
* Ensure the parent folder is created in Drive and (optionally) shared if you want humans to browse it.

## 3. Permissions
The uploader sets each uploaded file to `anyone with the link: reader` for streaming. Adjust in `utils/driveUploader.js` if you need a different permission model.

## 4. Resulting Metadata
When Drive upload succeeds, the lesson's `content.data` includes:
```json
{
  "storage": "drive",
  "driveFileId": "<FILE_ID>
  ", "webViewLink": "https://drive.google.com/file/d/.../view",
  "webContentLink": "https://drive.google.com/uc?id=...&export=download",
  "streamUrl": "https://drive.google.com/uc?export=preview&id=<FILE_ID>",
  "videoUrl": "/uploads/lessons/local-fallback.mp4"  // still retained
}
```
If Drive upload fails or is not configured, `storage` will be `local` and only local fields will exist.

## 5. Frontend Streaming
Prefer using `streamUrl` (preview) or embed the `webViewLink` in an `<iframe>`. The local `videoUrl` remains usable for direct `<video>` tag fallback.

## 6. Troubleshooting
* 400 errors: ensure `title` AND a derived description are provided (already auto-generated on frontend).
* Drive upload silently falls back to local if credentials are missing or invalid; check server logs for `[DriveUpload]` entries.
* Large Files: Current limit is 500MB (configured in `config/upload.js`). Increase cautiously.

## 7. Security Considerations
* Service account key is sensitive; never commit it.
* Public link permission may not suit paid-only content—consider generating signed URLs or using a restricted sharing strategy.
* Optionally remove local file after successful Drive upload if you do not want to store duplicates (not implemented by default for safety).

---
Generated integration notes.
\n+---
## Using a Personal Gmail Account (OAuth Flow)
If you do not have Google Workspace Shared Drives, a service account alone cannot upload into your personal My Drive. Use OAuth so uploads occur as your own user identity (with your 15GB quota).

### A. Create OAuth Credentials
1. Open Google Cloud Console > APIs & Services > Credentials.
2. Create Credentials -> OAuth client ID -> Application type: Desktop App.
3. Copy the Client ID & Client Secret.

### B. Add Environment Variables (server/.env)
```
GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
# Optional; default fallback is urn:ietf:wg:oauth:2.0:oob
GOOGLE_OAUTH_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
GOOGLE_DRIVE_PARENT_FOLDER_ID=<folder_id_in_your_MyDrive>
```
Pick (or create) a folder in your My Drive and copy its ID from the URL.

### C. Initialize Tokens
```
cd server
node scripts/oauthInit.js
```
Open the printed URL, approve access, paste the code back. A file is created at `server/oauth/drive-tokens.json`.

### D. Runtime Logic
1. If OAuth tokens + client env vars exist, uploader uses OAuth (log shows `mode= oauth`).
2. Else if service account creds exist, it uses service account (`mode= service`).
3. Otherwise it skips Drive and leaves video local.

### E. Scopes
The init script uses scope `drive.file` (only files your app creates). If you need to read arbitrary existing files, re-authorize with full scope `https://www.googleapis.com/auth/drive`.

### F. Refresh Tokens
Google issues a refresh token the first time (prompt=consent). It is stored in `drive-tokens.json`. Do not commit this file.

### G. Revoking & Re-Authorizing
Delete the tokens file and run the init script again. You can also revoke the app from your Google Account security page.

### H. Security Notes
* Treat `drive-tokens.json` like a secret (it grants API access as you).
* Limit scopes.
* Consider a dedicated Google account for production media isolation.

### Troubleshooting (OAuth)
| Symptom | Cause | Fix |
|---------|-------|-----|
| `invalid_grant` | Wrong / expired code | Re-run script quickly after copying code |
| No refresh_token in file | Google didn’t return (already granted) | Re-run with `prompt=consent` (delete tokens first) |
| Upload works but file private | Permission call failed | Check server logs for permission errors |
| `googleapis not installed` | Dependency missing | `npm install` in `server/` |

---