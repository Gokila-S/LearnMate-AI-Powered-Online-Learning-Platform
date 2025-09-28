# LearnMate - Your Study Buddy Online

LearnMate is a comprehensive online learning platform built with the MERN stack (MongoDB, Express.js, React, Node.js). This MVP provides core e-learning functionality including course browsing, enrollment, progress tracking, and student dashboard features.

## 🚀 Features

### Core Functionality (MVP - 40% Implementation)

- **Course Management**
  - Browse courses with search and filtering
  - Course details with lesson previews
  - Course enrollment system
  - Multiple content types (video, text, quiz)

- **Learning Experience**
  - Student dashboard with enrolled courses
  - Course progress tracking
  - Lesson viewing interface
  - Bookmark functionality for lessons

- **User Experience**
  - Responsive design for all devices
  - Intuitive navigation and UI
  - Real-time progress updates
  - Course completion tracking

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

3. **Environment Configuration:**
   - Update the `.env` file with your MongoDB connection string
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/learnmate
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=30d
   CLIENT_URL=http://localhost:5173
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

6. **Start the server:**
   ```bash
   npm run dev
   ```

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

## 🎯 MVP Features Implemented

### ✅ Completed Features
- [x] Course browsing with search and filters
- [x] Course detail pages with lesson previews
- [x] Course enrollment system
- [x] Student dashboard with enrolled courses
- [x] Progress tracking and course completion
- [x] Lesson viewing interface
- [x] Bookmark functionality
- [x] Responsive design
- [x] Basic error handling
- [x] Loading states and user feedback

### 🚧 Authentication Note
Authentication and user registration/login functionality is intentionally excluded from this implementation as mentioned in the requirements. The app uses a mock authentication system for demonstration purposes.

---

**LearnMate** - Empowering learners worldwide with quality education! 🎓+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
