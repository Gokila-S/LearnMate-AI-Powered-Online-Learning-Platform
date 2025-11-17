import React, { useEffect, useState, useRef } from 'react';
import enrollmentService from '../../services/enrollmentService';
import remarkGfm from 'remark-gfm';
import MarkdownRenderer from '../common/MarkdownRenderer';
import { useCourse } from '../../context/CourseContext';
import { useAuth } from '../../context/AuthContext';
import AssessmentPlayer from './AssessmentPlayer';

// Modern Enterprise Quiz Player Component
// Added prop drilling for bookmark and completion handlers so QuizPlayer no longer
// references undefined identifiers from parent scope.
const QuizPlayer = ({ 
  lesson, 
  enrollment, 
  onLessonComplete,
  onBookmark, 
  onMarkComplete, 
  isBookmarked, 
  isCompleted 
}) => {
  const { markLessonComplete } = useCourse();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime] = useState(Date.now());
  const [quizStarted, setQuizStarted] = useState(false);

  const questions = lesson.content.data?.questions || [];
  const totalQuestions = questions.length;

  useEffect(() => {
    if (quizStarted && !showResults) {
      const timer = setInterval(() => {
        setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [quizStarted, showResults, startTime]);

  const handleAnswerSelect = (questionIndex, answerIndex) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        correct++;
      }
    });
    return Math.round((correct / totalQuestions) * 100);
  };

  const handleSubmitQuiz = async () => {
    const finalScore = calculateScore();
    setScore(finalScore);
    setShowResults(true);

    // Mark lesson as complete if score >= 70%
    if (enrollment && finalScore >= 70) {
      await markLessonComplete(enrollment.course._id, lesson._id);
      onLessonComplete && onLessonComplete(lesson._id);
    }
  };

  const handleStartQuiz = () => {
    setQuizStarted(true);
  };

  const handleRestartQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setShowResults(false);
    setScore(0);
    setTimeSpent(0);
    setQuizStarted(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreIcon = (score) => {
    if (score >= 90) return (
      <svg className="w-8 h-8 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
    if (score >= 70) return (
      <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
    if (score >= 60) return (
      <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  };

  if (!questions.length) {
    return (
      <div className="min-h-[600px] bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-200 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-3">Quiz Under Development</h3>
          <p className="text-slate-600 leading-relaxed">This quiz is currently being prepared. Check back soon for interactive questions and assessments.</p>
        </div>
      </div>
    );
  }

  // Quiz Introduction Screen
  if (!quizStarted) {
    return (
      <div className="min-h-[500px] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-slate-200 overflow-hidden">
        <div className="relative h-full">
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4">
            <div className="max-w-3xl mx-auto flex items-start justify-between">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Knowledge Assessment</h1>
                  <p className="text-slate-600 text-sm">Test your understanding of the concepts</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={onBookmark}
                  className={`p-2 rounded-lg border ${
                    isBookmarked
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-600'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                  title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                >
                  <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                {enrollment && !isCompleted && (
                  <button
                    onClick={onMarkComplete}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
                  >
                    Mark Complete
                  </button>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Completed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Quiz Details */}
                <div className="space-y-3">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-3">Quiz Overview</h2>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 text-sm">Total Questions</span>
                        <span className="text-slate-800 font-semibold">{totalQuestions}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 text-sm">Estimated Time</span>
                        <span className="text-slate-800 font-semibold">{Math.ceil(totalQuestions * 1.5)} minutes</span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600 text-sm">Passing Score</span>
                        <span className="text-slate-800 font-semibold">70%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <span className="text-emerald-700 text-sm">Question Type</span>
                        <span className="text-emerald-800 font-semibold">Multiple Choice</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 p-4">
                    <h3 className="text-base font-semibold text-slate-800 mb-3">Instructions</h3>
                    <ul className="space-y-2 text-slate-600 text-sm">
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                        <span>Read each question carefully before selecting your answer</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                        <span>You can navigate between questions using the navigation controls</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                        <span>Make sure to answer all questions before submitting</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                        <span>You need at least 70% to pass this assessment</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Start Quiz Action */}
                <div className="flex flex-col justify-center">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Ready to Begin?</h3>
                    <p className="text-slate-600 text-sm mb-6">
                      Once you start, the timer will begin. Make sure you're in a quiet environment and ready to focus.
                    </p>
                    <button
                      onClick={handleStartQuiz}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Start Quiz</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Results Screen
  if (showResults) {
    const correctAnswers = questions.reduce((count, question, index) => {
      return selectedAnswers[index] === question.correctAnswer ? count + 1 : count;
    }, 0);
    
    return (
      <div className="min-h-[500px] bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4">
          <div className="max-w-3xl mx-auto">
            {/* Results Header */}
            <div className="mb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 text-center">
                  <div className="flex justify-center mb-3">
                    {getScoreIcon(score)}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 mb-1">Quiz Completed!</h1>
                  <p className="text-slate-600 text-sm">Here are your results</p>
                </div>
                <div className="flex items-center space-x-2 ml-4 self-start">
                  <button
                    onClick={onBookmark}
                    className={`p-2 rounded-lg border ${
                      isBookmarked
                        ? 'bg-yellow-50 border-yellow-200 text-yellow-600'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                    title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                  >
                    <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  {enrollment && !isCompleted && (
                    <button
                      onClick={onMarkComplete}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
                    >
                      Mark Complete
                    </button>
                  )}
                  {isCompleted && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Completed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Score Card */}
            <div className={`rounded-xl border-2 p-5 mb-4 ${getScoreColor(score)}`}>
              <div className="text-center">
                <div className="text-4xl font-bold mb-1">{score}%</div>
                <div className="text-base font-semibold mb-3">
                  {score >= 90 ? 'Excellent!' : score >= 70 ? 'Well Done!' : score >= 60 ? 'Good Effort!' : 'Needs Improvement'}
                </div>
                <div className="flex justify-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-base">{correctAnswers}/{totalQuestions}</div>
                    <div className="text-opacity-80 text-xs">Correct Answers</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-base">{formatTime(timeSpent)}</div>
                    <div className="text-opacity-80 text-xs">Time Taken</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-800">Question Review</h3>
              </div>
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                {questions.map((question, index) => {
                  const userAnswer = selectedAnswers[index];
                  const isCorrect = userAnswer === question.correctAnswer;
                  return (
                    <div key={index} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-slate-800 flex-1 text-sm">
                          {index + 1}. {question.question}
                        </h4>
                        <div className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${
                          isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </div>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-500">Your answer:</span>
                          <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                            {userAnswer !== undefined ? question.options[userAnswer] : 'Not answered'}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">Correct answer:</span>
                            <span className="font-medium text-green-700">
                              {question.options[question.correctAnswer]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-3">
              <button
                onClick={handleRestartQuiz}
                className="px-6 py-2 bg-slate-600 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors text-sm"
              >
                Retake Quiz
              </button>
              {score >= 70 && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium text-sm">Lesson Completed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Questions Interface
  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;
  const answeredQuestions = Object.keys(selectedAnswers).length;

  return (
    <div className="min-h-[500px] bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Question {currentQuestion + 1} of {totalQuestions}</h1>
              <p className="text-slate-500 text-sm">Answer all questions to complete the quiz</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right mr-2">
              <div className="text-lg font-bold text-slate-800">{formatTime(timeSpent)}</div>
              <div className="text-xs text-slate-500">Time elapsed</div>
            </div>
            <button
              onClick={onBookmark}
              className={`p-2 rounded-lg border ${
                isBookmarked
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-600'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            {enrollment && !isCompleted && (
              <button
                onClick={onMarkComplete}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
              >
                Mark Complete
              </button>
            )}
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Completed
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-slate-600">
          <div>Progress: {currentQuestion + 1}/{totalQuestions} questions</div>
          <div>Answered: {answeredQuestions}/{totalQuestions}</div>
        </div>
      </div>

      {/* Question Content */}
      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-5">
              {currentQ.question}
            </h2>

            <div className="space-y-3">
              {currentQ.options.map((option, index) => {
                const isSelected = selectedAnswers[currentQuestion] === index;
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(currentQuestion, index)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-slate-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <span className={`text-base font-medium ${
                          isSelected ? 'text-blue-700' : 'text-slate-700'
                        }`}>
                          {String.fromCharCode(65 + index)}. {option}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm">Previous</span>
            </button>

            <div className="flex items-center space-x-1">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    index === currentQuestion
                      ? 'bg-blue-500 text-white'
                      : selectedAnswers[index] !== undefined
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {currentQuestion === totalQuestions - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={answeredQuestions < totalQuestions}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">Submit Quiz</span>
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestion(Math.min(totalQuestions - 1, currentQuestion + 1))}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <span className="text-sm">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* Submit Warning */}
          {answeredQuestions < totalQuestions && currentQuestion === totalQuestions - 1 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-amber-700 font-medium text-sm">
                  Please answer all questions before submitting the quiz. You have {totalQuestions - answeredQuestions} unanswered questions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LessonPlayer = ({ lesson, enrollment, onLessonComplete, onBookmark }) => {
  const { markLessonComplete } = useCourse();
  const { user } = useAuth();
  const [isCompleted, setIsCompleted] = useState(
    enrollment?.progress?.completedLessons?.some(cl => cl.lesson === lesson._id) || false
  );
  const [isBookmarked, setIsBookmarked] = useState(
    user?.bookmarkedLessons?.includes(lesson._id) || false
  );
  // --- Video progress tracking (prevent skip & auto-complete) ---
  const videoRef = useRef(null);
  const [watchedUntil, setWatchedUntil] = useState(0); // highest continuous second watched (resume safe)
  const [videoDuration, setVideoDuration] = useState(0);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const progressSaveThrottle = useRef(0);
  const ytPlayerRef = useRef(null); // YouTube IFrame API player instance
  const lastReportedSecond = useRef(0);
  const ytProgressIntervalRef = useRef(null); // interval for polling YT Player
  // YouTube state (must come before any effects referencing ytId)
  const [ytId, setYtId] = useState(lesson?.content?.data?.videoId || null);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytThumb, setYtThumb] = useState(lesson?.content?.data?.thumbnailUrl || null);

  // Reset tracking when lesson changes (and destroy any existing YT player)
  useEffect(() => {
    if (ytProgressIntervalRef.current) {
      clearInterval(ytProgressIntervalRef.current);
      ytProgressIntervalRef.current = null;
    }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch (_) {}
      ytPlayerRef.current = null;
    }
    setWatchedUntil(0);
    setVideoDuration(0);
    setAutoCompleting(false);
    setProgressPct(0);
    lastReportedSecond.current = 0;
    // Attempt resume from enrollment.progress.lessonWatch if present
    const watchEntry = enrollment?.progress?.lessonWatch?.find(lw => lw.lesson === lesson._id);
    if (watchEntry) {
      setWatchedUntil(watchEntry.watchedSeconds || 0);
      if (watchEntry.durationSeconds) setVideoDuration(watchEntry.durationSeconds);
    }
  }, [lesson?._id]);

  // YouTube Player integration: instantiate only after user clicks play (ytPlaying true)
  useEffect(() => {
    if (lesson?.content?.type !== 'youtube' || !ytId || !ytPlaying) return;

    const createPlayer = () => {
      if (ytPlayerRef.current) return; // already created
      if (!window.YT || !window.YT.Player) return; // API not ready yet
      ytPlayerRef.current = new window.YT.Player(`yt-player-${ytId}`, {
        videoId: ytId,
        playerVars: { controls: 1, disablekb: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e) => {
            const target = e.target;
            try {
              const dur = Math.floor(target.getDuration() || 0);
              if (dur) setVideoDuration(prev => prev || dur);
              if (watchedUntil > 5 && watchedUntil < dur) {
                target.seekTo(watchedUntil, true);
              }
            } catch (_) {}
          },
          onStateChange: (evt) => {
            if (!window.YT) return;
            const PS = window.YT.PlayerState;
            if (evt.data === PS.PLAYING) {
              if (ytProgressIntervalRef.current) {
                clearInterval(ytProgressIntervalRef.current);
              }
              ytProgressIntervalRef.current = setInterval(() => {
                if (!ytPlayerRef.current) { clearInterval(ytProgressIntervalRef.current); return; }
                let cur = 0, dur = 0;
                try {
                  cur = Math.floor(ytPlayerRef.current.getCurrentTime());
                  dur = Math.floor(ytPlayerRef.current.getDuration());
                } catch (_) { /* ignore */ }
                if (dur && !videoDuration) setVideoDuration(dur);
                if (cur <= watchedUntil + 2) {
                  if (cur > watchedUntil) setWatchedUntil(cur);
                } else {
                  try { ytPlayerRef.current.seekTo(watchedUntil, true); } catch (_) {}
                }
                updateDerivedProgress(cur, dur);
                maybePersistProgress(cur, dur);
                if (dur && cur >= dur - 1) {
                  handleVideoThresholdCompletion(dur);
                }
              }, 1000);
            } else if ([PS.PAUSED, PS.ENDED, PS.BUFFERING, PS.CUED].includes(evt.data)) {
              if (ytProgressIntervalRef.current) {
                clearInterval(ytProgressIntervalRef.current);
                ytProgressIntervalRef.current = null;
              }
              if (evt.data === PS.ENDED) {
                // On ended ensure completion check
                handleVideoThresholdCompletion(videoDuration);
              }
            }
          }
        }
      });
    };

    // Load API if not present
    if (!window.YT || !window.YT.Player) {
      if (!window._ytApiLoading) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
        window._ytApiLoading = true;
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        createPlayer();
      };
    } else {
      // API already available
      createPlayer();
    }

    return () => {
      if (ytProgressIntervalRef.current) {
        clearInterval(ytProgressIntervalRef.current);
        ytProgressIntervalRef.current = null;
      }
    };
  }, [lesson?.content?.type, ytId, ytPlaying, watchedUntil, videoDuration]);

  // (YouTube state declared earlier – duplicate removed)

  const extractYouTubeVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  useEffect(() => {
    // Reset playback state on lesson change and derive videoId if missing
    setYtPlaying(false);
    const content = lesson?.content?.data || {};
    if (content.videoId) {
      setYtId(content.videoId);
      // Prefer server-provided thumbnail if present; else build from ID
      setYtThumb(content.thumbnailUrl || `https://img.youtube.com/vi/${content.videoId}/maxresdefault.jpg`);
    } else if (content.youtubeUrl) {
      const id = extractYouTubeVideoId(content.youtubeUrl);
      if (id) setYtId(id);
      else setYtId(null);
      // Build thumbnail from parsed id (if available)
      if (id) setYtThumb(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`);
      else setYtThumb(null);
    } else {
      setYtId(null);
      setYtThumb(null);
    }
  }, [lesson?._id]);

  const handleThumbError = (e) => {
    // Fallback chain: maxresdefault -> hqdefault -> mqdefault
    if (!ytId) return;
    const current = e?.target?.src || '';
    if (current.includes('maxresdefault')) {
      setYtThumb(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
    } else if (current.includes('hqdefault')) {
      setYtThumb(`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`);
    }
  };

  const handleYouTubePlay = () => {
    const content = lesson?.content?.data || {};
    if (ytId) {
      setYtPlaying(true);
      return;
    }
    if (content.youtubeUrl) {
      const id = extractYouTubeVideoId(content.youtubeUrl);
      if (id) {
        setYtId(id);
        setYtPlaying(true);
        return;
      }
      // Fallback: open original URL if we cannot parse the ID
      try {
        window.open(content.youtubeUrl, '_blank', 'noopener,noreferrer');
      } catch (_) { /* noop */ }
    }
  };

  const handleMarkComplete = async () => {
    if (enrollment && !isCompleted) {
      const result = await markLessonComplete(enrollment.course._id, lesson._id);
      if (result.success) {
        setIsCompleted(true);
        onLessonComplete && onLessonComplete(lesson._id);
      }
    }
  };

  // Auto mark complete when full video watched (for internal hosted video only)
  const handleVideoThresholdCompletion = async (durOverride) => {
    const dur = durOverride || videoDuration || 0;
    if (!dur) return;
    const ratio = watchedUntil / dur;
    if (ratio >= 0.9 && enrollment && !isCompleted && !autoCompleting) {
      setAutoCompleting(true);
      await handleMarkComplete();
      setAutoCompleting(false);
    }
  };
  const handleVideoEnded = async () => { await handleVideoThresholdCompletion(); };

  const updateDerivedProgress = (current, duration) => {
    if (duration > 0) setProgressPct(Math.min(100, Math.round((Math.max(current, watchedUntil) / duration) * 100)));
  };

  const maybePersistProgress = (current, duration) => {
    if (!enrollment || !lesson || !duration) return;
    const now = Date.now();
    if (current <= lastReportedSecond.current) return; // only forward
    if (now - progressSaveThrottle.current < 4000 && current !== duration) return; // throttle every 4s unless finished
    lastReportedSecond.current = current;
    progressSaveThrottle.current = now;
    enrollmentService.updateLessonProgress?.(enrollment.course._id, lesson._id, {
      watchedSeconds: Math.max(current, watchedUntil),
      durationSeconds: duration,
      markIfThreshold: false
    }).catch(()=>{});
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = Math.floor(videoRef.current.currentTime);
    const duration = Math.floor(videoRef.current.duration || videoDuration || 0);
    if (current <= watchedUntil + 2) {
      if (current > watchedUntil) setWatchedUntil(current);
    } else {
      videoRef.current.currentTime = watchedUntil;
    }
    updateDerivedProgress(current, duration);
    maybePersistProgress(current, duration);
    if (duration && current >= duration - 1) handleVideoThresholdCompletion(duration);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = Math.floor(videoRef.current.duration || 0);
      setVideoDuration(dur);
      // Resume seek
      if (watchedUntil > 5 && watchedUntil < dur) {
        try { videoRef.current.currentTime = watchedUntil; } catch (_) {}
      }
      updateDerivedProgress(watchedUntil, dur);
    }
  };

  const remainingLock = () => {
    if (!videoDuration) return 0;
    return Math.max(0, videoDuration - watchedUntil);
  };

  const manualThresholdEligible = () => {
    if (!videoDuration) return false;
    return (watchedUntil / videoDuration) >= 0.6 && (watchedUntil / videoDuration) < 0.9;
  };

  const handleManualCompletion = async () => {
    if (!manualThresholdEligible() || isCompleted) return;
    await enrollmentService.updateLessonProgress?.(enrollment.course._id, lesson._id, {
      watchedSeconds: watchedUntil,
      durationSeconds: videoDuration,
      markIfThreshold: true
    });
    await handleMarkComplete();
  };

  const handleBookmark = async () => {
    if (onBookmark) {
      const success = await onBookmark(lesson._id, !isBookmarked);
      if (success) {
        setIsBookmarked(!isBookmarked);
      }
    }
  };

  const renderContent = () => {
    if (!lesson.content) {
      return (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <p className="text-gray-500">Content not available</p>
        </div>
      );
    }

    switch (lesson.content.type) {
      case 'video':
        {
          // Decide playback source: Drive embed/stream vs local file
          const data = lesson.content.data || {};
          const isDrive = data.storage === 'drive' && (data.embedLink || data.streamUrl || data.driveFileId);
          // Normalize potential forms into the standard /file/d/<id>/preview form
          let driveSrc = null;
          if (data.embedLink) driveSrc = data.embedLink;
          else if (data.streamUrl && /file\/d\//.test(data.streamUrl)) driveSrc = data.streamUrl;
          else if (data.streamUrl && data.streamUrl.includes('uc?export=preview&id=')) {
            const id = (data.streamUrl.split('id=')[1] || '').split('&')[0];
            if (id) driveSrc = `https://drive.google.com/file/d/${id}/preview`;
          } else if (data.driveFileId) {
            driveSrc = `https://drive.google.com/file/d/${data.driveFileId}/preview`;
          }
          // Some browsers block inline preview of Drive if not embedded in iframe for certain formats; use iframe for Drive
          if (isDrive && driveSrc) {
            return (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <div className="aspect-video flex items-center justify-center bg-gray-900">
                  <iframe
                    title={lesson.title || 'Drive Video'}
                    src={driveSrc}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    onError={(e) => { /* silently ignore; UI fallback below */ }}
                  />
                </div>
                <div className="absolute inset-0 pointer-events-none" />
                <div className="absolute bottom-2 right-2 flex space-x-2 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => { if (driveSrc) window.open(driveSrc, '_blank', 'noopener,noreferrer'); }}
                    className="px-3 py-1.5 text-xs bg-white/80 hover:bg-white rounded shadow border border-gray-300 text-gray-700"
                  >Open in New Tab</button>
                </div>
              </div>
            );
          }
          // Fallback: local video tag
          return (
            <div className="relative bg-black rounded-lg overflow-hidden">
              <div className="aspect-video">
                {data.videoUrl ? (
                  <video
                    ref={videoRef}
                    controls
                    className="w-full h-full"
                    poster="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleVideoEnded}
                    onSeeking={() => {
                      if (videoRef.current && videoRef.current.currentTime > watchedUntil + 2) {
                        videoRef.current.currentTime = watchedUntil;
                      }
                    }}
                  >
                    <source src={data.videoUrl} type={data.mimetype || 'video/mp4'} />
                    <p className="text-white p-4">Your browser does not support the video tag.</p>
                  </video>
                ) : (
                  <div className="flex items-center justify-center h-96 bg-gray-900 text-white">
                    <div className="text-center">
                      <svg className="mx-auto h-16 w-16 mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      <p className="text-lg">Video Lesson</p>
                      <p className="text-sm text-gray-300 mt-2">Duration: {lesson.duration || data.duration || 0} minutes</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

      case 'youtube':
        return (
          <div className="relative bg-black rounded-lg overflow-hidden">
            <div className="aspect-video">
              {(ytId && ytPlaying) ? (
                <div id={`yt-player-${ytId}`} className="w-full h-full" />
              ) : ytId ? (
                <button
                  type="button"
                  onClick={handleYouTubePlay}
                  className="relative w-full h-full text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Play YouTube video"
                >
                  {ytThumb && (
                    <img
                      src={ytThumb}
                      alt={lesson.title || 'YouTube thumbnail'}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={handleThumbError}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
                  <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/90 hover:bg-white transition ring-1 ring-black/10 shadow">
                      <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.5 5.5a1 1 0 011.555-.832l6 4a1 1 0 010 1.664l-6 4A1 1 0 016.5 13.5v-8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="mt-3 text-lg font-medium drop-shadow">YouTube Video Lesson</p>
                    <p className="text-sm text-gray-200">Click to play</p>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleYouTubePlay}
                  className="w-full h-full flex flex-col items-center justify-center text-white bg-gray-900"
                  aria-label="Open YouTube video"
                >
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/20">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.5 5.5a1 1 0 011.555-.832l6 4a1 1 0 010 1.664l-6 4A1 1 0 016.5 13.5v-8z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="mt-3 text-lg">YouTube Video Lesson</p>
                  <p className="text-sm text-gray-300">Duration: {lesson.duration || 0} minutes</p>
                </button>
              )}
            </div>
          </div>
        );

      case 'text': {
        const raw = lesson.content.data?.htmlContent || '';
        return (
          <div className="bg-white rounded-lg p-6">
            <MarkdownRenderer content={raw} />
          </div>
        );
      }

      case 'quiz':
        return (
          <QuizPlayer 
            lesson={lesson} 
            enrollment={enrollment} 
            onLessonComplete={onLessonComplete}
            onBookmark={handleBookmark}
            onMarkComplete={handleMarkComplete}
            isBookmarked={isBookmarked}
            isCompleted={isCompleted}
          />
        );

      case 'assessment':
        // Render the secure assessment player
        return (
          <AssessmentPlayer 
            lesson={lesson}
            enrollment={enrollment}
            onLessonComplete={onLessonComplete}
          />
        );

      default:
        return (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <p className="text-gray-500">Unsupported content type: {lesson.content.type}</p>
          </div>
        );
    }
  };

  return (
    <div>
      {/* For assessment lessons, render the full AssessmentPlayer directly */}
      {lesson?.content?.type === 'assessment' ? (
        <AssessmentPlayer 
          lesson={lesson}
          enrollment={enrollment}
          onLessonComplete={onLessonComplete}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border">
          {/* For non-quiz lessons show header as before */}
          {lesson.content?.type !== 'quiz' && (
            <>
              <div className="p-6 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900">{lesson.title} - Lesson {lesson.displayNumber || lesson.order}</h2>
                      {isCompleted && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Completed
                        </span>
                      )}
                    </div>
                    {/* Description removed per requirements */}
                    <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                      <span>Duration: {lesson.duration || 0} minutes</span>
                      <span>•</span>
                      <span>Lesson {lesson.displayNumber || lesson.order}</span>
                      {lesson.isPreview && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 font-medium">Free Preview</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={handleBookmark}
                      className={`p-2 rounded-lg border ${
                        isBookmarked
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-600'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                      title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                    >
                      <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    {enrollment && !isCompleted && lesson.content?.type !== 'video' && lesson.content?.type !== 'youtube' && (
                      <button
                        onClick={handleMarkComplete}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Mark Complete
                      </button>
                    )}
                    {enrollment && !isCompleted && (lesson.content?.type === 'video' || lesson.content?.type === 'youtube') && (
                      <div className="flex items-center space-x-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                          {progressPct >= 90 ? 'Finalizing…' : progressPct >= 60 ? 'You can finish now (60%) or watch to 90%' : 'Watch to 60% minimum'}
                        </span>
                        {manualThresholdEligible() && (
                          <button
                            type="button"
                            onClick={handleManualCompletion}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >Finish at 60%</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Lesson Content (quiz layout now internally adds its own top controls) */}
          <div className={lesson.content?.type === 'quiz' ? 'p-0' : 'p-6'}>
            {renderContent()}
          </div>

          {/* Resources (still show for non-quiz) */}
          {lesson.content?.type !== 'quiz' && lesson.resources && lesson.resources.length > 0 && (
            <div className="p-6 border-t bg-gray-50">
              <h4 className="text-lg font-semibold mb-3">Resources</h4>
              {(lesson.content?.type === 'video' || lesson.content?.type === 'youtube') && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 transition-all" style={{width: `${progressPct}%`}} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                    <span>{progressPct}% watched</span>
                    {manualThresholdEligible() && !isCompleted && <span className="text-green-600">Eligible for early completion</span>}
                    {!manualThresholdEligible() && !isCompleted && <span>Need 60% to enable manual finish</span>}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {lesson.resources.map((resource, index) => (
                  <a
                    key={index}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{resource.title}</span>
                    <span className="text-xs text-gray-500">({resource.type})</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonPlayer;
