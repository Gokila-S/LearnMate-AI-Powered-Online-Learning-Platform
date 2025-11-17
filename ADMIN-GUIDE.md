# Admin Accounts & Role System

## Role Structure

### 1. User (Regular Students)
- **Role**: `user`
- **Permissions**: Enroll in courses, view lessons, track progress
- **Dashboard**: Student dashboard with enrolled courses and progress

### 2. Course Admin (Content Managers)
- **Role**: `course_admin`
- **Permissions**: 
  - Create, edit, and delete courses
  - Add lessons with video upload or YouTube links
  - Manage course content and pricing
  - View course analytics and enrollments
- **Dashboard**: Course management dashboard

### 3. Website Admin (Platform Owner)
- **Role**: `website_admin`
- **Permissions**: 
  - All course admin permissions
  - User management (view, edit roles, delete users)
  - Platform analytics and statistics
  - System administration
- **Dashboard**: Website administration dashboard with full analytics

## Pre-created Admin Accounts

### Course Administrator
- **Email**: `courseadmin@learnmate.com`
- **Password**: `CourseAdmin123!`
- **Role**: `course_admin`
- **Access**: Course management, lesson creation, YouTube integration

### Website Administrator  
- **Email**: `websiteadmin@learnmate.com`
- **Password**: `WebsiteAdmin123!`
- **Role**: `website_admin`
- **Access**: Full platform administration, user management, analytics

## Features by Role

### Course Admin Features:
- ✅ Create courses with detailed information (title, description, category, level, price, thumbnail)
- ✅ Add lessons with video file upload (MP4, WebM, MOV, OGG)
- ✅ Add lessons with YouTube URL integration
- ✅ Edit course details and pricing
- ✅ Publish/unpublish courses
- ✅ View enrollment statistics per course
- ✅ Manage lesson order and duration

### Website Admin Features:
- ✅ All Course Admin features
- ✅ User management (view all users, change roles, delete users)
- ✅ Platform analytics:
  - Total users, courses, enrollments, lessons
  - User distribution by role
  - Popular courses by enrollment count
  - Recent activity (new users, enrollments)
- ✅ System statistics and monitoring

## Video Integration

### Local Video Upload:
- Supported formats: MP4, WebM, OGG, MOV
- Max file size: 500MB
- Storage: Local filesystem (`uploads/lessons/`)
- Serving: Static file serving via Express

### YouTube Integration:
- Paste YouTube URL in lesson form
- Automatic video ID extraction
- Embedded YouTube player in lessons
- No storage space required

## Setup Instructions

1. **Seed Admin Accounts** (if not already done):
   ```bash
   cd server
   node scripts/seedAdmins.js
   ```

2. **Verify Admin Accounts**:
   ```bash
   cd server  
   node scripts/checkAdmins.js
   ```

3. **Access Admin Dashboards**:
   - Login with either admin account
   - Navigate to `/admin` or click "Admin" in header
   - Dashboard adapts based on user role

## API Endpoints

### Admin Routes (Protected):
- `GET /api/admin/analytics` - Website analytics (Website Admin only)
- `GET /api/admin/users` - User management (Website Admin only)
- `PUT /api/admin/users/:id/role` - Update user role (Website Admin only)
- `DELETE /api/admin/users/:id` - Delete user (Website Admin only)
- `GET /api/admin/courses-management` - Course management (Course Admin + Website Admin)

### Course Management:
- `POST /api/courses` - Create course (Course Admin + Website Admin)
- `PUT /api/courses/:id` - Update course (Course Admin + Website Admin)
- `DELETE /api/courses/:id` - Delete course (Course Admin + Website Admin)
- `POST /api/courses/:id/lessons` - Add lesson with video/YouTube (Course Admin + Website Admin)

## Security Features

- ✅ JWT-based authentication
- ✅ Role-based authorization middleware
- ✅ Protected admin routes
- ✅ File upload validation (size, type)
- ✅ Prevent deletion of last website admin
- ✅ Password hashing with bcrypt
