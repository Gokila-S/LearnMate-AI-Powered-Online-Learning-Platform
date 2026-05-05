# LearnMate — Technical Documentation Part 4

## Interview Questions, What-If Scenarios & Critical Insights

---

## 12. ❓ INTERVIEW QUESTIONS (WITH ANSWERS)

### Feature Implementation Questions

**Q: "How did you implement the video progress tracking system?"**
> We track video progress via two mechanisms depending on type. For local videos, we use the HTML5 `<video>` element's `timeUpdate` event which fires ~4 times/second. For YouTube, we use the IFrame Player API's `getCurrentTime()` via a 1-second polling interval. Both feed into the same anti-skip logic: we maintain a `watchedUntil` state representing the highest continuous second watched. If `currentTime > watchedUntil + 2` (2-second tolerance for buffering), we force-seek back to `watchedUntil`. Progress is persisted to MongoDB via throttled PUT requests every 4 seconds using a `Date.now() - lastSave >= 4000` check. The backend only allows monotonic increases to `watchedSeconds` to prevent manipulation. Drive videos are the exception — the cross-origin iframe sandbox prevents any JS interaction, so progress tracking is impossible. We documented this as a design limitation and recommend Drive only for free preview content.

**Q: "How did you implement AI quiz generation? What about duplicates?"**
> We call Google Gemini's `generateContent` API with a structured prompt that specifies the topic, difficulty level, and strict JSON output schema. The prompt includes difficulty descriptors — "Entry-level, recall-focused" for easy, "Advanced, multi-step reasoning" for hard. The response sometimes comes wrapped in markdown backticks, so we have a fallback regex parser: `raw.match(/\{[\s\S]*\}/)`. For deduplication, we use client-side Jaccard similarity — tokenizing questions into word sets and filtering pairs where `|intersection|/|union| >= 0.85`. This runs on the admin's browser before display, keeping the server stateless. Admins can also "regenerate" (same concept, improved wording, temperature=0.65) or "more like this" (same concept, different scenario, temperature=0.9).

**Q: "How does your authentication system handle Google OAuth users?"**
> We support dual auth: local email/password and Google OAuth. The `User` schema has a conditional `required` on the password field — it's only required when `authProvider !== 'google'`. On Google login, the server verifies the Google ID token using `google-auth-library`, extracts the payload (email, name, picture, googleId), and either creates a new user or links the Google ID to an existing email. For existing users who haven't linked Google before, we update their `googleId` and `profilePicture` without touching their password. Both flows produce the same JWT, so downstream auth is identical.

**Q: "How do you handle the ownership model for multi-tenant course management?"**
> We use an `owner` field on the Course schema that references the creating `course_admin`'s User ID. Every CRUD operation by a `course_admin` is scoped: queries add `query.owner = req.user._id`, updates verify `String(existing.owner) === String(req.user._id)`, and we explicitly `delete req.body.owner` to prevent ownership transfer attempts. `website_admin` bypasses all scoping and can manage any course. This is a simple but effective multi-tenant pattern without separate databases.

**Q: "How did you design the discussion forum? Why not use WebSockets?"**
> The forum uses a parent-child message model: top-level messages have `parentMessage: null`, replies reference their parent. We optimize queries by batch-loading: first fetch all parent messages, then a single query gets ALL replies with `parentMessage: { $in: parentIds }`, grouped in-memory by parent ID. This avoids N+1 queries. We use REST polling instead of WebSockets because: (1) the discussion context doesn't require sub-second updates, (2) WebSockets add infrastructure complexity (sticky sessions, connection management), and (3) REST is simpler to deploy on Vercel/Render. For real-time indicators like "online users," we use a `UserPresence` collection with a 5-minute TTL window.

---

### Challenge Questions

**Q: "What was the hardest technical challenge you faced?"**
> The Google Drive iframe progress tracking limitation. We built the entire video pipeline assuming we could track progress uniformly across all storage types. When we discovered that Drive's iframe is cross-origin sandboxed and doesn't expose `currentTime` or any playback events to the parent page, we had to redesign our content strategy. The solution was to document Drive as a "free preview only" option and keep local storage as the primary for tracked content. For production, a server-side proxy that streams Drive content through our API (serving it via `<video>` tag) would solve this, but it adds bandwidth costs and complexity.

**Q: "What would you improve if you had more time?"**
> Five things: (1) **Rate limiting** — we have none, which is dangerous for the AI endpoints and auth. I'd add `express-rate-limit` with Redis backing. (2) **Authenticated static serving** — currently `/uploads/lessons/*` is publicly accessible. I'd add a middleware that checks enrollment before serving lesson files. (3) **Automated tests** — zero test coverage is the biggest technical debt. (4) **WebSocket layer** for real-time discussion updates and typing indicators. (5) **Video transcoding pipeline** with FFmpeg for HLS/DASH adaptive streaming.

**Q: "How do you handle payment failures?"**
> Razorpay uses a two-phase flow that's inherently idempotent. Phase 1 creates an order and a Payment document with status `created`. Phase 2 verifies the payment signature via HMAC-SHA256. If verification fails, the Payment stays `created` and the student isn't enrolled. If the client crashes between payment and verification, the Payment record with `razorpayOrderId` persists — a retry with the same order ID won't create duplicates thanks to the `{user, course}` unique index. We also have a demo mode that bypasses Razorpay entirely for development, simulating instant success.

---

### Failure Handling Questions

**Q: "What happens if the database goes down mid-request?"**
> Mongoose throws a connection error, caught by our centralized error handler middleware. The error handler returns a 500 with a generic "Server Error" message (stack trace only in development). The `connectDB` function has `serverSelectionTimeoutMS: 15000` — if the DB is temporarily unreachable, Mongoose buffers operations for 15 seconds before failing. For the student experience: video playback continues uninterrupted (it's client-side), but progress saves fail silently (`.catch(()=>{})`) — the progress will be re-persisted on the next successful interval.

**Q: "What happens if the Gemini API is rate-limited during quiz generation?"**
> We check the response status and return specific error messages: 429 → "Rate limit exceeded. Please wait a moment." The error is surfaced to the admin UI, not swallowed. We don't have server-side retry or queuing — the admin simply waits and tries again. In production, I'd add an in-memory cache for recently generated questions (keyed by topic+difficulty) and a request queue with exponential backoff.

**Q: "What if a lesson is deleted while a student is watching it?"**
> The lesson document is removed from MongoDB, but the student's `LessonPlayer` component still has the lesson data in React state. The video will continue playing. On the next progress save attempt, the PUT to `/progress` won't fail catastrophically — it just updates the enrollment's `lessonWatch` array with a now-orphaned lesson ID. The enrollment's `completedLessons` isn't affected. The student would see a 404 only if they navigate away and try to return to that lesson.

---

## 13. 🔥 "WHAT IF" SCENARIOS

### Scenario 1: Traffic Spike (10x Normal)

**Impact Assessment:**
- Progress API: 10x write load → MongoDB connection pool exhaustion
- Video serving: bandwidth saturation on Express static middleware
- AI endpoints: Gemini rate limits hit

**Mitigation Plan:**
```
1. Scale backend horizontally (multiple Render instances behind load balancer)
2. Move videos to CDN (CloudFront/Cloudflare) — offload Express static serving
3. Add Redis cache for course listings (most-read, least-written data)
4. Increase MongoDB pool: maxPoolSize: 50
5. Batch progress writes: collect 4-5 updates client-side → single bulk PUT
6. Add rate limiting: 10 req/min for AI, 60 req/min for progress
```

### Scenario 2: Database Crash

**Impact:**
- All CRUD operations fail
- Auth verification fails (user lookup)
- Enrollment/progress lost

**Recovery:**
```
1. MongoDB Atlas auto-failover (if using replica set) → 10-30s downtime
2. Express keeps running — health endpoint still responds
3. Client-side cached auth (localStorage) allows continued browsing
4. Video playback continues (stateless)
5. Progress saves fail silently — client retries on next interval
6. After recovery: no data loss if using Atlas auto-backup (daily snapshots)
```

### Scenario 3: Gemini API Down

**Impact:** AI chat and quiz generation unavailable
**Mitigation:**
```
1. chatWithAI returns clear error: "AI service temporarily unavailable"
2. Quiz generation panel shows error state
3. Core learning functionality (video, enrollment, progress) unaffected
4. Fallback: admin can create quizzes manually
5. Long-term: cache last N generated quiz sets per topic
```

### Scenario 4: Drive API Credential Expiry

**Impact:** New uploads fail to reach Drive; existing Drive embeds still work (public links)
**Mitigation:**
```
1. uploadVideoToDrive returns null → controller keeps storage='local'
2. Logged as [DriveUpload] warning
3. deleteDriveFile has retry with forced client refresh
4. OAuth flow: re-run `node scripts/oauthInit.js` to refresh tokens
5. Service account keys: rotate in Google Cloud Console
```

### Scenario 5: Payment Gateway Outage

**Impact:** Paid course enrollments blocked
**Mitigation:**
```
1. Razorpay order creation fails → 502 with clear message
2. Free courses and existing enrollments unaffected
3. Demo mode auto-activates if RAZORPAY_KEY_ID missing
4. Payment records preserve order state for retry
5. Student can retry when gateway recovers — unique index prevents duplicates
```

---

## 14. 🧠 AI-DRIVEN CRITICAL INSIGHTS

### Weaknesses in Current System

1. **No Rate Limiting** — The AI chat endpoint could be abused to exhaust Gemini API quota. Auth endpoints are vulnerable to brute force. Progress endpoint could be spammed.

2. **Unauthenticated Static Files** — Any URL to `/uploads/lessons/*` serves the video without checking enrollment. A paid course's video can be shared via direct link.

3. **No Input Sanitization for Markdown** — `react-markdown` renders user-submitted content. While React escapes HTML by default, markdown can still contain malicious links or social engineering content.

4. **Single-Point Failure on MongoDB** — No read replicas, no caching layer. Every request hits the database directly.

5. **No Audit Trail** — Admin actions (role changes, course deletions, moderation) aren't logged to an audit collection. Impossible to trace "who deleted what."

6. **Certificate Forgery** — Certificate ID is derived from enrollment ObjectId. Anyone who knows the pattern could guess valid IDs. No cryptographic signing.

### Missing Best Practices

| Practice | Current State | Recommendation |
|---|---|---|
| Rate limiting | None | `express-rate-limit` + Redis store |
| Request logging | Console.log only | Winston/Pino with structured JSON → cloud logging |
| Health checks | Basic `/api/health` | Add DB connectivity check, external API pings |
| Graceful shutdown | None | Handle SIGTERM: stop accepting requests, drain connections |
| Input validation | Partial | Add `helmet` for HTTP headers, `hpp` for parameter pollution |
| Monitoring | None | APM tool (Datadog/New Relic) for request latency, error rates |
| Backup strategy | Atlas default | Automated daily snapshots + point-in-time recovery |
| Secret management | `.env` files | Vault or cloud-native secrets manager |
| API versioning | None | Prefix routes with `/api/v1/` for backward compatibility |

### Advanced Improvements

1. **Video Transcoding Pipeline**: FFmpeg worker → generates HLS manifest + multiple bitrate segments → adaptive streaming
2. **Real-Time Layer**: Socket.io for discussion typing indicators, live "users watching" count, instant message delivery
3. **Search Engine**: Elasticsearch for full-text course search with fuzzy matching, filters, and relevance scoring
4. **Analytics Dashboard**: Per-lesson retention curves (where students drop off), quiz performance heatmaps, completion funnels
5. **Content Versioning**: Track lesson edit history, allow rollback, diff view for admin
6. **i18n/l10n**: Multi-language support with `react-intl` or `i18next`
7. **Accessibility**: WCAG 2.1 compliance — keyboard navigation, screen reader support, caption tracks for videos
8. **Microservice Extraction**: Split AI service into standalone deployment with its own rate limiter and queue

---

## Summary: Key Talking Points for Interview

1. **Architecture**: MERN stack with split deployment (Vercel + Render), JWT stateless auth, MongoDB for flexible schema
2. **Unique Feature**: AI-powered quiz generation with difficulty control, regeneration, and Jaccard dedup
3. **Technical Depth**: Anti-skip video tracking across Local/YouTube with cross-origin Drive limitation documented
4. **Production Awareness**: Graceful fallbacks (Drive→Local), retry logic (lesson ordering), demo mode (payments)
5. **Honest About Gaps**: No tests, no rate limiting, no authenticated static serving — with clear remediation plans
6. **Scaling Path**: CDN for video, Redis for caching, horizontal scaling for API, WebSocket for real-time

> **Final Tip**: When asked "Why this approach?", always mention the **trade-off** you considered. Interviewers value candidates who can articulate *why not* the alternative, not just *why* the chosen approach.
