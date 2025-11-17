import React, { useState, useEffect, useRef } from 'react';
import { generateQuizQuestions, generateQuizVariant } from '../services/aiService';
// Rich-text (HTML) -> Markdown conversion on paste
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import MarkdownRenderer from '../components/common/MarkdownRenderer';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import moduleService from '../services/moduleService';
import LoadingSpinner from '../components/common/LoadingSpinner';

const AdminCourseContentEditor = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  // Drag & Drop state (must be declared before any conditional returns)
  const [dragInfo, setDragInfo] = useState(null); // { type: 'module'|'lesson', fromIndex, moduleId }
  const [dragOverModuleIdx, setDragOverModuleIdx] = useState(null);
  const [dragOverLessonKey, setDragOverLessonKey] = useState(null); // `${moduleId}:${lessonIndex}`
  
  const [moduleForm, setModuleForm] = useState({
    title: ''
  });

  const [lessonForm, setLessonForm] = useState({
    title: '',
    type: 'video',
    content: '',
    duration: '',
    questions: [] // For quiz and assessment types
  });
  const [videoFile, setVideoFile] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);
  // Upload progress state for video lessons
  const [uploading, setUploading] = useState(false);
  // Distinguish whether current overlay is for create or update action
  const [uploadContext, setUploadContext] = useState(null); // 'create' | 'update' | null
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [uploadPhase, setUploadPhase] = useState(''); // 'preparing' | 'uploading' | 'done' | 'error'
  const uploadProgressUpdatedAtRef = useRef(Date.now());
  const lessonCountRef = useRef(0);

  // Helper to finalize & hide overlay
  const finalizeUpload = (success = true) => {
    setUploadProgress(100);
    setUploadPhase(success ? 'done' : 'error');
    // Quick success pulse then disappear
    setTimeout(() => {
      setUploading(false);
      setUploadPhase('');
      setUploadProgress(0);
      setUploadContext(null);
    }, success ? 300 : 1200);
  };
  // AI quiz generation state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]); // list of AI question objects
  const [aiError, setAiError] = useState(null);
  const [aiSelected, setAiSelected] = useState(new Set());
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState('medium');

  // Basic similarity function (Jaccard on lowercased words) for deduplication
  const questionSimilarity = (a, b) => {
    if (!a || !b) return 0;
    const wa = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(Boolean));
    const wb = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(Boolean));
    if (wa.size === 0 || wb.size === 0) return 0;
    let inter = 0;
    wa.forEach(w => { if (wb.has(w)) inter++; });
    return inter / Math.max(wa.size, wb.size);
  };
  const isDuplicateQuestion = (text, existingList) => {
    return existingList.some(q => questionSimilarity(q.question, text) >= 0.85);
  };

  // Refs for markdown paste handling
  const articleTextareaRef = useRef(null);
  const turndownRef = useRef(null);

  // Convert rich text (HTML) pasted from Word/ChatGPT into Markdown so formatting is preserved
  const handleArticlePaste = (e) => {
    if (lessonForm.type !== 'text') return; // only for article lessons
    if (!e.clipboardData) return;
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    // If HTML exists we use turndown. If not, attempt plain-text pattern transform.
    if (!html && plain) {
      // Detect list like patterns in plain text (Word sometimes gives plain text when copying from some places)
      const lines = plain.split(/\r?\n/);
      let inListBlock = false;
      // Detect simple table blocks: lines with 2+ consecutive spaces separating columns
      const isTableCandidate = lines.filter(l => /\S+\s{2,}\S+/.test(l)).length >= 2;
      let tableProcessed = false;
      let tableMarkdown = '';
      if (isTableCandidate) {
        const tableLines = lines.filter(l => l.trim().length > 0);
        // Split by 2+ spaces
        const rows = tableLines.map(l => l.trim().split(/\s{2,}/));
        if (rows.length >= 2) {
          const colCount = Math.max(...rows.map(r => r.length));
          const normalized = rows.map(r => [...r, ...Array(colCount - r.length).fill('')]);
          const header = normalized[0];
          const separator = header.map(() => '---');
          const body = normalized.slice(1);
          tableMarkdown = '| ' + header.join(' | ') + ' |\n| ' + separator.join(' | ') + ' |\n' + body.map(r => '| ' + r.join(' | ') + ' |').join('\n');
          tableProcessed = true;
        }
      }
      let processed = lines.map(raw => {
        const line = raw.trim();
        if (!line) { inListBlock = false; return ''; }
        if (tableProcessed) return ''; // skip original lines if table created

        // Ordered list markers: 1. 1) 1- a. a) A. i. i) etc.
        const orderedMatch = line.match(/^((\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[\.)\-])\s+(.+)$/);
        if (orderedMatch) {
          inListBlock = true;
          // Normalize roman / letter markers to numeric sequence will be handled later; keep original for readability
          return orderedMatch[1].replace(/\-$/, '.') + ' ' + orderedMatch[3];
        }
        // Unordered bullets: *, -, +, •, ·, – , — followed by space
        const unorderedMatch = line.match(/^([*+\-•·–—])\s+(.+)$/);
        if (unorderedMatch) {
          inListBlock = true;
          return '- ' + unorderedMatch[2];
        }
        // Continuation line of previous list item (indent or leading spaces)
        if (inListBlock && raw.startsWith(' ')) {
          return raw; // keep indentation for potential manual adjustment
        }
        inListBlock = false;
        return line; // plain paragraph
      }).join('\n');

      // Normalize sequences like '1)' to '1.'
      processed = processed.replace(/^(\d+)\)\s/gm, '$1. ');
      processed = processed.replace(/^([a-zA-Z])\)\s/gm, '$1. ');
      if (tableProcessed) {
        processed = tableMarkdown + '\n\n' + processed;
      }

      e.preventDefault();
      const el = articleTextareaRef.current;
      const start = el?.selectionStart ?? lessonForm.content.length;
      const end = el?.selectionEnd ?? lessonForm.content.length;
      const before = lessonForm.content.slice(0, start);
      const after = lessonForm.content.slice(end);
      const newValue = before + processed + after;
      setLessonForm(f => ({ ...f, content: newValue }));
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          const caretPos = before.length + processed.length;
          try { el.setSelectionRange(caretPos, caretPos); } catch(_){}
        }
      });
      return;
    }
    if (!html) return; // nothing extra to do

    try {
      e.preventDefault();
      if (!turndownRef.current) {
        const td = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-',
          emDelimiter: '*'
        });
        td.use(gfm);

        // Preserve paragraphs
        td.addRule('preserveLineBreaks', {
          filter: ['p'],
            replacement: (content) => `${content}\n\n`
        });

        // Normalize assorted bullet symbols to markdown '-'
        td.addRule('normalizeBullets', {
          filter: (node) => node.nodeName === 'LI',
          replacement: (content, node, options) => {
            content = content.replace(/\n+/g, ' ').trim();
            // If parent is an OL, let default ordered logic happen later; we'll handle numbering manually
            const parent = node.parentNode;
            if (parent && parent.nodeName === 'OL') {
              // Determine index
              const siblings = Array.from(parent.children).filter(c => c.nodeName === 'LI');
              const index = siblings.indexOf(node);
              // Detect list style types (a, A, i, I)
              const style = parent.getAttribute('type');
              let markerNumber;
              switch(style){
                case 'a': markerNumber = String.fromCharCode(97 + index) + '.'; break;
                case 'A': markerNumber = String.fromCharCode(65 + index) + '.'; break;
                case 'i': case 'I': {
                  const romans = ['i','ii','iii','iv','v','vi','vii','viii','ix','x'];
                  const r = romans[index] || (index+1).toString();
                  markerNumber = style === 'I' ? r.toUpperCase()+'.' : r+'.';
                  break;
                }
                default: markerNumber = (index + 1) + '.';
              }
              return `\n${markerNumber} ${content}`;
            }
            // Unordered bullets
            return `\n${options.bulletListMarker} ${content}`;
          }
        });

        // After conversion cleanup: remove duplicate markers from Turndown's own list handling
        const originalTurndown = td.turndown.bind(td);
        td.turndown = function() {
          let md = originalTurndown.apply(td, arguments);
          // Collapse accidental double bullets (e.g., '- - content')
          md = md.replace(/^(-|\d+\.)\s+(-|\d+\.)\s+/gm, '$1 ');
          // Normalize bullet symbols that slipped through
            md = md.replace(/^[*+•·–—]\s+/gm, '- ');
          return md;
        };

        turndownRef.current = td;
      }
      let markdown = turndownRef.current.turndown(html);
      // Normalize excessive blank lines (max two)
      markdown = markdown.replace(/\n{3,}/g, '\n\n');

      const el = articleTextareaRef.current;
      if (el) {
        const start = el.selectionStart ?? lessonForm.content.length;
        const end = el.selectionEnd ?? lessonForm.content.length;
        const before = lessonForm.content.slice(0, start);
        const after = lessonForm.content.slice(end);
        const newValue = before + markdown + after;
        setLessonForm(f => ({ ...f, content: newValue }));
        // Restore caret after React state update (next frame)
        requestAnimationFrame(() => {
          el.focus();
          const caretPos = before.length + markdown.length;
          try { el.setSelectionRange(caretPos, caretPos); } catch (_) {}
        });
      }
    } catch (err) {
      console.warn('Rich paste failed, falling back to plain text:', err);
    }
  };

  useEffect(() => {
    if (user?.role !== 'course_admin' && user?.role !== 'website_admin') {
      navigate('/admin');
      return;
    }
    fetchCourseData();
  }, [courseId, user, navigate]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const [courseRes, modulesRes] = await Promise.all([
        api.get(`/courses/${courseId}`),
        moduleService.getModules(courseId)
      ]);
      
      setCourse(courseRes.data?.data || courseRes.data);
      if (modulesRes.success) {
        setModules(modulesRes.data);
      }
    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Track lesson count changes to auto-dismiss overlay as soon as new lesson appears
  useEffect(() => {
    const currentCount = modules.reduce((tot, m) => tot + (m.lessons?.length || 0), 0);
    if (lessonCountRef.current === 0) {
      lessonCountRef.current = currentCount; // initialize baseline
    } else if (uploading && currentCount > lessonCountRef.current) {
      // A new lesson showed up -> treat as success completion
      lessonCountRef.current = currentCount;
      finalizeUpload(true);
    }
  }, [modules, uploading]);

  const resetForms = () => {
    setModuleForm({ title: '' });
    setLessonForm({ title: '', type: 'video', content: '', duration: '', questions: [] });
    setShowModuleForm(false);
    setShowLessonForm(false);
    setEditingModule(null);
    setEditingLesson(null);
    setSelectedModuleId(null);
    setVideoFile(null);
    setVideoError('');
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!moduleForm.title) return;
    
    try {
      const res = await moduleService.createModule(courseId, moduleForm);
      if (res.success) {
        fetchCourseData();
        resetForms();
      }
    } catch (error) {
      console.error('Create module failed', error);
    }
  };

  const handleUpdateModule = async (e) => {
    e.preventDefault();
    if (!moduleForm.title || !editingModule) return;
    
    try {
      const res = await moduleService.updateModule(editingModule._id, moduleForm);
      if (res.success) {
        fetchCourseData();
        resetForms();
      }
    } catch (error) {
      console.error('Update module failed', error);
    }
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!lessonForm.title || !selectedModuleId) return;
    if (lessonForm.type === 'video' && videoError) return; // Block submit on validation error
    
    try {
      let res;
      if (lessonForm.type === 'video') {
        const fd = new FormData();
        fd.append('title', lessonForm.title);
        fd.append('description', (lessonForm.content && typeof lessonForm.content === 'string'
          ? lessonForm.content.replace(/[#>*`\-_|]/g,'').split(/\n/).map(l=>l.trim()).filter(Boolean)[0] || 'Video lesson'
          : 'Video lesson').slice(0,180));
        fd.append('duration', lessonForm.duration || 15);
        fd.append('moduleId', selectedModuleId);
        fd.append('type', 'video');
        if (videoFile) {
          fd.append('video', videoFile);
        } else if (lessonForm.content) {
          // fallback to URL if user still wants to link
            fd.append('videoUrl', lessonForm.content);
        }
        // Track upload progress only when an actual file is being sent
        if (videoFile) {
          setUploading(true);
          setUploadPhase('preparing');
          setUploadProgress(0);
        }
        res = await api.post(`/courses/${courseId}/lessons`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (!videoFile) return; // only show progress for real file upload
            if (evt.total) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              // first progress event => switch to uploading phase
              if (uploadPhase !== 'uploading') setUploadPhase('uploading');
              setUploadProgress(pct);
              uploadProgressUpdatedAtRef.current = Date.now();
            } else {
              // No total means we can't calculate percent (maybe transfer-encoding: chunked)
              if (uploadPhase !== 'uploading') setUploadPhase('uploading');
              uploadProgressUpdatedAtRef.current = Date.now();
            }
          }
        });
        // Server responded — treat as done (Drive work already completed server-side)
        if (videoFile) finalizeUpload(true);
      } else {
        const body = {
          title: lessonForm.title,
          description: (lessonForm.content && typeof lessonForm.content === 'string'
            ? lessonForm.content.replace(/[#>*`\-_|]/g,'').split(/\n/).map(l=>l.trim()).filter(Boolean)[0] || 'Auto generated description'
            : 'Auto generated description').slice(0, 180),
          duration: lessonForm.duration || 15,
          moduleId: selectedModuleId,
          type: lessonForm.type
        };
        if (lessonForm.type === 'youtube') body.youtubeUrl = lessonForm.content;
        else if (lessonForm.type === 'quiz' || lessonForm.type === 'assessment') body.questions = lessonForm.questions;
        else if (lessonForm.type === 'text') body.htmlContent = lessonForm.content || '';
        res = await api.post(`/courses/${courseId}/lessons`, body);
      }
      if (res.data.success) {
        fetchCourseData();
        resetForms();
        setVideoFile(null);
      }
    } catch (error) {
      console.error('Create lesson failed', error);
      // Surface a basic failure state for upload overlay
      if (uploading) {
        setUploadPhase('error');
        setTimeout(() => {
          setUploading(false);
        }, 1800);
      }
    }
  };

  // Validate and set selected video file
  const handleVideoFile = (file) => {
    if (!file) return;
    const allowed = ['video/mp4','video/webm','video/ogg','video/quicktime'];
    if (!allowed.includes(file.type)) {
      setVideoError('Unsupported format. Allowed: MP4, WebM, OGG, MOV');
      setVideoFile(null);
      return;
    }
    const maxBytes = 500 * 1024 * 1024; // 500MB
    if (file.size > maxBytes) {
      setVideoError('File exceeds 500MB limit');
      setVideoFile(null);
      return;
    }
    setVideoError('');
    setVideoFile(file);
  };

  const handleUpdateLesson = async (e) => {
    e.preventDefault();
    if (!lessonForm.title || !editingLesson) return;
    if (lessonForm.type === 'video' && videoError) return;

    const isVideoReplacement = lessonForm.type === 'video' && videoFile; // new file selected while editing
    try {
      let res;
      if (isVideoReplacement) {
        const fd = new FormData();
        fd.append('title', lessonForm.title);
        fd.append('type', 'video');
        fd.append('duration', lessonForm.duration || 15);
        fd.append('video', videoFile);
        setUploading(true);
        setUploadContext('update');
        setUploadPhase('preparing');
        setUploadProgress(0);
        res = await api.put(`/lessons/${editingLesson._id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (evt.total) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              if (uploadPhase !== 'uploading') setUploadPhase('uploading');
              setUploadProgress(pct);
              uploadProgressUpdatedAtRef.current = Date.now();
            } else {
              if (uploadPhase !== 'uploading') setUploadPhase('uploading');
              uploadProgressUpdatedAtRef.current = Date.now();
            }
          }
        });
        finalizeUpload(true);
      } else {
        const payload = {
          title: lessonForm.title,
          type: lessonForm.type,
          content: lessonForm.content,
          duration: lessonForm.duration
        };
        if (lessonForm.type === 'quiz' || lessonForm.type === 'assessment') {
          payload.questions = lessonForm.questions;
        } else if (lessonForm.type === 'text') {
          payload.content = lessonForm.content; // ensure text retained
        } else if (lessonForm.type === 'youtube') {
          payload.content = lessonForm.content;
        }
        res = await api.put(`/lessons/${editingLesson._id}`, payload);
      }

      if (res?.data?.success) {
        if (res.data.replacedVideo) {
          // Diagnostics: show auth mode used for new upload
            if (res.data.uploadedWith) {
              console.info('[LessonUpdate] New video uploaded using auth mode:', res.data.uploadedWith);
            }
          if (res.data.oldDriveDeleted === false || res.data.oldLocalDeleted === false) {
            console.warn('[LessonUpdate] Old file cleanup incomplete', {
              oldDriveDeleted: res.data.oldDriveDeleted,
              oldLocalDeleted: res.data.oldLocalDeleted
            });
            // Placeholder: could surface a toast/UI alert here in future
          }
        }
        fetchCourseData();
        resetForms();
        setVideoFile(null);
      }
    } catch (error) {
      console.error('Update lesson failed', error);
      if (isVideoReplacement) {
        setUploadPhase('error');
        setTimeout(() => {
          setUploading(false);
          setUploadContext(null);
        }, 1800);
      }
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Delete this module and all its lessons?')) return;
    
    try {
      const res = await moduleService.deleteModule(moduleId);
      if (res.success) {
        fetchCourseData();
      }
    } catch (error) {
      console.error('Delete module failed', error);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Delete this lesson?')) return;
    
    try {
      await api.delete(`/lessons/${lessonId}`);
      fetchCourseData();
    } catch (error) {
      console.error('Delete lesson failed', error);
    }
  };

  const startEditModule = (module) => {
    setEditingModule(module);
    setModuleForm({
      title: module.title
    });
    setShowModuleForm(true);
  };

  const startEditLesson = async (lesson) => {
    try {
      const res = await api.get(`/courses/${courseId}/lessons/${lesson._id}`);
      const data = res.data?.data || res.data;
      setEditingLesson({ _id: data._id });
      const lType = data.content?.type || 'text';
      const contentVal = lType === 'video' ? (data.content?.data?.videoUrl || '')
        : lType === 'youtube' ? (data.content?.data?.youtubeUrl || '')
        : lType === 'quiz' || lType === 'assessment' ? ''
        : (data.content?.data?.htmlContent || '');
      setLessonForm({
        title: data.title || '',
        type: lType,
        content: contentVal,
        duration: data.duration || '',
        questions: (lType === 'quiz' || lType === 'assessment') ? (data.content?.data?.questions || []) : []
      });
      setShowLessonForm(true);
    } catch (e) {
      console.error('Failed to load lesson', e);
    }
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'video': return '🎥';
      case 'text': return '📄';
      case 'youtube': return '▶️';
      case 'quiz': return '❓';
      case 'assessment': return '📋';
      default: return '📝';
    }
  };

  const getContentTypeColor = (type) => {
    switch (type) {
      case 'video': return 'bg-blue-100 text-blue-600';
      case 'text': return 'bg-green-100 text-green-600';
      case 'youtube': return 'bg-red-100 text-red-600';
      case 'quiz': return 'bg-yellow-100 text-yellow-600';
      case 'assessment': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading course content..." />;
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h2>
          <button
            onClick={() => navigate('/admin')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  const totalLessons = modules.reduce((total, mod) => total + (mod.lessons?.length || 0), 0);
  const totalDuration = modules.reduce((total, mod) => 
    total + (mod.lessons?.reduce((lessonTotal, lesson) => lessonTotal + (lesson.duration || 0), 0) || 0), 0
  );

  const reorderArray = (arr, from, to) => {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  };

  // Module DnD
  const onModuleDragStart = (index) => {
    console.log('[moduleDragStart] index', index);
    setDragInfo({ type: 'module', fromIndex: index });
  };
  const onModuleDragOver = (e, targetIndex) => {
    if (dragInfo?.type !== 'module') return;
    e.preventDefault();
    setDragOverModuleIdx(targetIndex);
  };
  const onModuleDrop = async (e, targetIndex) => {
    e.preventDefault();
    if (!dragInfo || dragInfo.type !== 'module') return;
    const fromIndex = dragInfo.fromIndex;
    console.log('[moduleDrop] from', fromIndex, 'to', targetIndex);
    setDragOverModuleIdx(null);
    setDragInfo(null);
    if (fromIndex === targetIndex) return;
    const ordered = reorderArray([...modules].sort((a,b)=>a.order-b.order), fromIndex, targetIndex)
      .map((m, i) => ({ ...m, order: i + 1 }));
    setModules(ordered);
    try {
      const res = await moduleService.reorderModules(courseId, ordered.map(m => m._id));
      console.log('[moduleDrop] server response', res);
    } catch (ePersist) {
      console.error('Persist module order failed', ePersist);
      fetchCourseData();
    }
  };
  const onModuleDragEnd = () => {
    setDragOverModuleIdx(null);
    setDragInfo(null);
  };

  // Lesson DnD (within same module)
  const onLessonDragStart = (moduleId, index) => {
    console.log('[lessonDragStart] module', moduleId, 'index', index);
    setDragInfo({ type: 'lesson', moduleId, fromIndex: index });
  };
  const onLessonDragOver = (e, moduleId, targetIndex) => {
    if (dragInfo?.type !== 'lesson' || dragInfo.moduleId !== moduleId) return;
    e.preventDefault();
    setDragOverLessonKey(`${moduleId}:${targetIndex}`);
  };
  const onLessonDrop = async (e, moduleId, targetIndex) => {
    e.preventDefault();
    if (!dragInfo || dragInfo.type !== 'lesson' || dragInfo.moduleId !== moduleId) return;
    const fromIndex = dragInfo.fromIndex;
    console.log('[lessonDrop] from', fromIndex, 'to', targetIndex);
    setDragOverLessonKey(null);
    setDragInfo(null);
    if (fromIndex === targetIndex) return;
    const moduleIdx = modules.findIndex(m => m._id === moduleId);
    if (moduleIdx < 0) return;
    const mod = modules[moduleIdx];
    const currentLessons = [...(mod.lessons || [])];
    const reordered = reorderArray(currentLessons, fromIndex, targetIndex);
    const optimisticLessons = reordered.map((l, i) => ({ ...l, order: i + 1 }));
    setModules(ms => ms.map((m, i) => i === moduleIdx ? { ...m, lessons: optimisticLessons } : m));
    try {
      const res = await moduleService.reorderModuleLessons(moduleId, reordered.map(l => l._id));
      console.log('[lessonDrop] server response', res);
      if (res.success && res.data) {
        setModules(prev => prev.map(m => m._id === moduleId ? { ...m, lessons: res.data.lessons } : m));
      } else {
        fetchCourseData();
      }
    } catch (err) {
      console.error('[lessonDrop] persist failed', err);
      fetchCourseData();
    }
  };
  const onLessonDragEnd = () => {
    setTimeout(() => {
      if (dragInfo && dragInfo.type === 'lesson') {
        console.log('[lessonDragEnd fallback] refetch');
        fetchCourseData();
      }
    }, 50);
    setDragOverLessonKey(null);
    setDragInfo(null);
  };

  // Question management for quiz/assessment
  const addQuestion = () => {
    setLessonForm({
      ...lessonForm,
      questions: [
        ...lessonForm.questions,
        {
          id: Date.now(),
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          marks: 1
        }
      ]
    });
  };

  const updateQuestion = (questionIndex, field, value) => {
    const updatedQuestions = [...lessonForm.questions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      [field]: value
    };
    setLessonForm({ ...lessonForm, questions: updatedQuestions });
  };

  const updateQuestionOption = (questionIndex, optionIndex, value) => {
    const updatedQuestions = [...lessonForm.questions];
    updatedQuestions[questionIndex].options[optionIndex] = value;
    setLessonForm({ ...lessonForm, questions: updatedQuestions });
  };

  const removeQuestion = (questionIndex) => {
    const updatedQuestions = lessonForm.questions.filter((_, index) => index !== questionIndex);
    setLessonForm({ ...lessonForm, questions: updatedQuestions });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                <span>My Courses</span>
                <span>/</span>
                <span>{course.title}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Course Content Manager</h1>
              <p className="text-gray-600 mt-1">Organize your course into modules and lessons</p>
            </div>
            <button
              onClick={() => setShowModuleForm(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <span>+</span>
              <span>Add Module</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border p-8 mb-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600">{modules.length}</div>
              <div className="text-gray-600 mt-1">Modules</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600">{totalLessons}</div>
              <div className="text-gray-600 mt-1">Lessons</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600">{totalDuration} min</div>
              <div className="text-gray-600 mt-1">Total Duration</div>
            </div>
          </div>
        </div>

        {/* Modules List */}
        <div className="space-y-6">
          {[...modules].sort((a, b) => a.order - b.order).map((module, moduleIndex) => (
            <div
              key={module._id}
              className={`bg-white rounded-lg border ${dragOverModuleIdx===moduleIndex ? 'ring-2 ring-blue-300' : ''}`}
              // Removed draggable from wrapper to reduce nested DnD conflicts
              onDragOver={(e) => onModuleDragOver(e, moduleIndex)}
              onDrop={(e) => onModuleDrop(e, moduleIndex)}
            >
              {/* Module Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm font-medium cursor-move"
                      title="Drag to reorder"
                      draggable
                      onDragStart={() => onModuleDragStart(moduleIndex)}
                      onDragEnd={onModuleDragEnd}
                    >
                      ☰
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{module.title}</h3>
                      <p className="text-gray-600 mt-1">{module.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                        <span>{module.lessons?.length || 0} lessons</span>
                        <span>•</span>
                        <span>{module.lessons?.reduce((total, lesson) => total + (lesson.duration || 0), 0)} minutes</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedModuleId(module._id);
                        setShowLessonForm(true);
                      }}
                      className="bg-green-100 text-green-600 p-2 rounded hover:bg-green-200"
                    >
                      +
                    </button>
                    <button
                      onClick={() => startEditModule(module)}
                      className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteModule(module._id)}
                      className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              {/* Lessons */}
              {module.lessons && module.lessons.length > 0 && (
                <div className="p-6">
                  <div className="space-y-4">
                    {[...(module.lessons || [])]/* removed .sort((a, b) => a.order - b.order) since server returns ordered */.map((lesson, lessonIndex) => (
                      <div
                        key={lesson._id}
                        className={`border border-gray-200 rounded-lg p-4 ${dragOverLessonKey===`${module._id}:${lessonIndex}` ? 'ring-2 ring-blue-300' : ''}`}
                        draggable
                        onDragStart={() => onLessonDragStart(module._id, lessonIndex)}
                        onDragOver={(e) => onLessonDragOver(e, module._id, lessonIndex)}
                        onDrop={(e) => onLessonDrop(e, module._id, lessonIndex)}
                        onDragEnd={onLessonDragEnd}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm cursor-move" title="Drag to reorder">☰</div>
                            <div className={`p-2 rounded ${getContentTypeColor(lesson.content?.type || lesson.type)}`}>
                              {getContentTypeIcon(lesson.content?.type || lesson.type)}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                              {/* Lesson description removed per requirements */}
                              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                                <span>⏱️ {lesson.duration || 15} minutes</span>
                                {lesson.isPreview && (
                                  <>
                                    <span>•</span>
                                    <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded">👁️ Preview</span>
                                  </>
                                )}
                                <span className={`px-2 py-0.5 rounded text-xs ${getContentTypeColor(lesson.content?.type || lesson.type)}`}>
                                  {lesson.content?.type || lesson.type}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => startEditLesson(lesson)}
                              className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(lesson._id)}
                              className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {modules.length === 0 && (
            <div className="bg-white rounded-lg border p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No modules yet</h3>
              <p className="text-gray-600 mb-6">Start building your course by adding your first module</p>
              <button
                onClick={() => setShowModuleForm(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                Add Your First Module
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Module Form Modal */}
      {showModuleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingModule ? 'Edit Module' : 'Add New Module'}
              </h2>
            </div>
            <form onSubmit={editingModule ? handleUpdateModule : handleCreateModule} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Module Title *
                </label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Introduction to React"
                  required
                />
              </div>
              {/* Module description field removed */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={resetForms}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingModule ? 'Update Module' : 'Add Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Form Modal */}
      {showLessonForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingLesson ? 'Edit Lesson' : 'Add New Lesson'}
              </h2>
              <button
                onClick={resetForms}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={editingLesson ? handleUpdateLesson : handleCreateLesson} className="p-6 overflow-y-auto">
              {/* Basic Information */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-4 pb-2 border-b">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lesson Title *
                    </label>
                    <input
                      type="text"
                      value={lessonForm.title}
                      onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="What is React?"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lesson Type *
                    </label>
                    <select
                      value={lessonForm.type}
                      onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="video">Video - Lecture recordings, tutorials</option>
                      <option value="text">Article - Text-based content</option>
                      <option value="youtube">YouTube - External videos</option>
                      <option value="quiz">Quiz - Interactive questions</option>
                      <option value="assessment">Assessment - Certification exam</option>
                    </select>
                  </div>
                </div>

                {/* Lesson description field removed */}
              </div>

              {/* Content Details */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-4 pb-2 border-b">Content Details</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {lessonForm.type === 'video' ? 'Video File or URL' :
                     lessonForm.type === 'youtube' ? 'YouTube URL' :
                     lessonForm.type === 'quiz' ? 'Quiz Questions' :
                     lessonForm.type === 'assessment' ? 'Assessment Questions' : 'Article Content'}
                  </label>
                  {lessonForm.type === 'text' ? (
                    <>
                      <textarea
                        ref={articleTextareaRef}
                        value={lessonForm.content}
                        onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                        onPaste={handleArticlePaste}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        rows="8"
                        placeholder="Use Markdown: # Heading, **bold**, *italic*, - list, 1. numbered, \
`code`, tables, - [ ] task list"
                      />
                      <div className="mt-4 border border-gray-200 rounded-lg p-3 bg-white/70">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Live Preview</div>
                        <div className="max-h-64 overflow-y-auto pr-1">
                          <MarkdownRenderer content={lessonForm.content} />
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-gray-700 m-0">Markdown Cheat Sheet (Copy / Paste)</p>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-snug bg-white border border-gray-200 rounded p-2 overflow-auto">{`# Heading 1
## Heading 2

**bold** *italic* \`inline code\`

- Bullet item
- Another item

1. Numbered item
2. Second item

- [ ] Task to do
- [x] Completed task

| Col A | Col B |
| ----- | ----- |
| A1    | B1    |

Blank line = new paragraph`}</pre>
                      </div>
                    </>
                  ) : lessonForm.type === 'quiz' || lessonForm.type === 'assessment' ? (
                    <div className="space-y-4">
                      {/* AI Generation Toolbar */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-lg p-3">
                        <div className="text-sm font-medium text-blue-700 flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /></svg>
                          <span>Generate questions with AI</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center text-[11px] bg-white rounded-md overflow-hidden border border-blue-200">
                            {['easy','medium','hard'].map(level => (
                              <button
                                key={level}
                                type="button"
                                onClick={() => setAiDifficulty(level)}
                                className={`px-2 py-1 uppercase tracking-wide font-semibold ${aiDifficulty===level ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100'}`}
                              >{level}</button>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={aiGenerating}
                            onClick={async () => {
                              setShowAIPanel(true);
                              if (aiSuggestions.length === 0) {
                                setAiError(null);
                                setAiGenerating(true);
                                try {
                                  const aggregatedContext = modules.map(m => (m.lessons || []).map(l => `${l.title}: ${l.content?.data?.htmlContent || ''}`).join('\n')).join('\n');
                                  let qs = await generateQuizQuestions({
                                    topic: course?.title || lessonForm.title,
                                    lessonContent: (lessonForm.content || aggregatedContext).slice(0,4000),
                                    count: 10,
                                    difficulty: aiDifficulty
                                  });
                                  // Deduplicate against existing lesson questions and internal duplicates
                                  const existing = lessonForm.questions || [];
                                  const filtered = [];
                                  qs.forEach(q => {
                                    if (!isDuplicateQuestion(q.question, existing) && !isDuplicateQuestion(q.question, filtered)) {
                                      filtered.push(q);
                                    }
                                  });
                                  qs = filtered;
                                  setAiSuggestions(qs);
                                  setAiSelected(new Set(qs.map(q => q.id))); // select all by default
                                } catch (e) {
                                  setAiError(e.message || 'Failed to generate');
                                } finally {
                                  setAiGenerating(false);
                                }
                              }
                            }}
                            className="px-3 py-2 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                          >{aiGenerating ? 'Generating…' : (aiSuggestions.length ? 'View AI Suggestions' : 'Generate with AI')}</button>
                          {showAIPanel && (
                            <button type="button" onClick={() => setShowAIPanel(false)} className="px-2 py-2 text-xs border rounded-md bg-white hover:bg-gray-50">Close</button>
                          )}
                        </div>
                      </div>
                      {showAIPanel && (
                        <div className="border border-blue-200 rounded-lg p-4 bg-white shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-blue-700">AI Generated Suggestions</h4>
                            <div className="flex items-center gap-2 text-xs">
                              <button type="button" onClick={() => setAiSelected(new Set(aiSuggestions.map(q => q.id)))} className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Select All</button>
                              <button type="button" onClick={() => setAiSelected(new Set())} className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Clear</button>
                              <button
                                type="button"
                                disabled={aiSelected.size === 0}
                                onClick={() => {
                                  const chosen = aiSuggestions.filter(q => aiSelected.has(q.id)).map(q => ({
                                    id: Date.now() + Math.random(),
                                    question: q.question,
                                    options: q.options,
                                    correctAnswer: q.correctAnswer,
                                    marks: q.marks || 1
                                  }));
                                  setLessonForm(prev => ({ ...prev, questions: [...prev.questions, ...chosen] }));
                                  setShowAIPanel(false);
                                }}
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >Add Selected ({aiSelected.size})</button>
                            </div>
                          </div>
                          {aiError && <div className="text-xs text-red-600 mb-2">{aiError}</div>}
                          {aiGenerating && <div className="text-xs text-blue-600">Generating questions...</div>}
                          {!aiGenerating && aiSuggestions.length === 0 && !aiError && <div className="text-xs text-gray-500">No suggestions yet.</div>}
                          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {aiSuggestions.map((q, i) => (
                              <div key={q.id} className={`p-3 rounded border ${aiSelected.has(q.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium mb-1">Q{i + 1}. {q.question}</p>
                                    <ul className="text-xs list-disc ml-5 space-y-1">
                                      {q.options.map((opt, idx) => (
                                        <li key={idx} className={idx === q.correctAnswer ? 'font-semibold text-green-700' : 'text-gray-700'}>{opt}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="flex flex-col items-end space-y-2">
                                    <label className="inline-flex items-center text-xs cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="mr-1"
                                        checked={aiSelected.has(q.id)}
                                        onChange={() => setAiSelected(prev => {
                                          const copy = new Set(prev);
                                          if (copy.has(q.id)) copy.delete(q.id); else copy.add(q.id);
                                          return copy;
                                        })}
                                      />Select
                                    </label>
                                    <span className="text-[10px] text-gray-500">Answer: {String.fromCharCode(65 + q.correctAnswer)}</span>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-300 hover:bg-gray-100"
                                        title="Regenerate"
                                        onClick={async () => {
                                          try {
                                            const variant = await generateQuizVariant({ baseQuestion: q, mode: 'regenerate', difficulty: aiDifficulty });
                                            if (isDuplicateQuestion(variant.question, aiSuggestions.filter(s => s.id !== q.id)) || isDuplicateQuestion(variant.question, lessonForm.questions)) {
                                              setAiError('Regenerated variant was too similar, try again.');
                                              return;
                                            }
                                            setAiSuggestions(prev => prev.map(s => s.id === q.id ? { ...variant, id: q.id } : s));
                                          } catch (e) {
                                            setAiError(e.message || 'Regenerate failed');
                                          }
                                        }}
                                      >↻</button>
                                      <button
                                        type="button"
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-blue-300 text-blue-600 hover:bg-blue-50"
                                        title="More like this (add variant)"
                                        onClick={async () => {
                                          try {
                                            const variant = await generateQuizVariant({ baseQuestion: q, mode: 'more_like_this', difficulty: aiDifficulty });
                                            if (isDuplicateQuestion(variant.question, aiSuggestions) || isDuplicateQuestion(variant.question, lessonForm.questions)) {
                                              setAiError('Variant was too similar to existing suggestions.');
                                              return;
                                            }
                                            setAiSuggestions(prev => {
                                              const newList = [...prev, { ...variant, id: variant.id }];
                                              setAiSelected(sel => new Set([...sel, variant.id]));
                                              return newList;
                                            });
                                          } catch (e) {
                                            setAiError(e.message || 'Variant failed');
                                          }
                                        }}
                                      >➕</button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {lessonForm.questions.map((question, questionIndex) => (
                        <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-medium text-gray-900">Question {questionIndex + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeQuestion(questionIndex)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                          
                          <div className="mb-3">
                            <input
                              type="text"
                              value={question.question}
                              onChange={(e) => updateQuestion(questionIndex, 'question', e.target.value)}
                              placeholder="Enter your question here..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-2 mb-3">
                            {question.options.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`question-${questionIndex}`}
                                  checked={question.correctAnswer === optionIndex}
                                  onChange={() => updateQuestion(questionIndex, 'correctAnswer', optionIndex)}
                                  className="text-blue-600"
                                />
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => updateQuestionOption(questionIndex, optionIndex, e.target.value)}
                                  placeholder={`Option ${optionIndex + 1}`}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center space-x-4">
                            <label className="text-sm font-medium text-gray-700">Marks:</label>
                            <input
                              type="number"
                              value={question.marks}
                              onChange={(e) => updateQuestion(questionIndex, 'marks', parseInt(e.target.value) || 1)}
                              min="1"
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                      >
                        + Add Question
                      </button>
                    </div>
                  ) : (
                    lessonForm.type === 'video' ? (
                      <div className="space-y-3">
                        <div
                          className={`relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer group ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'} ${videoError ? 'border-red-400 bg-red-50' : ''}`}
                          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragActive(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleVideoFile(file);
                          }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/ogg,video/quicktime"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoFile(file);
                            }}
                          />
                          <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 mb-3 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                              🎥
                            </div>
                            {!videoFile && (
                              <>
                                <p className="text-sm font-medium text-gray-800">Drag & drop your video here</p>
                                <p className="text-xs text-gray-500 mt-1">or <span className="text-blue-600 underline">browse</span> (MP4 / WebM / OGG / MOV)</p>
                                <p className="text-[10px] text-gray-400 mt-2 tracking-wide uppercase">Max 500MB</p>
                              </>
                            )}
                            {videoFile && (
                              <div className="w-full">
                                <div className="flex items-center justify-between text-xs text-gray-600 font-medium mb-1">
                                  <span className="truncate max-w-[65%]" title={videoFile.name}>{videoFile.name}</span>
                                  <span>{(videoFile.size/1024/1024).toFixed(1)} MB</span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button type="button" onClick={() => { setVideoFile(null); setVideoError(''); }} className="px-2 py-1 text-[11px] rounded bg-gray-100 hover:bg-gray-200 border border-gray-300">Remove</button>
                                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-2 py-1 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700">Change</button>
                                </div>
                              </div>
                            )}
                          </div>
                          {videoError && <div className="mt-3 text-[11px] text-red-600 font-medium">{videoError}</div>}
                        </div>
                        {!videoFile && (
                          <input
                            type="url"
                            value={lessonForm.content}
                            onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="(Optional legacy URL) https://example.com/video.mp4"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={lessonForm.content}
                        onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={
                          lessonForm.type === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'Content URL'
                        }
                      />
                    )
                  )}
                  {lessonForm.type === 'video' && (
                    <p className="text-xs text-gray-500 mt-1">Upload a video file (mp4/webm/ogg/mov) up to 500MB. If Google Drive integration is configured server-side it will be moved and streamed from there.</p>
                  )}
                  {(lessonForm.type === 'quiz' || lessonForm.type === 'assessment') && lessonForm.questions.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Add questions with multiple choice options. Select the correct answer for each question.
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={lessonForm.duration}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="15"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={resetForms}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || (lessonForm.type==='video' && videoError)}
                  className={`flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {editingLesson ? (lessonForm.type==='video' && videoFile ? 'Replace Video' : 'Update Lesson') : 'Add Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Upload Overlay */}
      {uploading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl border border-gray-200 p-8 relative">
            <div className="absolute -top-3 -right-3 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
              🎥
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span>{uploadContext === 'update' ? 'Replacing Video' : 'Uploading Video'}</span>
              {uploadPhase === 'done' && <span className="text-green-600 text-base">✓</span>}
              {uploadPhase === 'error' && <span className="text-red-600 text-base">⚠</span>}
            </h2>
            <p className="text-sm text-gray-600 mb-6 min-h-[1.25rem]">
              {uploadPhase === 'preparing' && (uploadContext === 'update' ? 'Preparing replacement…' : 'Preparing file…')}
              {uploadPhase === 'uploading' && (uploadContext === 'update' ? 'Uploading new video…' : 'Transferring data to server…')}
              {uploadPhase === 'done' && (uploadContext === 'update' ? 'Replacement complete' : 'Upload complete')}
              {uploadPhase === 'error' && (uploadContext === 'update' ? 'Replacement failed.' : 'Upload failed. Cleaning up…')}
            </p>
            <div className="mb-4">
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${uploadPhase==='error' ? 'bg-red-500' : 'bg-blue-600'}`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{uploadPhase === 'error' ? 'Error' : `${uploadProgress}%`}</span>
                <span>
                  {uploadPhase === 'preparing' && (uploadContext === 'update' ? 'Starting' : 'Starting')}
                  {uploadPhase === 'uploading' && (uploadContext === 'update' ? 'Replacing' : 'Uploading')}
                  {uploadPhase === 'done' && 'Completed'}
                  {uploadPhase === 'error' && 'Retry soon'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block animate-pulse" />Live Progress</div>
              <span>Don’t close tab</span>
              {uploadPhase === 'done' && (
                <button
                  type="button"
                  onClick={() => { setUploading(false); }}
                  className="ml-auto px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-[10px]"
                >Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCourseContentEditor;