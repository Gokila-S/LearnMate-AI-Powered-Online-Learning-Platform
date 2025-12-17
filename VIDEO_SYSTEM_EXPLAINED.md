# LearnMate Video System — Complete Technical Overview

## Quick Summary (30 seconds)
LearnMate supports **three video types**: local uploads, Google Drive uploads, and YouTube embeds. All three enforce **progress tracking** and **anti-skip protection** (users can't jump ahead beyond their highest continuous watched point). Videos auto-complete at 90% or allow manual finish at 60%. Progress is saved to MongoDB every 4 seconds via REST API.

---

## Tech Stack

### Frontend (Video Playback & UI)
- **React** — component-based UI (`LessonPlayer.jsx`)
- **HTML5 `<video>`** — for local/Drive video playback with native controls
- **YouTube IFrame Player API** — for YouTube video embed with programmatic control
- **Axios** — HTTP client for progress API calls
- **Refs & State** — `useRef` for video/player instances, `useState` for tracking progress

### Backend (Upload & Metadata)
- **Node.js + Express** — REST API server
- **Multer** — middleware for `multipart/form-data` file uploads (saves to disk: `uploads/lessons/`)
- **Google Drive API (googleapis)** — optional upload to Drive after local save
  - Service Account (JWT) or OAuth2 (personal Gmail) authentication
- **MongoDB (Mongoose)** — stores lesson documents with polymorphic `content` field

### Storage & Delivery
- **Local disk** — `<repo>/uploads/lessons/` (served via Express static middleware)
- **Google Drive** — cloud storage with public `anyone:reader` permission (embed via iframe or direct link)
- **YouTube** — external hosting (embed via IFrame API)

---

## Three Video Types — How Each Works

### 1) Local Video Upload

**Upload Flow:**
1. Admin uploads video file via form → POST `/api/courses/:id/lessons` (multipart)
2. **Multer** receives file → saves to `uploads/lessons/<timestamp-random>.mp4`
3. Controller creates lesson with:
   ```javascript
   content: {
     type: 'video',
     data: {
       videoUrl: '/uploads/lessons/<filename>',
       originalName, size, mimetype,
       storage: 'local'
     }
   }
   ```

**Playback Flow:**
1. Frontend fetches lesson → sees `content.type === 'video'` and `storage === 'local'`
2. Renders `<video controls src="/uploads/lessons/<filename>" />`
3. Express serves file via `app.use('/uploads', express.static(...))`
4. Browser plays natively

**Progress Tracking (anti-skip):**
- `LessonPlayer` listens to `timeUpdate` event on `<video>` element
- Tracks `watchedUntil` (highest continuous second)
- If `currentTime > watchedUntil + 2` → seeks back to `watchedUntil` (prevents skipping)
- Every 4 seconds (throttled): calls `PUT /api/enrollments/:courseId/lessons/:lessonId/progress` with `{ watchedSeconds, durationSeconds }`
- Backend updates `enrollments.progress` array (per-user, per-lesson watch state)

**Auto-complete:**
- When `watchedSeconds / duration >= 0.9` → auto-marks lesson complete
- Or user can manually finish at 60% via UI button

**Tech:** `<video>` + `onTimeUpdate` + `videoRef.current.currentTime` + REST API

---

### 2) Google Drive Upload (with Local Fallback)

**Upload Flow:**
1. Same as local: Multer saves to `uploads/lessons/` first
2. Controller calls `uploadVideoToDrive(localPath, originalName)` from `driveUploader.js`
3. Drive uploader:
   - Lazy-loads `googleapis` package
   - Chooses auth: OAuth tokens (`server/oauth/drive-tokens.json`) or Service Account (env vars)
   - Calls `drive.files.create({ media: fs.createReadStream(localPath) })`
   - Sets permission: `{ role: 'reader', type: 'anyone' }` (public link)
   - Returns `{ driveFileId, webViewLink, webContentLink }`
4. Controller updates lesson `content.data`:
   ```javascript
   {
     ...localData,  // keeps videoUrl fallback
     driveFileId, webViewLink, webContentLink,
     embedLink: `https://drive.google.com/file/d/${driveFileId}/preview`,
     storage: 'drive'
   }
   ```
5. If Drive upload fails → keeps `storage: 'local'` and uses local file

**Playback Flow:**
1. Frontend sees `storage === 'drive'` and `embedLink`
2. Renders `<iframe src="https://drive.google.com/file/d/${fileId}/preview" />`
3. Drive streams video in iframe (Google handles CDN/buffering)
4. No direct `<video>` element → **cannot track progress via timeUpdate**
5. **Limitation:** Drive iframe does not expose playback events to parent page (cross-origin sandbox)
6. **Current behavior:** Drive videos play but progress/anti-skip is **not enforced** (user can skip freely inside Drive player)

**Fallback:**
- If `embedLink` fails or not set → falls back to local `videoUrl` and uses `<video>` tag (same as local flow)

**Tech:** `googleapis` (Drive API v3) + iframe embed + Service Account JWT / OAuth2

---

### 3) YouTube Embed (with IFrame Player API)

**Upload Flow:**
1. Admin provides YouTube URL (e.g., `https://youtube.com/watch?v=<ID>`)
2. Backend extracts video ID via regex:
   ```javascript
   const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
   const videoId = url.match(regex)?.[1];
   ```
3. Stores lesson:
   ```javascript
   content: {
     type: 'youtube',
     data: {
       youtubeUrl, videoId,
       thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
     }
   }
   ```

**Playback Flow:**
1. Frontend shows thumbnail with play button (lazy-load)
2. User clicks → sets `ytPlaying = true`
3. Component loads YouTube IFrame API script (`https://www.youtube.com/iframe_api`)
4. Creates player instance:
   ```javascript
   ytPlayerRef.current = new window.YT.Player(`yt-player-${videoId}`, {
     videoId,
     events: { onReady, onStateChange }
   });
   ```
5. **Progress Tracking via Polling:**
   - When `YT.PlayerState.PLAYING` → starts interval (every 1 second)
   - Calls `ytPlayerRef.current.getCurrentTime()` and `getDuration()`
   - Checks if `currentTime > watchedUntil + 2` → seeks back to `watchedUntil` (anti-skip)
   - Updates UI progress bar
   - Every 4 seconds (throttled): `PUT /api/enrollments/:courseId/lessons/:lessonId/progress`
6. When player pauses/ends → clears interval
7. On video end → checks 90% threshold and auto-completes

**Anti-skip Implementation:**
```javascript
// Inside polling interval
if (cur <= watchedUntil + 2) {
  if (cur > watchedUntil) setWatchedUntil(cur);
} else {
  ytPlayerRef.current.seekTo(watchedUntil, true); // force seek back
}
```

**Tech:** YouTube IFrame Player API (`YT.Player`) + polling via `setInterval` + `getCurrentTime()` + REST API

---

## Complete Data Flow Diagram (Text)

```
┌─────────────┐
│ Admin UI    │  Upload video / YouTube URL
└──────┬──────┘
       │ POST /api/courses/:id/lessons (multipart or JSON)
       ▼
┌──────────────────────────────────────────────┐
│ Backend (courseController.addLesson)         │
│ ┌─────────────────────────────────────────┐  │
│ │ 1. Multer saves to uploads/lessons/     │  │
│ │ 2. Build local contentData              │  │
│ │ 3. If video file:                       │  │
│ │    - Call uploadVideoToDrive()          │  │
│ │    - If success: add driveFileId/links  │  │
│ │    - If fail: keep storage='local'      │  │
│ │ 4. If YouTube: extract videoId          │  │
│ │ 5. Create Lesson doc in MongoDB         │  │
│ └─────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │   MongoDB         │
        │  Lesson document  │
        │  content: {       │
        │    type,          │
        │    data: {...}    │
        │  }                │
        └──────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
     ▼             ▼             ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│ Local   │  │  Drive   │  │ YouTube  │
│ Storage │  │  Cloud   │  │  Embed   │
└─────────┘  └──────────┘  └──────────┘
     │             │             │
     └─────────────┼─────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Student UI           │
        │ (LessonPlayer.jsx)   │
        │ ┌──────────────────┐ │
        │ │ Render video:    │ │
        │ │ • Local: <video> │ │
        │ │ • Drive: <iframe>│ │
        │ │ • YT: YT.Player  │ │
        │ └──────────────────┘ │
        └───────────┬──────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ Progress Tracking      │
        │ • timeUpdate / polling │
        │ • watchedUntil state   │
        │ • Anti-skip logic      │
        │ • Throttled API calls  │
        └───────────┬────────────┘
                    │ PUT /api/enrollments/:courseId/lessons/:lessonId/progress
                    ▼
        ┌────────────────────────┐
        │ Backend                │
        │ enrollmentController   │
        │ updateLessonWatchProgress
        └───────────┬────────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ MongoDB                │
        │ enrollments collection │
        │ progress: [{           │
        │   lessonId,            │
        │   watchedSeconds,      │
        │   durationSeconds,     │
        │   progressPercentage   │
        │ }]                     │
        └────────────────────────┘
```

---

## Key Implementation Files

| File | Purpose | Key Functions/Logic |
|------|---------|---------------------|
| `server/config/upload.js` | Multer disk storage config | Saves uploads to `uploads/lessons/`, 500MB limit, video format filter |
| `server/utils/driveUploader.js` | Google Drive upload helper | `uploadVideoToDrive()`, `deleteDriveFile()`, OAuth/Service Account auth |
| `server/controllers/courseController.js` | Lesson creation API | `addLesson()` — handles upload, Drive upload, YouTube ID extraction |
| `server/controllers/enrollmentController.js` | Progress tracking API | `updateLessonWatchProgress()` — updates `enrollments.progress` |
| `server/routes/enrollments.js` | Progress API routes | `PUT /:courseId/lessons/:lessonId/progress` |
| `src/components/course/LessonPlayer.jsx` | Video playback UI | Video rendering, YouTube IFrame API, anti-skip logic, progress polling |
| `src/services/enrollmentService.js` | Frontend API wrapper | `updateLessonProgress()` — PUT request helper |

---

## Progress Tracking Deep Dive

### Anti-Skip Mechanism (applies to Local + YouTube only)

**State Management:**
```javascript
const [watchedUntil, setWatchedUntil] = useState(0); // highest continuous second
const videoRef = useRef(null); // <video> DOM reference
const ytPlayerRef = useRef(null); // YouTube player instance
```

**Local Video (timeUpdate event):**
```javascript
const handleTimeUpdate = () => {
  const current = Math.floor(videoRef.current.currentTime);
  const duration = Math.floor(videoRef.current.duration);
  
  // Allow forward only if within +2s tolerance (pause/buffer grace)
  if (current <= watchedUntil + 2) {
    if (current > watchedUntil) setWatchedUntil(current);
  } else {
    // User tried to skip ahead → seek back
    videoRef.current.currentTime = watchedUntil;
  }
  
  // Update UI progress bar
  setProgressPct(Math.round((watchedUntil / duration) * 100));
  
  // Save to backend (throttled)
  maybePersistProgress(current, duration);
};
```

**YouTube (polling interval):**
```javascript
// Inside YT.PlayerState.PLAYING handler
setInterval(() => {
  const cur = Math.floor(ytPlayerRef.current.getCurrentTime());
  const dur = Math.floor(ytPlayerRef.current.getDuration());
  
  if (cur <= watchedUntil + 2) {
    if (cur > watchedUntil) setWatchedUntil(cur);
  } else {
    ytPlayerRef.current.seekTo(watchedUntil, true); // force seek
  }
  
  maybePersistProgress(cur, dur);
}, 1000);
```

**Backend Persistence (throttled every 4s):**
```javascript
const maybePersistProgress = (current, duration) => {
  if (!enrollment || !lesson || !duration) return;
  const now = Date.now();
  
  // Throttle: only save every 4s (or on video end)
  if (now - progressSaveThrottle.current < 4000 && current !== duration) return;
  
  lastReportedSecond.current = current;
  progressSaveThrottle.current = now;
  
  enrollmentService.updateLessonProgress(enrollment.course._id, lesson._id, {
    watchedSeconds: Math.max(current, watchedUntil),
    durationSeconds: duration
  }).catch(()=>{}); // silent fail (will retry on next interval)
};
```

**Backend Update (MongoDB):**
```javascript
// enrollmentController.updateLessonWatchProgress
const enrollment = await Enrollment.findOne({ user: userId, course: courseId });
const progressEntry = enrollment.progress.lessonWatch.find(lw => lw.lesson.equals(lessonId));

if (progressEntry) {
  // Update existing
  progressEntry.watchedSeconds = watchedSeconds;
  progressEntry.durationSeconds = durationSeconds;
  progressEntry.progressPercentage = Math.round((watchedSeconds / durationSeconds) * 100);
  progressEntry.lastWatchedAt = new Date();
} else {
  // Add new entry
  enrollment.progress.lessonWatch.push({
    lesson: lessonId,
    watchedSeconds,
    durationSeconds,
    progressPercentage: Math.round((watchedSeconds / durationSeconds) * 100),
    lastWatchedAt: new Date()
  });
}

await enrollment.save();
```

---

## Auto-Complete Logic

### Thresholds
- **60%** — eligible for manual "Finish Early" button
- **90%** — automatic completion (marks lesson complete without user action)

### Implementation
```javascript
const handleVideoThresholdCompletion = async (durOverride) => {
  const dur = durOverride || videoDuration || 0;
  if (!dur) return;
  
  const ratio = watchedUntil / dur;
  
  // Auto-complete at 90%
  if (ratio >= 0.9 && enrollment && !isCompleted && !autoCompleting) {
    setAutoCompleting(true);
    await markLessonComplete(enrollment.course._id, lesson._id);
    setAutoCompleting(false);
  }
};

// Manual complete at 60% (triggered by UI button)
const handleManualCompletion = async () => {
  if ((watchedUntil / videoDuration) >= 0.6 && !isCompleted) {
    await enrollmentService.updateLessonProgress(
      enrollment.course._id,
      lesson._id,
      { watchedSeconds: watchedUntil, durationSeconds: videoDuration, markIfThreshold: true }
    );
    await markLessonComplete(enrollment.course._id, lesson._id);
  }
};
```

**Backend Marking:**
```javascript
// enrollmentController.markLessonComplete
enrollment.progress.completedLessons.push({ lesson: lessonId, completedAt: new Date() });

// Check if all required lessons complete → mark course complete
const allLessonsCompleted = /* logic to check all lessons */;
if (allLessonsCompleted) {
  enrollment.isCompleted = true;
  enrollment.completedAt = new Date();
}

await enrollment.save();
```

---

## Drive Video Limitation (Important)

**Problem:**
- Drive iframe embed (`https://drive.google.com/file/d/<id>/preview`) is cross-origin sandboxed
- Browser security (CORS) blocks JavaScript from reading playback state inside iframe
- **Cannot access `currentTime`, `duration`, or events** from parent page

**Current Behavior:**
- Drive videos play but **no progress tracking or anti-skip enforcement**
- User can skip freely inside Drive's player controls
- Dashboard shows 0% progress for Drive-only lessons

**Workarounds (not implemented):**
1. **Server-side proxy stream** — fetch video from Drive, stream through Express endpoint with range request support → use `<video>` tag
2. **postMessage API** — if Drive supported it (it doesn't)
3. **Switch to local/S3** — for paid/tracked content, avoid Drive iframe

**Recommendation:**
- Use Drive **only for free preview lessons** where tracking is optional
- Use **local storage** or **cloud object storage (S3)** + signed URLs for paid/private content

---

## Security & Privacy Notes

### Current Setup (Public Links)
- **Local files:** served publicly via `/uploads` static route (no auth check)
- **Drive files:** public `anyone:reader` permission (anyone with link can view)
- **YouTube:** public embed (video owner controls access)

### Risks
- Paid/private content is accessible to anyone with the URL (no user verification)
- URLs can be shared or leaked

### Recommended Improvements (Production)
1. **Authenticated static serving:**
   ```javascript
   app.get('/uploads/lessons/:filename', protect, async (req, res) => {
     // Check enrollment before serving file
     const enrollment = await Enrollment.findOne({ user: req.user._id, course: courseIdFromLesson });
     if (!enrollment) return res.status(403).json({ error: 'Not enrolled' });
     res.sendFile(path.join(__dirname, 'uploads', 'lessons', req.params.filename));
   });
   ```

2. **Drive proxy with auth:**
   ```javascript
   app.get('/proxy/drive/:fileId', protect, async (req, res) => {
     // Verify enrollment
     // Fetch from Drive using service account
     // Stream to response with range request support
   });
   ```

3. **Signed URLs (S3/Cloud Storage):**
   - Generate time-limited signed URL per request
   - URL expires after N minutes
   - Cannot be reused or shared

---

## Performance Considerations

### Upload
- **Large files (>500MB):** consider chunked/resumable uploads
- **Simultaneous uploads:** queue or limit concurrency on backend

### Playback
- **Local files:** server must handle bandwidth (consider CDN)
- **Drive:** Google handles CDN/buffering (free hosting)
- **YouTube:** external CDN (best performance)

### Progress API
- **Throttling:** 4-second intervals (max ~15 requests/minute per video)
- **Debouncing:** prevents spam during seeks/buffering
- **Silent failures:** progress save errors don't block playback

---

## Summary Table: Feature Comparison

| Feature | Local Video | Google Drive | YouTube |
|---------|-------------|--------------|---------|
| **Upload** | Multer → disk | Multer → disk → Drive API | Paste URL (external) |
| **Storage** | Server disk (`uploads/lessons/`) | Google Drive cloud | YouTube servers |
| **Serving** | Express static middleware | Drive iframe embed | YouTube IFrame API |
| **Playback Control** | `<video>` tag | Drive player (iframe) | YouTube player (API) |
| **Progress Tracking** | ✅ Yes (timeUpdate events) | ❌ No (iframe sandbox) | ✅ Yes (polling API) |
| **Anti-Skip** | ✅ Yes (seek enforcement) | ❌ No | ✅ Yes (seekTo enforcement) |
| **Auto-Complete** | ✅ 90% threshold | ❌ N/A | ✅ 90% threshold |
| **Resume** | ✅ Seeks to `watchedUntil` | ❌ N/A | ✅ Seeks to `watchedUntil` |
| **Privacy** | 🟡 Public URL (needs auth) | 🟡 Public link (anyone) | 🟡 Public embed |
| **Bandwidth** | 🔴 Server pays | 🟢 Google pays | 🟢 YouTube pays |
| **Seeking UX** | ✅ Native controls | ✅ Drive controls | ✅ YouTube controls |
| **Recommended For** | Paid content (with auth proxy) | Free previews | Public lessons |

---

## Quick Start (Testing Video System)

### 1. Upload Local Video
```bash
# Frontend: CourseDetail or AdminCourseEditor
# Select video file → POST /api/courses/:id/lessons
# Server saves to uploads/lessons/<file>
# Play: <video src="/uploads/lessons/<file>">
```

### 2. Upload to Drive
```bash
# Set env vars in server/.env:
GOOGLE_DRIVE_PARENT_FOLDER_ID=<folder_id>
# Service Account:
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
# OR OAuth (run once):
cd server && node scripts/oauthInit.js
# Then upload video (same as local) → server auto-uploads to Drive if configured
```

### 3. Add YouTube Lesson
```bash
# Paste YouTube URL: https://youtube.com/watch?v=dQw4w9WgXcQ
# Server extracts videoId → stores in lesson.content.data
# Play: renders YT.Player with API
```

### 4. Watch Progress in DB
```javascript
// MongoDB shell or Compass
db.enrollments.find({ userId: ObjectId("...") })
// Check progress.lessonWatch array for watchedSeconds
```

---

## Common Issues & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| Drive upload fails with quota error | Service Account has no storage | Use Shared Drive or switch to OAuth |
| YouTube player doesn't load | API script blocked/slow | Check network, ensure `https://www.youtube.com/iframe_api` accessible |
| Progress not saving | Auth token missing or invalid | Check JWT in localStorage/headers |
| Video skipping allowed (local) | Anti-skip logic bypassed | Verify `watchedUntil` state updates and seek logic |
| Drive videos not tracking | Expected behavior | Use local/S3 for tracked content |
| Large file upload timeout | Server/multer limits | Increase multer `limits.fileSize` and nginx timeout |

---

## Next Steps / Roadmap

### High Priority
- [ ] Add authenticated static file serving (proxy for local files)
- [ ] Implement Drive proxy stream for private video tracking
- [ ] Switch to S3/Cloud Storage + signed URLs for production

### Medium Priority
- [ ] Add video transcoding (FFmpeg) for multi-bitrate streaming (HLS/DASH)
- [ ] Implement resumable/chunked uploads for large files
- [ ] Add download option for offline viewing (with DRM)

### Low Priority
- [ ] Add subtitles/captions support (WebVTT)
- [ ] Playback speed controls (0.5x, 1.5x, 2x)
- [ ] Picture-in-picture mode
- [ ] Analytics dashboard (watch time, drop-off points)

---

**End of Document**

For questions or implementation help, refer to:
- `src/components/course/LessonPlayer.jsx` (frontend logic)
- `server/controllers/courseController.js` (upload/lesson creation)
- `server/controllers/enrollmentController.js` (progress tracking)
- `server/utils/driveUploader.js` (Drive integration)
