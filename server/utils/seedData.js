import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';

dotenv.config();

const sampleCourses = [
  {
    title: "Complete React Development Course",
    description: "Master React from basics to advanced concepts. Learn hooks, context, state management, and build real-world applications. This comprehensive course covers everything you need to become a React developer.",
    shortDescription: "Master React from basics to advanced concepts with hands-on projects",
    category: "Web Development",
    level: "Intermediate",
    instructor: {
      name: "John Smith",
      bio: "Senior React Developer with 5+ years experience",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"
    },
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500",
    price: 99,
    duration: 1200, // 20 hours
    tags: ["React", "JavaScript", "Frontend", "Web Development"],
    rating: 4.8,
    totalRatings: 1250
  },
  {
    title: "Python for Data Science",
    description: "Learn Python programming specifically for data science applications. Cover pandas, numpy, matplotlib, and machine learning basics with practical examples and projects.",
    shortDescription: "Learn Python for data analysis and machine learning",
    category: "Data Science",
    level: "Beginner",
    instructor: {
      name: "Sarah Johnson",
      bio: "Data Scientist at Tech Corp",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b2e0aa0f?w=150"
    },
    thumbnail: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=500",
    price: 79,
    duration: 900, // 15 hours
    tags: ["Python", "Data Science", "Machine Learning", "Analytics"],
    rating: 4.6,
    totalRatings: 890
  },
  {
    title: "UI/UX Design Fundamentals",
    description: "Master the principles of user interface and user experience design. Learn design thinking, prototyping, user research, and create stunning designs using industry-standard tools.",
    shortDescription: "Master UI/UX design principles and create amazing user experiences",
    category: "Design",
    level: "Beginner",
    instructor: {
      name: "Mike Chen",
      bio: "Senior UX Designer at Design Studio",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
    },
    thumbnail: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=500",
    price: 69,
    duration: 720, // 12 hours
    tags: ["UI Design", "UX Design", "Figma", "Prototyping"],
    rating: 4.9,
    totalRatings: 2100
  },
  {
    title: "Node.js Backend Development",
    description: "Build scalable backend applications with Node.js and Express. Learn about APIs, databases, authentication, deployment, and best practices for server-side development.",
    shortDescription: "Build powerful backend applications with Node.js and Express",
    category: "Web Development",
    level: "Intermediate",
    instructor: {
      name: "Alex Rodriguez",
      bio: "Full Stack Developer with 7+ years experience",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150"
    },
    thumbnail: "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=500",
    price: 89,
    duration: 1000, // 16.7 hours
    tags: ["Node.js", "Express", "Backend", "API"],
    rating: 4.7,
    totalRatings: 750
  },
  {
    title: "Digital Marketing Mastery",
    description: "Learn comprehensive digital marketing strategies including SEO, social media marketing, content marketing, email marketing, and analytics to grow your business online.",
    shortDescription: "Master digital marketing strategies and grow your online presence",
    category: "Marketing",
    level: "Beginner",
    instructor: {
      name: "Lisa Wang",
      bio: "Digital Marketing Expert with 6+ years experience",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150"
    },
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500",
    price: 59,
    duration: 800, // 13.3 hours
    tags: ["Digital Marketing", "SEO", "Social Media", "Analytics"],
    rating: 4.5,
    totalRatings: 1500
  },
  {
    title: "Machine Learning with Python",
    description: "Dive deep into machine learning algorithms and implementations using Python. Cover supervised and unsupervised learning, neural networks, and real-world ML projects.",
    shortDescription: "Master machine learning algorithms and build AI applications",
    category: "AI/ML",
    level: "Advanced",
    instructor: {
      name: "Dr. Robert Kim",
      bio: "AI Research Scientist with PhD in Computer Science",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150"
    },
    thumbnail: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=500",
    price: 129,
    duration: 1500, // 25 hours
    tags: ["Machine Learning", "Python", "AI", "Neural Networks"],
    rating: 4.9,
    totalRatings: 680
  }
];

const sampleLessons = {
  "Complete React Development Course": [
    {
      title: "Introduction to React",
      description: "Learn what React is and why it's popular for building user interfaces",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/react-intro.mp4",
          duration: 15
        }
      },
      order: 1,
      duration: 15,
      isPreview: true
    },
    {
      title: "Setting Up Development Environment",
      description: "Install Node.js, npm, and create your first React application",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/react-setup.mp4",
          duration: 20
        }
      },
      order: 2,
      duration: 20,
      isPreview: true
    },
    {
      title: "JSX and Components",
      description: "Understanding JSX syntax and creating your first React components",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/react-jsx.mp4",
          duration: 25
        }
      },
      order: 3,
      duration: 25,
      isPreview: false
    },
    {
      title: "Props and State",
      description: "Learn how to pass data between components and manage component state",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/react-props-state.mp4",
          duration: 30
        }
      },
      order: 4,
      duration: 30,
      isPreview: false
    },
    {
      title: "Event Handling",
      description: "Handle user interactions and events in React applications",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/react-events.mp4",
          duration: 20
        }
      },
      order: 5,
      duration: 20,
      isPreview: false
    }
  ],
  "Python for Data Science": [
    {
      title: "Python Basics for Data Science",
      description: "Essential Python concepts needed for data science",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/python-basics.mp4",
          duration: 25
        }
      },
      order: 1,
      duration: 25,
      isPreview: true
    },
    {
      title: "Introduction to NumPy",
      description: "Learn NumPy for numerical computing and array operations",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/numpy-intro.mp4",
          duration: 30
        }
      },
      order: 2,
      duration: 30,
      isPreview: false
    },
    {
      title: "Data Manipulation with Pandas",
      description: "Master pandas for data cleaning and manipulation",
      content: {
        type: "video",
        data: {
          videoUrl: "https://sample-videos.com/pandas-intro.mp4",
          duration: 35
        }
      },
      order: 3,
      duration: 35,
      isPreview: false
    }
  ]
  ,
  "Digital Marketing Mastery": [
    {
      title: "Digital Marketing Mastery Assessment",
      description: "Assessment covering SEO fundamentals, channels, tools, and strategy concepts",
      content: {
        type: "assessment",
        data: {
          duration: 20,
          questions: [
            {
              question: "What does SEO stand for?",
              options: ["Social Engagement Optimization", "Search Engine Optimization", "Systematic Email Operation", "Search Engine Operation"],
              correctAnswer: 1,
              marks: 1
            },
            {
              question: "Which of the following is NOT a type of digital marketing?",
              options: ["Social Media Marketing", "Email Marketing", "Billboard Advertising", "Content Marketing"],
              correctAnswer: 2,
              marks: 1
            },
            {
              question: "Which of these is an example of On-Page SEO?",
              options: ["Backlinks", "Keyword optimization", "Guest blogging", "Social sharing"],
              correctAnswer: 1,
              marks: 1
            },
            {
              question: "Which of these is an Off-Page SEO factor?",
              options: ["Meta description", "Internal links", "Backlinks", "Title tags"],
              correctAnswer: 2,
              marks: 1
            },
            {
              question: "Which type of SEO focuses on website speed and mobile-friendliness?",
              options: ["On-Page SEO", "Off-Page SEO", "Technical SEO", "Content SEO"],
              correctAnswer: 2,
              marks: 1
            },
            {
              question: "Which tool is used to analyze website traffic?",
              options: ["Canva", "Google Analytics", "SEMrush", "Mailchimp"],
              correctAnswer: 1,
              marks: 1
            },
            {
              question: "Which of the following is a current trend in digital marketing?",
              options: ["Cold calling", "Voice search optimization", "Banner ads", "Yellow pages"],
              correctAnswer: 1,
              marks: 1
            },
            {
              question: "What is the first step in keyword research?",
              options: ["Optimizing meta tags", "Brainstorming seed keywords", "Building backlinks", "Publishing content"],
              correctAnswer: 1,
              marks: 1
            },
            {
              question: "Which tool is best for creating social media designs?",
              options: ["Mailchimp", "Canva", "SEMrush", "Google Analytics"],
              correctAnswer: 1,
              marks: 1
            },
            {
              question: "Why should dashboards be used in digital marketing?",
              options: ["To improve page design", "To monitor traffic and campaigns", "To increase email size", "To block competitors"],
              correctAnswer: 1,
              marks: 1
            }
          ]
        }
      },
      order: 1,
      duration: 20,
      isPreview: false
    }
  ]
};

const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Clear existing data
    console.log('Clearing existing courses and lessons...');
    await Course.deleteMany({});
    await Lesson.deleteMany({});
    
    console.log('Creating sample courses...');
    
    for (const courseData of sampleCourses) {
      // Create course
      const course = await Course.create(courseData);
      console.log(`Created course: ${course.title}`);
      
      // Create lessons for this course if they exist
      if (sampleLessons[courseData.title]) {
        const lessons = [];
        for (const lessonData of sampleLessons[courseData.title]) {
          const lesson = await Lesson.create({
            ...lessonData,
            course: course._id
          });
          lessons.push(lesson._id);
        }
        
        // Update course with lesson references
        course.lessons = lessons;
        course.totalLessons = lessons.length;
        await course.save();
        
        console.log(`Created ${lessons.length} lessons for ${course.title}`);
      }
    }
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run seeder
seedDatabase();
