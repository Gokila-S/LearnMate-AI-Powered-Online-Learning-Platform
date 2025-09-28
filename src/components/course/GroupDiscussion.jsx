import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import discussionService from '../../services/discussionService';
import { ModerationPanel, MessageModerationMenu } from './ModerationTools';
import LoadingSpinner from '../common/LoadingSpinner';

const GroupDiscussion = ({ courseId, isEnrolled }) => {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedDiscussion, setSelectedDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    sort: 'lastActivity',
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasMore: true
  });
  const [accessError, setAccessError] = useState(null); // capture 403 or other access related issues

  const [newDiscussion, setNewDiscussion] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: []
  });

  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageError, setMessageError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(null);
  const messagesEndRef = useRef(null);
  const pollInterval = useRef(null);

  // Category options with modern styling
  const categories = [
    { value: 'all', label: '🌟 All Discussions', color: 'bg-gray-100 text-gray-800' },
    { value: 'general', label: '💬 General', color: 'bg-blue-100 text-blue-800' },
    { value: 'question', label: '❓ Questions', color: 'bg-green-100 text-green-800' },
    { value: 'assignment', label: '📋 Assignments', color: 'bg-purple-100 text-purple-800' },
    { value: 'announcement', label: '📢 Announcements', color: 'bg-orange-100 text-orange-800' },
    { value: 'technical', label: '🔧 Technical', color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    if (isEnrolled) {
      fetchDiscussions();
      fetchOnlineUsers();
      
      // Set up polling for real-time updates
      pollInterval.current = setInterval(() => {
        fetchOnlineUsers();
        if (selectedDiscussion) {
          fetchMessages(selectedDiscussion._id, false);
        }
      }, 30000);

      return () => {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
      };
    }
  }, [courseId, isEnrolled, filters]);

  useEffect(() => {
    if (selectedDiscussion) {
      fetchMessages(selectedDiscussion._id);
    }
  }, [selectedDiscussion]);

  // Defensive: if selected discussion was deleted elsewhere, clear it
  useEffect(() => {
    if (selectedDiscussion && !discussions.find(d => d._id === selectedDiscussion._id)) {
      setSelectedDiscussion(null);
      setMessages([]);
      setReplyingTo(null);
    }
  }, [discussions, selectedDiscussion]);

  // Intelligent auto-scroll: only if user near bottom OR new message by current user
  const messagesContainerRef = useRef(null);
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const el = messagesContainerRef.current;
    const threshold = 120; // px from bottom considered "near bottom"
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const lastMsg = messages[messages.length - 1];
    const authoredBySelf = lastMsg && lastMsg.author && user && lastMsg.author._id === user._id;
    if (distanceFromBottom < threshold || authoredBySelf) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, user]);

  const fetchDiscussions = async (page = 1) => {
    try {
      setLoading(true);
      setAccessError(null);
      const response = await discussionService.getCourseDiscussions(courseId, {
        ...filters,
        page,
        limit: 20
      });
      
      if (response.success) {
        setDiscussions(page === 1 ? response.data : [...discussions, ...response.data]);
        setPagination(response.pagination);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        setAccessError(error.response?.data?.message || 'Access denied to discussions');
      }
      console.error('Error fetching discussions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (discussionId, showLoading = true) => {
    try {
  if (showLoading) setMessagesLoading(true);
  setAccessError(null);
  const response = await discussionService.getDiscussion(courseId, discussionId);
      if (response.success) {
        setMessages(response.data.messages);
        // Only update selectedDiscussion if it's null (first load) or ids differ; avoids triggering loop
        setSelectedDiscussion(prev => {
          if (!prev || prev._id !== response.data.discussion._id) {
            return response.data.discussion;
          }
          return prev; // keep existing reference to avoid re-render storm
        });
      }
    } catch (error) {
      if (error.response?.status === 403) {
        setAccessError(error.response?.data?.message || 'Access denied to this discussion');
      }
      console.error('Error fetching messages:', error);
    } finally {
      if (showLoading) setMessagesLoading(false);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const response = await discussionService.getOnlineUsers(courseId);
      if (response.success) {
        setOnlineUsers(response.data);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        setAccessError(error.response?.data?.message || 'Access denied to online users');
      }
      console.error('Error fetching online users:', error);
    }
  };

  const createDiscussion = async (e) => {
    e.preventDefault();
    if (!newDiscussion.title.trim() || !newDiscussion.content.trim()) return;

    try {
      setCreating(true);
      setAccessError(null);
      const response = await discussionService.createDiscussion(courseId, {
        ...newDiscussion,
        tags: newDiscussion.tags.filter(tag => tag.trim())
      });

      if (response.success) {
        setDiscussions([response.data, ...discussions]);
        setNewDiscussion({ title: '', content: '', category: 'general', tags: [] });
        setShowNewDiscussion(false);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        setAccessError(error.response?.data?.message || 'You are not allowed to create discussions');
      }
      console.error('Error creating discussion:', error);
    } finally {
      setCreating(false);
    }
  };

  const createMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedDiscussion) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      content: newMessage,
      author: user,
      createdAt: new Date().toISOString(),
      upvoteCount: 0,
      downvoteCount: 0,
      totalVotes: 0,
      userVote: null,
      isBestAnswer: false,
      reactions: [],
      replies: []
    };

    // Optimistic add
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setReplyingTo(null);
    setSelectedDiscussion(prev => prev ? { ...prev, messageCount: (prev.messageCount || 0) + 1 } : prev);
    setDiscussions(prev => prev.map(d => d._id === selectedDiscussion._id ? { ...d, messageCount: (d.messageCount || 0) + 1 } : d));

    try {
      setAccessError(null);
      setMessageError(null);
      const payload = {
        content: optimisticMessage.content,
        parentMessageId: replyingTo?._id || replyingTo?.id || null
      };
      const response = await discussionService.createMessage(selectedDiscussion._id, payload);

      if (response.success) {
        // Replace temp with real
        setMessages(prev => prev.map(m => m._id === tempId ? response.data : m));
        // Optional: refetch to ensure server authoritative order (especially if server sorts best answers first)
        fetchMessages(selectedDiscussion._id, false);
      } else {
        throw new Error('API did not return success');
      }
    } catch (error) {
      console.error('Error creating message:', error);
      // Rollback optimistic message
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setSelectedDiscussion(prev => prev ? { ...prev, messageCount: Math.max((prev.messageCount || 1) - 1, 0) } : prev);
      setDiscussions(prev => prev.map(d => d._id === selectedDiscussion._id ? { ...d, messageCount: Math.max((d.messageCount || 1) - 1, 0) } : d));
        setPendingNotice('Message failed to send');
        setTimeout(() => setPendingNotice(null), 4000);
      if (error.response?.status === 403) {
        setAccessError(error.response?.data?.message || 'You are not allowed to post messages');
      } else {
        setMessageError(error.response?.data?.message || 'Failed to send message');
        setTimeout(() => setMessageError(null), 5000);
      }
    }
  };

  const handleVote = async (type, itemId, itemType) => {
    try {
      let response;
      if (itemType === 'discussion') {
        response = await discussionService.voteOnDiscussion(itemId, type);
      } else {
        response = await discussionService.voteOnMessage(itemId, type);
      }

      if (response.success) {
        if (itemType === 'discussion' && selectedDiscussion?._id === itemId) {
          setSelectedDiscussion(prev => ({
            ...prev,
            ...response.data
          }));
        } else {
          setMessages(prev => prev.map(msg => 
            msg._id === itemId ? { ...msg, ...response.data } : msg
          ));
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const getCategoryConfig = (category) => {
    return categories.find(c => c.value === category) || categories[0];
  };

  if (!isEnrolled) {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-blue-200 shadow-lg p-8 mb-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Join the Course Discussion</h3>
          <p className="text-gray-600 mb-4">Connect with fellow learners and instructors in our collaborative discussion space</p>
          <div className="text-sm text-blue-600 bg-blue-100 px-4 py-2 rounded-full inline-block">
            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Enroll in the course to access discussions
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-assessment-discussion className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
      {/* Discussion Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Group Discussion</h2>
              <p className="text-slate-300 text-sm">Connect with your learning community</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-600/50 rounded-full px-3 py-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">{onlineUsers.length} online</span>
            </div>

            <button
              onClick={() => setShowNewDiscussion(!showNewDiscussion)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Discussion
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-300">Filter:</span>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value} className="bg-slate-700 text-white">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-300">Sort:</span>
            <select
              value={filters.sort}
              onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
              className="bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="lastActivity" className="bg-slate-700">Latest Activity</option>
              <option value="created" className="bg-slate-700">Newest First</option>
              <option value="votes" className="bg-slate-700">Most Popular</option>
            </select>
          </div>

          <div className="flex-1 min-w-64">
            <div className="relative">
              <input
                type="text"
                placeholder="Search discussions..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full bg-slate-600/50 border border-slate-500 rounded-lg px-4 py-1.5 pl-10 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {accessError && (
        <div className="bg-red-50 text-red-700 px-6 py-3 text-sm border-t border-b border-red-200 flex items-start gap-2">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">{accessError}</p>
            <p className="text-xs mt-1 text-red-600/80">If you just enrolled or logged in, try refreshing. Contact support if this persists.</p>
          </div>
          <button onClick={() => setAccessError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* New Discussion Form */}
      {showNewDiscussion && (
        <div className="bg-gray-50 border-b border-gray-200 p-6">
          <form onSubmit={createDiscussion} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Discussion title..."
                value={newDiscussion.title}
                onChange={(e) => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                required
              />
            </div>
            
            <div>
              <textarea
                placeholder="Start the conversation..."
                value={newDiscussion.content}
                onChange={(e) => setNewDiscussion(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 resize-none"
                required
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <select
                value={newDiscussion.category}
                onChange={(e) => setNewDiscussion(prev => ({ ...prev, category: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.slice(1).map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Tags (comma separated)"
                  value={newDiscussion.tags.join(', ')}
                  onChange={(e) => setNewDiscussion(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) 
                  }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewDiscussion(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDiscussion.title.trim() || !newDiscussion.content.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {creating ? 'Creating...' : 'Create Discussion'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Adjustable height: base 60vh with ability to expand */}
        <div className="flex relative">
        <div className="absolute right-4 -top-12 flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-slate-700 text-white hover:bg-slate-600 shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={expanded ? 'Reduce height' : 'Expand height'}
          >
            {expanded ? 'Collapse View' : 'Expand View'}
          </button>
        </div>
        {/* Discussion List */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col h-[60vh]">
          <div className="flex-1 overflow-y-auto">
            {loading && discussions.length === 0 ? (
              <div className="p-6 text-center">
                <LoadingSpinner size="sm" />
              </div>
            ) : discussions.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <svg className="mx-auto w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No discussions yet</h3>
                <p>Start the conversation by creating the first discussion!</p>
              </div>
            ) : (
              <div className="space-y-1 p-4">
                {discussions.map((discussion) => {
                  const categoryConfig = getCategoryConfig(discussion.category);
                  const isSelected = selectedDiscussion?._id === discussion._id;
                  
                  return (
                    <div
                      key={discussion._id}
                      onClick={() => setSelectedDiscussion(discussion)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-200 shadow-md transform scale-[1.02]' 
                          : 'hover:bg-gray-50 border-transparent hover:border-gray-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {discussion.isPinned && (
                              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                <path fillRule="evenodd" d="M3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${categoryConfig.color}`}>
                              {categoryConfig.label}
                            </span>
                            {discussion.isResolved && (
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
                                ✅ Solved
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">{discussion.title}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{discussion.content}</p>
                        </div>
                        <div className="ml-3 text-right shrink-0">
                          <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            <span>{discussion.totalVotes || 0}</span>
                          </div>
                          <div className="text-xs text-gray-500">{formatTimeAgo(discussion.lastActivity)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <img 
                              src={discussion.author.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(discussion.author.name)}&background=random`}
                              alt={discussion.author.name}
                              className="w-4 h-4 rounded-full"
                            />
                            <span>{discussion.author.name}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            <span>{discussion.messageCount}</span>
                          </span>
                        </div>
                        {discussion.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {discussion.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {pagination.hasMore && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => fetchDiscussions(pagination.currentPage + 1)}
                className="w-full py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              >
                Load More Discussions
              </button>
            </div>
          )}
        </div>

        {/* Discussion Detail / Messages */}
  <div className="w-1/2 flex flex-col h-[75vh]">
          {selectedDiscussion ? (
            <>
              {/* Discussion Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50 max-h-64 overflow-y-auto">
                <ModerationPanel 
                  discussion={selectedDiscussion} 
                  onUpdate={(updatedDiscussion) => {
                    if (updatedDiscussion === null) {
                      setSelectedDiscussion(null);
                      setDiscussions(prev => prev.filter(d => d._id !== selectedDiscussion._id));
                      setMessages([]); // clear messages after deletion
                      setReplyingTo(null);
                    } else {
                      setSelectedDiscussion(updatedDiscussion);
                      setDiscussions(prev => prev.map(d => 
                        d._id === updatedDiscussion._id ? updatedDiscussion : d
                      ));
                    }
                  }} 
                />
                
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {selectedDiscussion.isPinned && (
                        <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                        </svg>
                      )}
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${getCategoryConfig(selectedDiscussion.category).color}`}>
                        {getCategoryConfig(selectedDiscussion.category).label}
                      </span>
                      {selectedDiscussion.isResolved && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
                          ✅ Solved
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{selectedDiscussion.title}</h3>
                    <p className="text-gray-700 mb-3">{selectedDiscussion.content}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <img 
                          src={selectedDiscussion.author.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedDiscussion.author.name)}&background=random`}
                          alt={selectedDiscussion.author.name}
                          className="w-6 h-6 rounded-full"
                        />
                        <span className="font-medium">{selectedDiscussion.author.name}</span>
                        {selectedDiscussion.author.role !== 'user' && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                            {selectedDiscussion.author.role === 'course_admin' ? 'Instructor' : 'Admin'}
                          </span>
                        )}
                      </div>
                      <span>{formatTimeAgo(selectedDiscussion.createdAt)}</span>
                    </div>
                  </div>
                  
                  {/* Vote buttons */}
                  <div className="flex flex-col items-center space-y-1 ml-4">
                    <button
                      onClick={() => handleVote(
                        selectedDiscussion.userVote === 'up' ? 'remove' : 'up', 
                        selectedDiscussion._id, 
                        'discussion'
                      )}
                      className={`p-1 rounded-lg transition-colors duration-200 ${
                        selectedDiscussion.userVote === 'up' 
                          ? 'bg-green-100 text-green-600' 
                          : 'hover:bg-gray-100 text-gray-400'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold text-gray-700">
                      {selectedDiscussion.totalVotes || 0}
                    </span>
                    <button
                      onClick={() => handleVote(
                        selectedDiscussion.userVote === 'down' ? 'remove' : 'down', 
                        selectedDiscussion._id, 
                        'discussion'
                      )}
                      className={`p-1 rounded-lg transition-colors duration-200 ${
                        selectedDiscussion.userVote === 'down' 
                          ? 'bg-red-100 text-red-600' 
                          : 'hover:bg-gray-100 text-gray-400'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                {selectedDiscussion.tags && selectedDiscussion.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedDiscussion.tags.map(tag => (
                      <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Messages Area */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.filter(m => !m.isDeleted).map((message) => (
                    <div key={message._id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <img 
                            src={message.author.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.author.name)}&background=random`}
                            alt={message.author.name}
                            className="w-8 h-8 rounded-full"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-gray-900">{message.author.name}</span>
                              {message.author.role !== 'user' && (
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                  {message.author.role === 'course_admin' ? 'Instructor' : 'Admin'}
                                </span>
                              )}
                              {message.isBestAnswer && (
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                  ✅ Best Answer
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-gray-500">{formatTimeAgo(message.createdAt)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <MessageModerationMenu 
                            message={message}
                            discussion={selectedDiscussion}
                            onUpdate={(updatedMessage) => {
                              if (!updatedMessage || updatedMessage.isDeleted) {
                                // Remove immediately and decrement counts
                                setMessages(prev => prev.filter(m => m._id !== message._id));
                                setSelectedDiscussion(prev => prev ? { ...prev, messageCount: Math.max((prev.messageCount||1)-1,0) } : prev);
                                setDiscussions(prev => prev.map(d => d._id === selectedDiscussion._id ? { ...d, messageCount: Math.max((d.messageCount||1)-1,0) } : d));
                              } else {
                                setMessages(prev => prev.map(m => m._id === updatedMessage._id ? updatedMessage : m));
                              }
                            }}
                          />
                          
                          <div className="flex flex-col items-center space-y-1">
                            <button
                              onClick={() => handleVote(
                                message.userVote === 'up' ? 'remove' : 'up', 
                                message._id, 
                                'message'
                              )}
                              className={`p-1 rounded transition-colors duration-200 ${
                                message.userVote === 'up' 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'hover:bg-gray-100 text-gray-400'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <span className="text-xs font-semibold text-gray-600">
                              {message.totalVotes || 0}
                            </span>
                            <button
                              onClick={() => handleVote(
                                message.userVote === 'down' ? 'remove' : 'down', 
                                message._id, 
                                'message'
                              )}
                              className={`p-1 rounded transition-colors duration-200 ${
                                message.userVote === 'down' 
                                  ? 'bg-red-100 text-red-600' 
                                  : 'hover:bg-gray-100 text-gray-400'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mb-3 leading-relaxed">{message.content}</p>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => setReplyingTo(message)}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Reply
                          </button>
                        </div>
                        
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex items-center space-x-1">
                            {message.reactions.map((reaction, index) => (
                              <span key={index} className="bg-gray-100 px-2 py-1 rounded-full text-xs">
                                {reaction.emoji} {reaction.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                {messageError && (
                  <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded">
                    {messageError}
                  </div>
                )}
                {pendingNotice && !messageError && (
                  <div className="mb-3 p-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-700 rounded">
                    {pendingNotice}
                  </div>
                )}
                {replyingTo && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800">
                        Replying to <strong>{replyingTo.author?.name}</strong>
                      </span>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                {selectedDiscussion.isLocked ? (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center space-x-2 text-gray-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>This discussion is locked</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={createMessage} className="flex items-end space-x-3">
                    <div className="flex-1">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={replyingTo ? "Write your reply..." : "Join the conversation..."}
                        rows={3}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            createMessage(e);
                          }
                        }}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">Press Ctrl+Enter to send</span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send</span>
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="mx-auto w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Discussion</h3>
                <p>Choose a discussion from the left to view messages and join the conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupDiscussion;