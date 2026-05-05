# LearnMate — Technical Documentation Part 2

## Feature-by-Feature Implementation Deep Dive

---

## Feature 1: Authentication System (JWT + Google OAuth)

### Internal Flow
```
Registration: Client POST /api/auth/register → express-validator → User.create() → pre-save hook bcrypt(10) → jwt.sign({id}) → return {token, user}

Login: Client POST /api/auth/login → find user with +password → bcrypt.compare → jwt.sign → return {token, user}

Google OAuth: Client POST /api/auth/google → verify Google ID token via google-auth-library → find/create user → jwt.sign → return {token, user}
```

### Code-Level: Auth Middleware Pipeline
```javascript
// Every protected request flows through:
// 1. Extract Bearer token from Authorization header
// 2. jwt.verify(token, JWT_SECRET) → decoded { id, iat, exp }
// 3. User.findById(decoded.id).select('-password')
// 4. Attach req.user → call next()

// Role authorization (composable):
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({...});
  next();
};
```

### Frontend State: useReducer + localStorage
```javascript
// AuthContext uses useReducer with actions: LOGIN, LOGOUT, UPDATE_USER, SET_LOADING
// On app mount: reads cached user from localStorage → dispatches LOGIN immediately
// Then verifies token in background via GET /api/auth/user (non-blocking)
// If token invalid → clears storage → dispatches LOGOUT
// Axios interceptor auto-attaches Bearer token to every request
```

### Edge Cases Handled
- **Google-only users**: Password field conditionally required (`this.authProvider !== 'google'`)
- **Account linking**: If existing email user logs in with Google, links `googleId` without overwriting password
- **Token expiry**: 401 response interceptor auto-redirects to /login (except for payment/AI endpoints — suppressed to show error inline)
- **Race condition on mount**: Cached user shown immediately; background verify updates if stale

### Trade-offs
- **Stateless JWT** chosen over sessions: simpler for split Vercel/Render deployment, but **no server-side revocation**. Logout only clears client storage.
- **30-day token expiry**: Convenient for students, but a stolen token is valid for 30 days. Mitigation: HTTPS + short-lived tokens in production.

---

## Feature 2: Course Management (CRUD + Ownership)

### Internal Flow
```
Create: POST /api/courses → if course_admin: force owner = req.user._id → Course.create(body)
Update: PUT /api/courses/:id → ownership check → prevent owner change by course_admin → findByIdAndUpdate
Delete: DELETE /api/courses/:id → ownership check → collect Drive fileIds → deleteOne → Lesson.deleteMany → Drive cleanup (best-effort) → Enrollment.deleteMany
```

### Ownership Scoping (Multi-Tenant Pattern)
```javascript
// course_admin can only see/modify their own courses:
if (req.user.role === 'course_admin') {
  query.owner = req.user._id; // scopes all queries
  // On update: verifies String(existing.owner) === String(req.user._id)
  // On update: deletes req.body.owner to prevent ownership transfer
}
// website_admin: no scoping, sees all courses
```

### Course Search: Multi-Strategy
```javascript
// Strategy 1: Full-text search (MongoDB $text index on title+description+tags)
if (search) query.$text = { $search: search };

// Strategy 2: Prefix search (optimized with title:1 index)
if (startsWith) query.title = { $regex: `^${escaped}`, $options: 'i' };

// Strategy 3: Category + Level filters
// Strategy 4: Sort by createdAt (desc) or title (asc)
// Pagination: skip/limit pattern
```

### Edge Case: Cascade Delete with Drive Cleanup
```javascript
// On course delete:
// 1. Collect all lesson Drive fileIds BEFORE deletion
// 2. Delete course document
// 3. Delete all lessons (Lesson.deleteMany)
// 4. Loop through collected fileIds → deleteDriveFile() (best-effort, logged but non-blocking)
// 5. Delete all enrollments
// Why collect first? After Lesson.deleteMany, the data is gone.
```

---

## Feature 3: Video & Media Pipeline

### Three Storage Modes

**Local Upload Flow:**
```
Admin form → multipart POST → Multer diskStorage → uploads/lessons/<timestamp-random>.ext
→ content.data = { videoUrl: '/uploads/lessons/...', storage: 'local' }
→ Express serves via express.static('/uploads')
```

**Google Drive Upload (with fallback):**
```
1. Multer saves locally first (always)
2. uploadVideoToDrive(localPath, originalName)
3. getDrive() → lazy-loads googleapis → prefers OAuth tokens over Service Account
4. drive.files.create({ media: fs.createReadStream }) → gets fileId
5. drive.permissions.create({ role: 'reader', type: 'anyone' }) → public link
6. Returns { driveFileId, webViewLink, webContentLink }
7. Controller adds embedLink: https://drive.google.com/file/d/${id}/preview
8. Sets storage: 'drive'
9. IF FAILS → keeps storage: 'local', logs [DriveUpload] error
```

**YouTube:**
```
1. Admin pastes URL → regex extracts 11-char videoId
2. Stores { youtubeUrl, videoId, thumbnailUrl: maxresdefault.jpg }
3. Frontend: lazy play overlay → on click → loads YT IFrame API → new YT.Player()
```

### Anti-Skip Implementation (Critical)
```javascript
// Local: onTimeUpdate event handler
if (currentTime <= watchedUntil + 2) {  // 2-second tolerance for buffering
  if (currentTime > watchedUntil) setWatchedUntil(currentTime);
} else {
  videoRef.current.currentTime = watchedUntil; // FORCE seek back
}

// YouTube: 1-second polling interval
if (cur > watchedUntil + 2) {
  ytPlayerRef.current.seekTo(watchedUntil, true); // force seek
}

// Drive: NO anti-skip possible (iframe cross-origin sandbox)
```

### Drive Limitation (Interview-Critical Point)
- Drive iframe is **cross-origin sandboxed** — JavaScript cannot read `currentTime` or `duration`
- Progress tracking is **impossible** for Drive-hosted videos
- **Design decision**: Drive recommended only for free preview lessons
- **Production fix**: Server-side proxy streaming endpoint (planned roadmap)

---

## Feature 4: AI Integration (Gemini)

### Student Chat Widget
```javascript
// POST /api/ai/chat
// System prompt: "You are LearnMate AI Tutor... Keep answers under 220 words..."
// Converts OpenAI message format → Gemini format (user/model roles)
// Context window: last 20 messages (sliced)
// Generation config: temperature=0.7, maxOutputTokens=500
// Error handling: 429→rate limit, 401/403→invalid key, 500→server error
```

### AI Quiz Generation (Admin)
```javascript
// POST /api/ai/generate-quiz
// Input: { topic, lessonContent, count(1-25), difficulty(easy/medium/hard) }
// Prompt engineering: difficulty descriptor mapped to pedagogical language
// Output: strict JSON schema { questions: [{ question, options[4], answer, explanation }] }
// Fallback parsing: if JSON.parse fails → regex extracts {...} → re-parse
// Normalization: truncate question(300), options(120), explanation(400)
// Filter: removes questions with <4 options
// Each question gets unique id: `ai-${Date.now()}-${index}`
```

### Quiz Variant Generation (Regenerate / More-Like-This)
```javascript
// POST /api/ai/generate-variant
// mode='regenerate': "Improved alternative, keep core concept"
// mode='more_like_this': "Same concept, different scenario" (higher temperature=0.9)
// Returns single question with id: `ai-var-${Date.now()}`
```

### Similarity Dedup (Jaccard Threshold)
```
// Client-side: before displaying AI questions
// Jaccard word-set overlap: tokenize → unique word sets → |intersection|/|union|
// Threshold ≥ ~85% → treated as duplicate → filtered out
// Why client-side? Keeps server stateless; admin sees final selection
```

---

## Feature 5: Progress Tracking & Auto-Completion

### Throttled Persistence
```javascript
// Frontend: maybePersistProgress() called on every timeUpdate
// Throttle: only sends PUT if Date.now() - lastSave >= 4000ms
// Exception: always saves on video end (currentTime === duration)
// Silent failure: .catch(()=>{}) — progress loss is non-critical, will retry next interval
```

### Backend: Monotonic Update Pattern
```javascript
// PUT /api/enrollments/:courseId/lessons/:lessonId/progress
const existing = enrollment.progress.lessonWatch.find(l => l.lesson.toString() === lessonId);
if (existing) {
  // ONLY allow increase — prevents replay/tampering
  if (watchedSeconds > existing.watchedSeconds) existing.watchedSeconds = watchedSeconds;
  if (durationSeconds > existing.durationSeconds) existing.durationSeconds = durationSeconds;
} else {
  enrollment.progress.lessonWatch.push({ lesson, watchedSeconds, durationSeconds });
}
```

### Dual-Threshold Completion
```
60% → "Finish Early" button appears (manual opt-in, requires markIfThreshold=true)
90% → Auto-completion (server-side, no user action needed)
```

### Duration-Weighted Progress Calculation
```javascript
// Why not simple count-based?
// A 5-min lesson shouldn't equal a 2-hour lesson in progress weight
const totalDuration = allLessons.reduce((sum, l) => sum + (l.duration || 0), 0);
const completedDuration = allLessons.filter(in completedSet).reduce(sum + duration);
const durationWeighted = Math.round((completedDuration / totalDuration) * 100);
// Fallback: if all durations are 0, uses count-based percentage
```

---

## Feature 6: Discussion Forum

### Threading Model
```
Discussion (top-level topic)
  └── DiscussionMessage (parentMessage: null) — root message
       └── DiscussionMessage (parentMessage: rootId) — reply
            └── (no deeper nesting — flat reply model)
```

### Efficient Query Pattern (Batch Replies)
```javascript
// Instead of N+1 (fetch each message's replies separately):
// 1. Fetch all parent messages for discussion
const parentMessages = await DiscussionMessage.find({ discussion: id, parentMessage: null });
// 2. Single batch query for ALL replies
const allReplies = await DiscussionMessage.find({ parentMessage: { $in: parentIds } });
// 3. Group in-memory by parentId → O(n) hash map
const repliesByParent = {};
allReplies.forEach(r => repliesByParent[r.parentMessage.toString()].push(r));
```

### Voting System (Toggle Pattern)
```javascript
// Remove existing votes first (both up and down)
discussion.upvotes = discussion.upvotes.filter(v => v.user.toString() !== userId);
discussion.downvotes = discussion.downvotes.filter(v => v.user.toString() !== userId);
// Then add new vote based on type
if (type === 'up') discussion.upvotes.push({ user: userId });
// 'remove' type → just clears, doesn't add
```

### Moderation: Pin/Lock/Resolve/Delete
```javascript
// Authorization: website_admin OR course_admin OR course owner OR discussion author
// Actions: switch(action) { case 'pin': discussion.isPinned = value; ... }
// Locked discussions: createMessage checks isLocked → 403 if locked
// Soft delete for messages: isDeleted=true, deletedAt, deletedBy (preserves thread structure)
```

---

## Feature 7: Payment Integration (Razorpay)

### Two-Phase Flow
```
Phase 1 — Create Order:
  POST /api/payments/create-order { courseId }
  → Verify course exists, is published, price > 0
  → razor.orders.create({ amount: price*100, currency: 'INR' })
  → Upsert Payment doc with razorpayOrderId, status: 'created'
  → Return { orderId, amount, key: RAZORPAY_KEY_ID }

Phase 2 — Verify Payment:
  POST /api/payments/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
  → HMAC-SHA256 verify: order_id|payment_id signed with KEY_SECRET
  → If valid: update Payment status='paid', auto-enroll student
```

### Demo Mode (No Gateway)
```javascript
// If RAZORPAY_KEY_ID/SECRET missing OR DEMO_PAYMENTS=true:
// Simulates instant payment success → auto-enrolls → returns { demo: true, enrolled: true }
// Allows full testing without Razorpay credentials
```

### Edge Case: Preventing Free Course Payment
```javascript
if (course.price === 0) return res.status(400).json({ message: 'Course is free' });
```

---

## Feature 8: Certificate Generation (PDFKit)

### Flow
```
GET /api/enrollments/:courseId/certificate
→ Verify enrollment exists AND progressPercentage === 100
→ Generate PDF in-memory using PDFKit (no temp files)
→ Geometric design: circles, dot patterns, blue/yellow theme
→ Content: student name, course title, date with ordinal suffix, cert ID
→ Stream as application/pdf with Content-Disposition attachment
```

### Design Decision
- **In-memory generation** (Buffer.concat chunks) — no disk I/O, stateless
- **No caching** — certificates are generated on-demand (could cache in production)
- **Cert ID**: last 10 chars of enrollment ObjectId (uppercase) — simple but unique

---

## Feature 9: Lesson Order Collision Retry

### Problem
When multiple admins add lessons simultaneously, the auto-calculated `nextOrder` can collide (race condition) against the `{ course: 1, order: 1 }` unique index.

### Solution: Retry Loop
```javascript
let lesson;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    lesson = await Lesson.create({ ..., order: nextOrder });
    break; // success
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.course && err.keyPattern?.order) {
      nextOrder += 1; // bump and retry
      continue;
    }
    throw err; // non-duplicate error, propagate
  }
}
if (!lesson) return res.status(500).json({ message: 'Ordering conflict' });
```

### Why Not Use Transactions?
- MongoDB transactions require replica sets (not always available in dev)
- Retry is simpler, deterministic, and sufficient for low-contention scenarios
- Max 3 attempts covers realistic collision probability
