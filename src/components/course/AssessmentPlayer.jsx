import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCourse } from '../../context/CourseContext';
import { useAuth } from '../../context/AuthContext';

const AssessmentPlayer = ({ lesson, enrollment, onLessonComplete }) => {
  const { markLessonComplete } = useCourse();
  const { user } = useAuth();
  
  // Assessment states
  const [assessmentState, setAssessmentState] = useState('instructions'); // 'instructions', 'active', 'submitted'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [securityViolations, setSecurityViolations] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialFullscreenAcquired, setInitialFullscreenAcquired] = useState(false); // true once first fullscreen succeeds
  const [exitAttempt, setExitAttempt] = useState(false); // becomes true only after a real exit after initial acquire
  const [forceOverlay, setForceOverlay] = useState(false); // overlay forced when auto re-entry fails or explicit escape
  const [exitCountdown, setExitCountdown] = useState(null); // 10s countdown after leaving fullscreen
  const escapePressedRef = useRef(false);
  
  // Refs
  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const keyListenerRef = useRef(null);
  
  // Assessment data from lesson content
  const assessmentData = lesson?.content?.data || {};
  const questions = assessmentData.questions || [];
  const duration = assessmentData.duration || 60; // minutes
  const allowedExits = 3;

  // Security violation logging
  const logViolation = useCallback((type, detail) => {
    const violation = {
      type,
      detail,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    setSecurityViolations(prev => [...prev, violation]);
    
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[SECURITY VIOLATION]', violation);
    }
  }, []);

  // Fullscreen management
  const enterFullscreen = useCallback(async () => {
    if (!containerRef.current) return false;
    try {
      if (containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        await containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) {
        await containerRef.current.msRequestFullscreen();
      }
      if (!initialFullscreenAcquired) setInitialFullscreenAcquired(true);
      escapePressedRef.current = false; // reset explicit escape usage after successful entry
      return true;
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      return false;
    }
  }, [initialFullscreenAcquired]);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }, []);

  // Body classes for assessment state & discussion hiding
  useEffect(() => {
    const body = document.body;
    if (assessmentState === 'active') {
      body.classList.add('assessment-active');
    } else {
      body.classList.remove('assessment-active');
    }
    // Hide discussion only when active and NOT fullscreen
    if (assessmentState === 'active' && !isFullscreen) {
      body.classList.add('assessment-hide-discussion');
    } else {
      body.classList.remove('assessment-hide-discussion');
    }
    return () => {
      body.classList.remove('assessment-active');
      body.classList.remove('assessment-hide-discussion');
    };
  }, [assessmentState, isFullscreen]);

  // Auto-submit assessment (moved above fullscreen handler to avoid TDZ)
  const handleAutoSubmit = useCallback(async (reason) => {
    if (isSubmitting) return;
    logViolation('auto_submit', { reason, answers: Object.keys(answers).length });
    setIsSubmitting(true);
    await submitAssessment(true);
  }, [answers, isSubmitting, logViolation]);

  // Fullscreen change handler (now references handleAutoSubmit which is declared above)
  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    setIsFullscreen(isCurrentlyFullscreen);
    if (!isCurrentlyFullscreen && assessmentState === 'active') {
      const newExitCount = fullscreenExits + 1;
      setFullscreenExits(newExitCount);
      logViolation('fullscreen_exit', { exitCount: newExitCount, timeRemaining, escapeKey: escapePressedRef.current });
      if (!initialFullscreenAcquired) {
        setTimeout(() => enterFullscreen(), 120);
        return;
      }
      if (!exitAttempt) setExitAttempt(true);
      if (escapePressedRef.current) {
        setForceOverlay(true);
      } else {
        setTimeout(async () => { const ok = await enterFullscreen(); if (!ok) setForceOverlay(true); }, 100);
      }
      // Start 10s countdown; auto submit when it reaches 0
      setExitCountdown(10);
      if (newExitCount >= allowedExits) handleAutoSubmit('max_exits_exceeded');
    }
    if (isCurrentlyFullscreen) {
      // Cancel countdown when user re-enters fullscreen
      setExitCountdown(null);
    }
  }, [assessmentState, fullscreenExits, timeRemaining, logViolation, initialFullscreenAcquired, exitAttempt, enterFullscreen, handleAutoSubmit]);

  // (handleAutoSubmit moved higher)

  // Security event handlers
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    logViolation('right_click', { target: e.target.tagName });
  }, [logViolation]);

  const handleKeyDown = useCallback((e) => {
    if (assessmentState === 'active') {
      if (e.key === 'Escape') {
        // Track explicit escape press; allow fullscreenchange handler to know
        escapePressedRef.current = true;
        // Prevent default to minimize immediate exit (browser dependent)
        e.preventDefault();
        e.stopPropagation();
      }
    }
    // Disable common shortcuts
    const forbiddenKeys = [ 'F12', 'I', 'J', 'U', 'C', 'V', 'A', 'S' ];
    const isForbidden = (
      (e.ctrlKey && (forbiddenKeys.includes(e.key.toUpperCase()) || e.shiftKey)) ||
      e.key === 'F12' ||
      (e.altKey && e.key === 'Tab')
    );
    if (isForbidden) {
      e.preventDefault();
      logViolation('forbidden_key', { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey });
    }
  }, [logViolation, assessmentState]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && assessmentState === 'active') {
      logViolation('tab_switch', { hidden: document.hidden });
    }
  }, [assessmentState, logViolation]);

  // Timer management
  useEffect(() => {
    if (assessmentState === 'active' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit('time_expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [assessmentState, timeRemaining, handleAutoSubmit]);

  // Exit countdown effect
  useEffect(() => {
    if (exitCountdown === null) return;
    if (exitCountdown <= 0) {
      handleAutoSubmit('fullscreen_not_restored');
      return;
    }
    const id = setTimeout(() => setExitCountdown(c => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [exitCountdown, handleAutoSubmit]);

  // Security event listeners
  useEffect(() => {
    if (assessmentState === 'active') {
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('msfullscreenchange', handleFullscreenChange);
    }
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [assessmentState, handleContextMenu, handleKeyDown, handleVisibilityChange, handleFullscreenChange]);

  // Warn on navigation / refresh
  useEffect(() => {
    const beforeUnload = (e) => {
      if (assessmentState === 'active') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [assessmentState]);

  // Start assessment
  const startAssessment = async () => {
    const success = await enterFullscreen();
    if (!success) {
      alert('This assessment requires fullscreen mode. Please allow fullscreen access and try again.');
      return;
    }
    
    setAssessmentState('active');
    setTimeRemaining(duration * 60); // Convert minutes to seconds
    logViolation('assessment_started', { duration, questionsCount: questions.length });
  };

  // Submit assessment
  const submitAssessment = async (autoSubmit = false) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Calculate score (basic implementation)
      let correctAnswers = 0;
      questions.forEach((question, index) => {
        if (answers[index] === question.correctAnswer) {
          correctAnswers++;
        }
      });
      
      const score = questions.length > 0 ? (correctAnswers / questions.length) * 100 : 0;
      
      // Mark lesson complete if passing score
      if (enrollment && score >= (assessmentData.passingScore || 70)) {
        await markLessonComplete(enrollment.course._id, lesson._id);
        onLessonComplete && onLessonComplete(lesson._id);
      }
      
      // Log submission
      logViolation('assessment_submitted', {
        autoSubmit,
        score,
        correctAnswers,
        totalQuestions: questions.length,
        timeUsed: (duration * 60) - timeRemaining,
        securityViolations: securityViolations.length
      });
      
      setAssessmentState('submitted');
      exitFullscreen();
      
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      alert('Failed to submit assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Answer change handler
  const handleAnswerChange = (questionIndex, answerIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  // Render instructions screen
  if (assessmentState === 'instructions') {
    return (
      <div ref={containerRef} className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-8 py-12">
            <div className="text-center">
              <div className="mb-8">
                <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-3xl font-light text-gray-900 mb-3 tracking-tight">
                Assessment Instructions
              </h1>
              <h2 className="text-xl font-medium text-gray-700 mb-2">{lesson.title}</h2>
              <div className="w-16 h-0.5 bg-gray-300 mx-auto"></div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-8 py-16">
          <div className="grid lg:grid-cols-2 gap-12">
            
            {/* Left Column - Assessment Details */}
            <div className="space-y-8">
              {/* Assessment Overview */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900">Assessment Details</h3>
                </div>
                <div className="p-6">
                  <dl className="space-y-4">
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Duration</dt>
                      <dd className="text-sm font-semibold text-gray-900">{duration} minutes</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Questions</dt>
                      <dd className="text-sm font-semibold text-gray-900">{questions.length} questions</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Passing Score</dt>
                      <dd className="text-sm font-semibold text-gray-900">{assessmentData.passingScore || 70}%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Attempts Allowed</dt>
                      <dd className="text-sm font-semibold text-gray-900">{allowedExits} exits maximum</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900">Instructions</h3>
                </div>
                <div className="p-6">
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>This is a proctored online assessment with activity monitoring</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>Complete the assessment in one continuous session</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>Review your answers carefully before submission</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span>Results will be available immediately after completion</span>
                    </li>
                      <li className="flex items-start">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <span>If you exit fullscreen during the test you must re-enter within <strong>10 seconds</strong> or the assessment may auto-submit</span>
                      </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Column - Security & Agreement */}
            <div className="space-y-8">
              {/* Security Requirements */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900">Security Requirements</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-sm text-gray-600">Fullscreen mode required</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-600">Tab switching is monitored</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                      <span className="text-sm text-gray-600">Copy/paste operations disabled</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.651 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-sm text-gray-600">Developer tools blocked</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agreement */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Assessment Agreement</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    By proceeding with this assessment, you acknowledge that you have read and understood 
                    all instructions and security requirements. You agree to complete the assessment 
                    according to the established guidelines.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <div className="flex">
                      <svg className="w-4 h-4 text-amber-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs text-amber-800">
                        Violations may result in automatic submission or assessment termination.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="text-center pt-12">
            <button
              onClick={startAssessment}
              className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Begin Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen re-entry warning overlay
  const FullscreenWarning = () => (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Fullscreen Required</h2>
        <p className="text-sm text-gray-600 mb-4">You exited fullscreen (Escape or browser control). Re-enter within 
          <span className="font-semibold text-gray-900 text-3xl mx-1 align-middle leading-none">{exitCountdown !== null ? exitCountdown : 10}</span>
          <span className="font-semibold text-gray-900">s</span> to continue. Repeated exits or timeout will auto-submit.
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span>Exits: {fullscreenExits}/{allowedExits}</span>
          <span>Time Left: {formatTime(timeRemaining || 0)}</span>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={async () => {
              const ok = await enterFullscreen();
              if (ok) {
                setForceOverlay(false);
                setExitCountdown(null);
              }
            }}
            className="flex-1 bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 text-sm font-medium"
          >Re-enter Fullscreen</button>
          <button onClick={() => submitAssessment(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Submit & Exit</button>
        </div>
      </div>
    </div>
  );

  // Render active assessment
  if (assessmentState === 'active') {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-white flex flex-col overflow-hidden">
        {/* Assessment Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-medium text-gray-900">{lesson.title}</h1>
                    <p className="text-sm text-gray-500">Question {Object.keys(answers).length + 1} of {questions.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-6">
                {/* Security Status */}
                <div className="flex items-center space-x-2">
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                    fullscreenExits > 0 
                      ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    <svg className={`w-4 h-4 ${fullscreenExits > 0 ? 'text-amber-600' : 'text-emerald-600'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Security: {fullscreenExits}/{allowedExits}</span>
                  </div>
                </div>
                
                {/* Timer */}
                <div className="bg-gray-900 text-white px-4 py-2 rounded-md">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-lg font-mono font-semibold">{formatTime(timeRemaining)}</span>
                  </div>
                </div>
                
                {/* Submit Button */}
                <button
                  onClick={() => submitAssessment(false)}
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:bg-gray-400 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Submit Assessment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Questions Section (scrollable) */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="space-y-6">
              {questions.map((question, questionIndex) => (
                <div key={questionIndex} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* Question Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="bg-gray-900 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium mr-3">
                          {questionIndex + 1}
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">
                          Question {questionIndex + 1}
                        </h3>
                      </div>
                      <div className="flex items-center">
                        {answers[questionIndex] !== undefined ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Answered
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Not Answered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Question Content */}
                  <div className="p-6">
                    <div className="mb-6">
                      <p className="text-lg text-gray-900 leading-relaxed font-medium">
                        {question.question}
                      </p>
                    </div>
                    
                    {/* Answer Options */}
                    <div className="space-y-3">
                      {question.options?.map((option, optionIndex) => (
                        <label 
                          key={optionIndex} 
                          className={`flex items-start p-4 rounded-md border cursor-pointer transition-all duration-200 ${
                            answers[questionIndex] === optionIndex
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center h-5 mt-0.5">
                            <input
                              type="radio"
                              name={`question-${questionIndex}`}
                              value={optionIndex}
                              checked={answers[questionIndex] === optionIndex}
                              onChange={() => handleAnswerChange(questionIndex, optionIndex)}
                              className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900 focus:ring-2"
                            />
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium mr-3 ${
                                answers[questionIndex] === optionIndex
                                  ? 'bg-gray-900 text-white'
                                  : 'bg-gray-200 text-gray-600'
                              }`}>
                                {String.fromCharCode(65 + optionIndex)}
                              </span>
                              <span className={`text-base ${
                                answers[questionIndex] === optionIndex
                                  ? 'text-gray-900 font-medium'
                                  : 'text-gray-700'
                              }`}>
                                {option}
                              </span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Bottom Submit Button */}
            <div className="mt-8 text-center">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Submit?</h3>
                  <p className="text-gray-600">
                    You have answered {Object.keys(answers).length} out of {questions.length} questions.
                  </p>
                </div>
                <button
                  onClick={() => submitAssessment(false)}
                  disabled={isSubmitting}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:bg-gray-400 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Assessment...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submit Final Assessment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        {(forceOverlay || (exitAttempt && !isFullscreen)) ? <FullscreenWarning /> : null}
      </div>
    );
  }

  // Render submission complete
  if (assessmentState === 'submitted') {
    const correctAnswers = questions.filter((question, index) => 
      answers[index] === question.correctAnswer
    ).length;
    const score = questions.length > 0 ? (correctAnswers / questions.length) * 100 : 0;
    const passed = score >= (assessmentData.passingScore || 70);

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-8 py-12">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                passed 
                  ? 'bg-emerald-600' 
                  : 'bg-gray-900'
              }`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {passed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  )}
                </svg>
              </div>
              
              <h1 className={`text-3xl font-light mb-4 tracking-tight ${
                passed 
                  ? 'text-gray-900' 
                  : 'text-gray-900'
              }`}>
                {passed ? 'Assessment Complete' : 'Assessment Complete'}
              </h1>
              
              <h2 className="text-xl font-medium text-gray-600 mb-2">
                {lesson.title}
              </h2>
              
              <div className="w-16 h-0.5 bg-gray-300 mx-auto"></div>
            </div>
          </div>
        </div>

        {/* Results Content */}
        <div className="max-w-4xl mx-auto px-8 py-16">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Score Display */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900">Your Results</h3>
                </div>
                
                <div className="p-8">
                  <div className="text-center mb-8">
                    <div className={`inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-4 ${
                      passed 
                        ? 'bg-emerald-50 border border-emerald-200' 
                        : 'bg-gray-100 border border-gray-200'
                    }`}>
                      <span className={`text-3xl font-light ${
                        passed ? 'text-emerald-600' : 'text-gray-600'
                      }`}>
                        {score.toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xl font-medium text-gray-900">
                        {correctAnswers} of {questions.length} questions correct
                      </p>
                      <p className={`text-sm font-medium ${
                        passed ? 'text-emerald-600' : 'text-gray-600'
                      }`}>
                        Passing score: {assessmentData.passingScore || 70}% • Your score: {score.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-8">
                    <div className="flex justify-between text-sm font-medium text-gray-600 mb-2">
                      <span>Performance</span>
                      <span>{score.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          passed 
                            ? 'bg-emerald-600' 
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span className="font-medium">Passing: {assessmentData.passingScore || 70}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  {/* Status Message */}
                  <div className={`rounded-lg border p-4 ${
                    passed 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 mt-0.5 ${
                        passed ? 'bg-emerald-600' : 'bg-gray-600'
                      }`}>
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          {passed ? (
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          ) : (
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          )}
                        </svg>
                      </div>
                      <div>
                        {passed ? (
                          <div>
                            <h4 className="text-base font-medium text-emerald-800 mb-1">Assessment Passed</h4>
                            <p className="text-sm text-emerald-700 leading-relaxed">
                              Congratulations! You have successfully completed this assessment. 
                              Your achievement has been recorded and you can proceed to the next module.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <h4 className="text-base font-medium text-gray-800 mb-1">Continue Learning</h4>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              You're making progress! Review the course materials and try again when ready.
                              Every attempt is a valuable learning opportunity.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h4 className="text-sm font-medium text-gray-900">Assessment Stats</h4>
                </div>
                <div className="p-4 space-y-4">
                  <div className="text-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{questions.length}</p>
                    <p className="text-xs font-medium text-gray-500">Total Questions</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{correctAnswers}</p>
                    <p className="text-xs font-medium text-gray-500">Correct Answers</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      {Math.floor(((duration * 60) - timeRemaining) / 60)}m
                    </p>
                    <p className="text-xs font-medium text-gray-500">Time Used</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="text-center mt-12">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">What's Next?</h3>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Return to Course
                </button>
              </div>
            </div>
            
            <p className="text-gray-500 text-sm mt-4">
              Your assessment results have been automatically saved and recorded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AssessmentPlayer;