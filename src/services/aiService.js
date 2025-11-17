import api from './api';

// AI Chat service
// sendMessage(messages: [{role:'user'|'assistant', content:string}]) -> { reply }
// Only minimal error handling; callers should handle thrown errors or null response.

export async function sendAIChat(messages) {
  try {
    const res = await api.post('/ai/chat', { messages });
    if (res.data?.success) {
      return res.data.data.reply;
    }
    throw new Error(res.data?.message || 'AI response failed');
  } catch (err) {
    console.error('AI chat error:', err);
    throw err;
  }
}

export async function generateQuizQuestions({ topic, lessonContent, count = 10, difficulty = 'medium' }) {
  try {
    const res = await api.post('/ai/generate-quiz', { topic, lessonContent, count, difficulty });
    if (res.data?.success) {
      return res.data.data.questions || [];
    }
    throw new Error(res.data?.message || 'Quiz generation failed');
  } catch (err) {
    console.error('AI quiz generation error:', err);
    throw err;
  }
}

export async function generateQuizVariant({ baseQuestion, mode = 'regenerate', difficulty = 'medium' }) {
  try {
    const res = await api.post('/ai/generate-quiz-variant', { baseQuestion, mode, difficulty });
    if (res.data?.success) {
      return res.data.data.question;
    }
    throw new Error(res.data?.message || 'Variant generation failed');
  } catch (err) {
    console.error('AI quiz variant error:', err);
    throw err;
  }
}

export default { sendAIChat, generateQuizQuestions, generateQuizVariant };
