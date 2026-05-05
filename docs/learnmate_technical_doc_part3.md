# LearnMate — Technical Documentation Part 3

## Real-World Problems, API Design, Security, Performance & DevOps

---

## 4. ⚠️ REAL-WORLD PROBLEMS FACED

### Problem 1: Google Drive Storage Quota Error
- **What happened**: Service account uploads failed with "Service Accounts do not have storage quota"
- **Root cause**: Service accounts don't have personal Google Drive storage — they need a Shared Drive or domain delegation
- **Debugging**: `[DriveUpload]` prefix logs caught the error; regex match on error message for specific guidance
- **Solutions considered**: (1) Shared Drive, (2) Domain-wide delegation, (3) OAuth personal flow
- **Fix implemented**: Added OAuth personal Gmail flow as alternative + graceful fallback to local storage
- **What I'd do differently**: Start with S3/Cloud Storage instead of Drive for production — Drive's permission model isn't designed for programmatic file management

### Problem 2: Drive Iframe Cross-Origin Progress Tracking
- **What happened**: Progress tracking broke for Drive-hosted videos — 0% always shown
- **Root cause**: `https://drive.google.com/file/d/.../preview` iframe is cross-origin sandboxed; parent page cannot access `currentTime` or fire events
- **Debugging**: Browser DevTools → Console showed CORS errors when trying `postMessage`; iframe `contentWindow` inaccessible
- **Solutions considered**: (1) `postMessage` API (Drive doesn't support), (2) Server-side proxy stream, (3) Switch to local/S3
- **Fix implemented**: Documented as known limitation; Drive used only for free previews. Local videos use `<video>` tag with full tracking
- **What I'd do differently**: Build a proxy streaming endpoint from day 1; serve all video via `<video>` tag for consistent tracking

### Problem 3: Lesson Order Duplicate Key Collision
- **What happened**: Concurrent lesson additions caused `E11000 duplicate key error` on `{course, order}` unique index
- **Root cause**: Two requests calculate `maxOrder + 1` simultaneously → both try to insert same order number
- **Debugging**: MongoDB error code 11000 + `keyPattern` inspection in catch block
- **Fix**: Retry loop (up to 3 attempts) with `nextOrder += 1` on collision. Deterministic resolution without transactions.

### Problem 4: CORS Failures Between Vercel & Render
- **What happened**: Frontend on Vercel couldn't reach backend on Render — `CORS policy` errors
- **Root cause**: `CLIENT_URL` env var didn't match actual Vercel deployment URL; also needed comma-separated multi-origin support
- **Fix**: Changed CORS config to split `CLIENT_URL` by comma, allowing multiple origins. Added `credentials: true`.

### Problem 5: Gemini API JSON Parsing Failures
- **What happened**: AI quiz generation returned malformed JSON — markdown backticks wrapping the JSON
- **Root cause**: LLM sometimes wraps output in ` ```json ... ``` ` despite "no markdown backticks" instruction
- **Fix**: Fallback regex extraction `raw.match(/\{[\s\S]*\}/)` → re-parse. Double safety net for LLM output unpredictability.

### Problem 6: Google OAuth Token Refresh
- **What happened**: Drive uploads stopped working after token expiry
- **Root cause**: OAuth tokens weren't being refreshed; `invalid_grant` error
- **Fix**: `deleteDriveFile()` has retry logic — on auth-related errors, forces `getDrive(true)` refresh on second attempt. For upload: if OAuth fails, falls back to service account.

---

## 5. 🛠️ DEBUGGING & FAILURE SCENARIOS

| Bug Type | How Identified | Tool Used | Prevention |
|---|---|---|---|
| Race condition (lesson order) | Production 500 errors with E11000 | MongoDB error code inspection | Retry loop with order bump |
| Memory concern (large uploads) | 500MB multer limit hit | `multer.limits.fileSize` config | Set 500MB cap; chunked uploads on roadmap |
| Token expiry redirect loop | Users reported infinite login redirects | Axios interceptor logs | Suppress 401 redirect for payment/AI endpoints |
| Drive quota exhaustion | Console logs `[DriveUpload]` | Structured prefix logging | Graceful fallback to local; clear error messages |
| Stale auth state | Users saw wrong role after admin change | Background token re-verify | `authAPI.getUser()` in background on mount |

### Structured Logging Convention
```
[DriveUpload] → Drive client lifecycle, upload/delete operations
[LessonAdd]   → Post-upload warnings, fallback notifications
[OAuthInit]   → OAuth token acquisition script
[AUTH]        → JWT verification, user lookup
[PAYMENT]     → Razorpay order creation, verification
```

---

## 6. 🔄 API DESIGN

### Complete Endpoint Map

#### Auth (`/api/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Register with email/password |
| POST | `/login` | Public | Login, returns JWT |
| POST | `/google` | Public | Google OAuth login |
| GET | `/user` | Protected | Get current user by token |
| PUT | `/user` | Protected | Update profile |

#### Courses (`/api/courses`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List courses (paginated, filterable) |
| GET | `/categories` | Public | Get distinct categories |
| GET | `/:id` | Public | Get course with lessons |
| POST | `/` | Admin | Create course |
| PUT | `/:id` | Admin+Owner | Update course |
| DELETE | `/:id` | Admin+Owner | Delete course + cascade cleanup |
| POST | `/:id/lessons` | Admin+Owner | Add lesson (multipart for video) |
| GET | `/:courseId/lessons/:lessonId` | Protected | Get full lesson content |

#### Enrollments (`/api/enrollments`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/:courseId` | Protected | Enroll (checks payment for paid courses) |
| GET | `/` | Protected | Get user's enrollments |
| GET | `/:courseId` | Protected | Get enrollment details |
| PUT | `/:courseId/lessons/:lessonId/complete` | Protected | Mark lesson complete |
| PUT | `/:courseId/lessons/:lessonId/progress` | Protected | Update watch progress |
| PUT | `/:courseId/current-lesson/:lessonId` | Protected | Update current lesson pointer |
| GET | `/:courseId/certificate` | Protected | Download PDF certificate |
| DELETE | `/:courseId` | Protected | Unenroll |

#### AI (`/api/ai`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/chat` | Protected | AI chat (Gemini) |
| POST | `/generate-quiz` | Protected | Generate quiz questions |
| POST | `/generate-variant` | Protected | Regenerate/more-like-this |

#### Discussions (`/api/courses`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/:courseId/discussions` | Protected+Enrolled | List discussions |
| POST | `/:courseId/discussions` | Protected+Enrolled | Create discussion |
| GET | `/:courseId/discussions/:id` | Protected+Enrolled | Get with messages |
| POST | `/discussions/:id/vote` | Protected | Vote up/down/remove |
| POST | `/discussions/:id/moderate` | Admin | Pin/Lock/Resolve |
| DELETE | `/discussions/:id` | Admin/Author | Delete discussion |
| POST | `/discussions/:id/messages` | Protected | Create message/reply |
| POST | `/messages/:id/vote` | Protected | Vote on message |
| PUT | `/messages/:id` | Author | Edit message |
| DELETE | `/messages/:id` | Admin/Author | Soft-delete message |

### Error Response Format
```json
{
  "success": false,
  "message": "Human-readable error description",
  "errors": [{ "msg": "...", "param": "field" }],  // validation errors
  "stack": "..."  // development only
}
```

### Validation Strategy
- **express-validator**: Registration (name 2-50, email format, password 6+), login, course creation (title 5-100, category enum, level enum), lesson creation (title 3-100, order int)
- **Mongoose schema validation**: maxlength, enum, required, min/max constraints
- **Controller-level**: Business logic validation (course exists? published? enrolled? paid?)

---

## 7. 🔐 SECURITY DESIGN

### Authentication
- **Password hashing**: bcrypt with 10 salt rounds (pre-save hook)
- **Password field**: `select: false` — never returned in queries unless explicitly requested
- **JWT signing**: HS256 with `JWT_SECRET`, 30-day expiry
- **Google OAuth**: Server-side token verification via `google-auth-library`

### Authorization (RBAC)
```
user          → Browse courses, enroll, watch, discuss, bookmark
course_admin  → CRUD own courses/lessons, moderate own course discussions
website_admin → All course_admin abilities + manage all users/courses, analytics
```

### Vulnerabilities Addressed
| Vulnerability | Mitigation |
|---|---|
| XSS via lesson content | React auto-escapes; Markdown rendered via react-markdown (sanitized) |
| CORS bypass | Whitelist-based origin check; `credentials: true` |
| NoSQL injection | Mongoose parameterized queries; express-validator input sanitization |
| File upload attacks | Multer `fileFilter` restricts to .mp4/.webm/.ogg/.mov; 500MB limit |
| Regex DoS (ReDoS) | `startsWith` search escapes special regex chars before interpolation |
| Broken access control | Owner-check on every course_admin mutation; enrollment-check on discussions |

### Current Security Gaps (Be Honest in Interview)
1. **No rate limiting** on API endpoints (AI, auth, progress) — vulnerable to brute force
2. **Static file serving is unauthenticated** — `/uploads/lessons/*` accessible without JWT
3. **Drive files are `anyone:reader`** — URL sharing exposes paid content
4. **No CSRF protection** — mitigated by JWT-only auth (no cookies), but not ideal
5. **No password reset flow** — users can't recover accounts

---

## 8. 🚀 PERFORMANCE & SCALING

### Bottlenecks Discovered During Development

| Bottleneck | Discovery | Fix Applied |
|---|---|---|
| N+1 queries in discussion messages | Slow page loads with many replies | Batch query: single find for all replies, in-memory grouping |
| Progress API spam | 15+ requests/minute per video viewer | 4-second throttle + silent failure |
| Large video upload timeouts | 500MB files timing out | Multer disk storage (streaming, not memory); chunked uploads planned |
| Admin analytics slow | Multiple countDocuments calls | Aggregation pipeline with `$lookup` for enrollment counts |
| Discussion view count writes | Write on every GET request | Fire-and-forget `Discussion.updateOne({$inc: {views: 1}}).exec()` — no await |

### Caching Strategy (Current: None, Recommended)
```
Layer 1: HTTP cache headers for static assets (Vite build hashes)
Layer 2: In-memory cache (node-cache) for categories, popular courses (TTL: 5min)
Layer 3: Redis for session data, rate limiting counters
Layer 4: CDN (CloudFront/Cloudflare) for video delivery
```

### Connection Pool Config
```javascript
mongoose.connect(uri, {
  maxPoolSize: 10,              // 10 concurrent connections
  serverSelectionTimeoutMS: 15000, // 15s to find a server
  socketTimeoutMS: 45000        // 45s socket timeout
});
```

---

## 9. 🧪 TESTING STRATEGY

### Current State: No Automated Tests
The repository has no test suite. This is a known gap.

### Recommended Test Plan
| Layer | Tool | What to Test |
|---|---|---|
| Unit | Jest | Mongoose model validation, JWT helpers, YouTube regex, Jaccard similarity |
| API Integration | Jest + Supertest | Auth flow, CRUD operations, enrollment lifecycle, payment verify |
| E2E | Playwright/Cypress | Student enrollment flow, video playback, quiz taking, admin course creation |
| Load | Artillery/k6 | Progress API under 1000 concurrent students watching videos |

### Edge Cases That Should Be Tested
- Double enrollment attempt (should return 400, not create duplicate)
- Payment for free course (should return 400)
- Lesson order collision under concurrency
- AI response with malformed JSON
- Drive upload with expired OAuth tokens
- Certificate download before 100% completion

---

## 10. 📦 DEVOPS & DEPLOYMENT

### Current Architecture
```
Frontend: Vercel (SPA)
  - vercel.json: rewrites all routes to /index.html (SPA routing)
  - Build: vite build → dist/
  - Env: VITE_API_URL, VITE_GOOGLE_CLIENT_ID

Backend: Render/Railway
  - Entry: node server.js
  - Env: MONGODB_URI, JWT_SECRET, GEMINI_API_KEY, Drive credentials
  - Static: /uploads served via Express (ephemeral on Render!)

Database: MongoDB Atlas
  - Shared M0 free tier or M10+ for production
```

### Deployment Issues Faced
1. **Ephemeral file storage on Render**: Uploaded videos lost on redeploy → Drive upload or S3 essential for production
2. **CORS mismatch**: Vercel URL different from `CLIENT_URL` → comma-separated origin support added
3. **Vite proxy only works in dev**: Production frontend must use full API URL via `VITE_API_URL`
4. **`googleapis` cold start**: Large package (~60MB); lazy import via `await import('googleapis')` to avoid startup penalty when Drive not configured

### Missing CI/CD (Recommended)
```yaml
# GitHub Actions workflow (recommended):
- Install dependencies (npm ci)
- Lint (eslint)
- Run tests (jest)
- Build frontend (vite build)
- Deploy frontend to Vercel (auto via Git integration)
- Deploy backend to Render (auto via Git integration)
```

---

## 11. 🧠 TRADE-OFF ANALYSIS

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Database | MongoDB | PostgreSQL | Polymorphic lesson `content.data` fits documents; flexible schema evolution; easier for rapid prototyping |
| Auth | JWT (stateless) | Sessions + Redis | No server-side state; works with split deployment; trade-off: no revocation |
| Video storage | Local + Drive fallback | S3 from start | Zero cost to start; Drive provides free CDN; trade-off: no progress tracking for Drive videos |
| AI provider | Google Gemini | OpenAI GPT | Generous free tier; native Google ecosystem fit; structured output for quiz JSON |
| Payment | Razorpay + Demo mode | Stripe | India-focused; INR native; demo mode enables testing without credentials |
| File upload | Multer (disk) | Multer (memory) → S3 | Disk avoids OOM for large files; local file serves as fallback |
| Progress persistence | REST API polling | WebSocket | REST is simpler; 4s throttle limits load; WebSocket adds infra complexity |
| Discussion replies | Flat (1-level) | Recursive nesting | Simpler queries; batch-loadable; Reddit-style deep nesting rarely needed in course context |
| Search | MongoDB $text + regex | Elasticsearch | Sufficient for catalog-scale (<10K courses); no additional infrastructure |
| Error handling | Centralized middleware | Per-route try/catch | Single error format; handles CastError, 11000, ValidationError consistently |
