import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import discussionService from '../../services/discussionService';

const ModerationPanel = ({ discussion, onUpdate }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Check if user has moderation permissions
  const canModerate = user && (
    user.role === 'website_admin' || 
    user.role === 'course_admin' || 
    discussion.author._id === user._id
  );

  if (!canModerate) {
    return null;
  }

  const handleTogglePin = async () => {
    setLoading(true);
    try {
      const response = await discussionService.moderateDiscussion(discussion._id, {
        action: 'pin',
        value: !discussion.isPinned
      });
      
      if (response.success) {
        onUpdate({ ...discussion, isPinned: !discussion.isPinned });
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async () => {
    setLoading(true);
    try {
      const response = await discussionService.moderateDiscussion(discussion._id, {
        action: 'lock',
        value: !discussion.isLocked
      });
      
      if (response.success) {
        onUpdate({ ...discussion, isLocked: !discussion.isLocked });
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleResolve = async () => {
    setLoading(true);
    try {
      const response = await discussionService.moderateDiscussion(discussion._id, {
        action: 'resolve',
        value: !discussion.isResolved
      });
      
      if (response.success) {
        onUpdate({ 
          ...discussion, 
          isResolved: !discussion.isResolved,
          resolvedBy: !discussion.isResolved ? user._id : null,
          resolvedAt: !discussion.isResolved ? new Date() : null
        });
      }
    } catch (error) {
      console.error('Error toggling resolve:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiscussion = async () => {
    if (!window.confirm('Are you sure you want to delete this discussion? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await discussionService.deleteDiscussion(discussion._id);
      
      if (response.success) {
        onUpdate(null); // Signal deletion to parent
      }
    } catch (error) {
      console.error('Error deleting discussion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="font-semibold text-amber-800">Moderation Tools</span>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
          {user.role === 'website_admin' ? 'Website Admin' : 
           user.role === 'course_admin' ? 'Course Instructor' : 'Author'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={handleTogglePin}
          disabled={loading}
          className={`flex items-center justify-center space-x-2 p-3 rounded-lg border transition-all duration-200 ${
            discussion.isPinned
              ? 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
            <path fillRule="evenodd" d="M3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">
            {discussion.isPinned ? 'Unpin' : 'Pin'}
          </span>
        </button>

        <button
          onClick={handleToggleLock}
          disabled={loading}
          className={`flex items-center justify-center space-x-2 p-3 rounded-lg border transition-all duration-200 ${
            discussion.isLocked
              ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {discussion.isLocked ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            )}
          </svg>
          <span className="text-sm font-medium">
            {discussion.isLocked ? 'Unlock' : 'Lock'}
          </span>
        </button>

        <button
          onClick={handleToggleResolve}
          disabled={loading}
          className={`flex items-center justify-center space-x-2 p-3 rounded-lg border transition-all duration-200 ${
            discussion.isResolved
              ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">
            {discussion.isResolved ? 'Unresolve' : 'Mark Resolved'}
          </span>
        </button>

        {(user.role === 'website_admin' || discussion.author._id === user._id) && (
          <button
            onClick={handleDeleteDiscussion}
            disabled={loading}
            className="flex items-center justify-center space-x-2 p-3 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-sm font-medium">Delete</span>
          </button>
        )}
      </div>

      {discussion.isLocked && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-medium">This discussion is locked. New messages cannot be posted.</span>
          </div>
        </div>
      )}
    </div>
  );
};

const MessageModerationMenu = ({ message, discussion, onUpdate }) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check moderation permissions
  const canModerate = user && (
    user.role === 'website_admin' || 
    user.role === 'course_admin' || 
    discussion.author._id === user._id ||
    message.author._id === user._id
  );

  const canMarkBestAnswer = user && (
    user.role === 'website_admin' || 
    user.role === 'course_admin' || 
    discussion.author._id === user._id
  );

  if (!canModerate) {
    return null;
  }

  const handleMarkBestAnswer = async () => {
    setLoading(true);
    try {
      await discussionService.markBestAnswer(message._id);
      onUpdate({ ...message, isBestAnswer: true });
      setShowMenu(false);
    } catch (error) {
      console.error('Error marking best answer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await discussionService.deleteMessage(message._id);
        if (response.success) {
          onUpdate({ ...message, isDeleted: true });
        setShowMenu(false);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
            {canMarkBestAnswer && !message.isBestAnswer && discussion.category === 'question' && (
              <button
                onClick={handleMarkBestAnswer}
                disabled={loading}
                className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Mark as Best Answer</span>
                </div>
              </button>
            )}

            {(user.role === 'website_admin' || message.author._id === user._id) && (
              <button
                onClick={handleDeleteMessage}
                disabled={loading}
                className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Message</span>
                </div>
              </button>
            )}

            <button
              onClick={() => setShowMenu(false)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export { ModerationPanel, MessageModerationMenu };