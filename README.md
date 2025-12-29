<div align="center">

# LearnMate – AI‑Powered Online Learning Platform

_Modern MERN stack platform featuring AI chat assistance, AI quiz generation, rich lesson types, video (local + Google Drive) handling, progress analytics, and admin tooling._

</div>

---

## ✨ Overview

LearnMate started as a minimal MVP (browse → enroll → learn) and has evolved into a richer platform with:

| Domain | Capabilities |
|--------|--------------|
| Learning UX | Course catalog, lesson progression, bookmarks, completion thresholds, video watch tracking (60% + 90% auto-complete), quiz & assessment experiences |
| Community | Group discussions with categories, threaded replies, voting, moderation tools (pin/lock/resolve/delete), "Course Provider" admin badges |
| AI & Automation | Contextual student AI chat, admin AI quiz/assessment question suggestions (difficulty, regenerate, more-like-this, dedupe), auto lesson description fallback |
| Content Types | Text (Markdown/HTML), Video (local / Google Drive via Service Account or OAuth personal Gmail), YouTube, Quiz, Assessment |
| Media Pipeline | Multer local upload, optional Google Drive upload (service account or OAuth), public preview embedding, graceful fallback to local if Drive unavailable |
| Data Integrity | Order collision retry for lessons, idempotent seeding scripts, similarity filtering of AI-generated questions |
| Access & Auth | JWT-based API protection, role separation (website_admin, course_admin, user), admin course view mode |
| Admin Toolkit | Course & module management, lesson creation (video / text / quiz / assessment), AI quiz suggestion panel, View Page for course preview |

---

## 🚀 Features

### Core Learning
* Course browsing (text search, category, level, alphabetical prefix & sort)
* Lesson types: video / YouTube / text / quiz / assessment
* Enrollment & per-lesson progress persistence (watched seconds, duration, early-complete at 60% or auto at 90%)
* Bookmarks & completion badges

### Group Discussion
* **Course Discussions** – Students and course admins can create discussions with categories (General, Questions, Technical, etc.)
* **Nested Replies** – Reply to messages with threaded conversation view
* **Voting System** – Upvote/downvote discussions and messages
* **Moderation Tools** – Pin, Lock, Resolve, and Delete discussions (course admins)
* **Message Deletion** – Users can delete their own messages; course admins can delete any message
* **Course Provider Tag** – Course admins display "Course Provider" badge in discussions
* **Admin Course View** – Course admins can "View Page" from admin dashboard with special banner and full moderation access
* **Online Users** – See who's currently viewing the course discussions

### AI & Smart Authoring
* Student AI Chat Widget (OpenAI) – contextual Q&A helper (model configurable via `OPENAI_API_KEY`).
* Admin AI quiz generation:
   * Difficulty selector (easy / medium / hard / mixed)
   * Regenerate & "More like this" per question group
   * Automatic similarity dedup (Jaccard word-set overlap threshold)
   * Selection workflow (tick to include) before saving as quiz/assessment lesson
* Automatic lesson description fallback (first heading, first question, or `${title} lesson`).

### Video & Media Pipeline
| Mode | Description |
|------|-------------|
| Local | Stored in `/uploads/lessons`, always available fallback |
| Google Drive (Service Account) | Upload if service account & folder ID set; adds `driveFileId`, preview & download links |
| Google Drive (OAuth Personal Gmail) | For personal accounts w/out Shared Drives; desktop OAuth flow stores tokens in `server/oauth/drive-tokens.json` |
| YouTube | Provide link; server extracts videoId; frontend provides lazy play overlay |

When a lesson (or entire course) is deleted, any associated Google Drive video file (by driveFileId) is now removed best-effort. Failures are logged but do not block deletion.
Drive upload gracefully degrades: if credentials missing or quota error → remains `storage=local`.

### Resilience & DX
* Retry on lesson order uniqueness collisions
* Fallback logs: `[DriveUpload]`, `[LessonAdd]`
* Structured logging for Drive auth mode (oauth vs service)
* Dynamic import of `googleapis` only when needed
* Graceful skipping of Drive if not configured

### Security & Access
* JWT auth, role-based route guards
* Public vs protected routes
* Optional global CORS origin override via `CLIENT_URL`

### Scripts & Utilities
* `seed` – populate initial admins / sample data
* `import:json` – import structured JSON courses (script scaffold)
* `oauthInit` – launch OAuth flow to store Drive tokens (personal Gmail)
* Admin housekeeping scripts (migrate owners, check admins)

### UX Enhancements
* Rich quiz player (progress, results breakdown, retake)
* Assessment player wrapper (secure pattern placeholder)
* Global loading spinners & error boundaries
* Adaptive video completion messaging (threshold states)

### In-Progress / Experimental
* Drive iframe embedding optimizations & fallback logic
* Potential proxy streaming route (planned)

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern React with latest features
- **React Router DOM** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client for API calls

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
 - **googleapis** - Drive API integration
 - **multer** - File upload handling
 - **OpenAI API** - AI chat & quiz generation

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

### Backend Setup

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration (Minimal):**
   Create / edit `server/.env` with base values:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/learnmate
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=30d
   CLIENT_URL=http://localhost:5173
   OPENAI_API_KEY=sk-... (required for AI chat/quiz)
   ```

   Atlas example:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://<USER>:<PASS>@<cluster>.mongodb.net/learnmate?retryWrites=true&w=majority&appName=Learnmate
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=30d
   CLIENT_URL=http://localhost:5173
   ```

   To revert to local Mongo, just switch `MONGODB_URI` back to `mongodb://localhost:27017/learnmate` in `server/.env`.

4. **Start MongoDB:**
   - Local: Ensure MongoDB service is running
   - Atlas: Use your MongoDB Atlas connection string

5. **Seed the database with sample data:**
   ```bash
   npm run seed
   ```

6. **Start the server (dev with auto-reload):**
   ```bash
   npm run dev
   ```

### Optional: Google Drive (Service Account) Upload
Add to `.env` (escape newlines in private key):
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_PARENT_FOLDER_ID=<drive_folder_id>
```
If those three + folder id exist, uploads attempt Drive first.

### Optional: Google Drive (OAuth – Personal Gmail)
When you lack Shared Drives or want personal quota:
```env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
# Optional
GOOGLE_OAUTH_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
GOOGLE_DRIVE_PARENT_FOLDER_ID=<my_drive_folder_id>
```
Then run:
```bash
cd server
node scripts/oauthInit.js
```
Authorize → tokens saved at `server/oauth/drive-tokens.json` (gitignored). On startup you’ll see `[DriveUpload] Drive client ready (OAuth tokens)`.

### Environment Variable Summary
| Variable | Purpose | Required |
|----------|---------|----------|
| MONGODB_URI | DB connection | Yes |
| JWT_SECRET | Auth signing | Yes |
| OPENAI_API_KEY | AI chat/quiz | Yes (for AI features) |
| GOOGLE_SERVICE_ACCOUNT_EMAIL | Drive (service) | No |
| GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY | Drive (service) | No |
| GOOGLE_DRIVE_PARENT_FOLDER_ID | Drive folder target | No (needed if using Drive) |
| GOOGLE_OAUTH_CLIENT_ID / SECRET | Drive OAuth | No (personal mode) |
| GOOGLE_OAUTH_REDIRECT_URI | Override redirect | No |

If both OAuth tokens and service account exist, OAuth is preferred (personal mode). Remove tokens file to fallback to service account.

### Frontend Setup

1. **Navigate to project root:**
   ```bash
   cd ..
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Navigate to `http://localhost:5173`

## ✅ Feature Checklist

| Area | Status | Notes |
|------|--------|-------|
| Course search/filter | ✅ | Text, category, level, sort, startsWith |
| Enrollment & progress | ✅ | Watched seconds persisted |
| Video (local) | ✅ | Multer + static serving |
| Video (Drive SA) | ✅ | Public link permission auto-set |
| Video (Drive OAuth) | ✅ | Personal Gmail tokens; embed preview |
| YouTube lessons | ✅ | Extract ID + lazy play |
| AI Chat (student) | ✅ | Floating widget, conversation history client-side |
| AI Quiz suggestions | ✅ | Difficulty, regenerate, more-like-this, dedupe |
| Quiz player | ✅ | Timer, score, review, retake |
| Assessment placeholder | ✅ | Modular player component |
| Lesson order retry | ✅ | Prevent duplicate order collisions |
| Bookmarks | ✅ | Per-user bookmarks |
| OpenAI integration | ✅ | Chat + question generation |
| OAuth token script | ✅ | `node scripts/oauthInit.js` |
| Drive logging & fallback | ✅ | Skips gracefully if misconfigured |
| Similarity filter | ✅ | Jaccard threshold to remove near duplicates |
| Group Discussion | ✅ | Create discussions, threaded replies, voting |
| Discussion Moderation | ✅ | Pin, Lock, Resolve, Delete for course admins |
| Admin Course View | ✅ | View Page button with Course Provider banner |
| Message Deletion | ✅ | Users delete own; admins delete any |

## 🧠 AI Quiz Generation Flow
1. Admin opens quiz panel inside course editor.
2. Select difficulty → generate N suggestions.
3. Dedupe & display; each question can spawn “More like this”.
4. Select subset → persist as quiz or assessment lesson.

Similarity Heuristic: token set overlap ≥ ~85% treated as duplicate.

## 🗃 Data Model Highlights
* `Lesson.content` polymorphic: `{ type: 'video'|'youtube'|'text'|'quiz'|'assessment', data: {...} }`
* Video (Drive) data adds: `driveFileId`, `embedLink`, `webViewLink`, `webContentLink`, `storage='drive'`.
* Progress tracked by lesson watch collection entries (watchedSeconds, durationSeconds).

## 🔍 Logging Conventions
| Prefix | Meaning |
|--------|---------|
| [DriveUpload] | Drive client lifecycle & errors |
| [LessonAdd] | Post-upload warnings or fallback |
| [OAuthInit] | OAuth token acquisition script |

## 🛡 Security Notes
* Do NOT commit secrets (`.env`, private keys, `drive-tokens.json`).
* Drive public permission uses `anyone: reader` – for paid content you may want a proxy stream with signed URLs.
* Rotate keys if they were exposed during development.

## 🧪 Useful Scripts
| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | server | Start API with nodemon |
| `npm run seed` | server | Seed initial data/admins |
| `node scripts/oauthInit.js` | server | Obtain Drive OAuth tokens |
| `node scripts/checkAdmins.js` | server | Validate admin existence |

## 🗺 Roadmap / Next Steps
| Priority | Candidate Enhancement |
|----------|----------------------|
| High | Proxy streaming endpoint for private Drive playback |
| High | Video transcoding / normalization pipeline |
| Medium | Rate limit / caching for AI endpoints |
| Medium | Rich analytics dashboard (per-lesson retention) |
| Low | Multi-language i18n layer |
| Low | Dark mode theme toggle |

## ❓ Troubleshooting
| Issue | Cause | Resolution |
|-------|-------|------------|
| Drive quota error | Service account in personal My Drive | Use OAuth or Shared Drive |
| Iframe refused to connect | CSP from certain Drive hosts | Use `/file/d/<id>/preview` or proxy route |
| No OAuth refresh token | Already granted scope | Delete tokens file & re-run init |
| AI quiz duplicates | Similar semantics | Adjust threshold or manual deselect |
| Slow Drive preview | Large file still processing | Wait or provide local fallback |

## 🤖 OpenAI Usage
Minimal temperature tuning; quiz generation uses structured JSON prompt with difficulty scaling + variant generation. Consider adding rate limiting & caching in production.

---

**LearnMate** – Empowering learners with intelligent tooling. 🎓

---

_Originally bootstrapped with Vite React template._
