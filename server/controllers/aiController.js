import dotenv from 'dotenv';

dotenv.config();

// Simple AI chat controller using OpenAI's Chat Completions API.
// Uses global fetch (Node 18+). If on Node <18, install node-fetch and import it here.
// Expects JSON: { messages: [{ role: 'user', content: 'question' }, ...] }
// Returns: { success: true, data: { reply, usage } }

export const chatWithAI = async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, message: 'OPENAI_API_KEY not configured on server' });
    }

    // System prompt to ground the assistant as a helpful course tutor
    const systemMessage = {
      role: 'system',
      content: 'You are LearnMate AI Tutor. Provide concise, accurate answers to student questions about the lesson topic. If unsure, encourage reviewing course material. Keep answers under 220 words and use markdown for lists or code.'
    };

    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [systemMessage, ...messages].slice(-20), // limit context
      temperature: 0.7,
      max_tokens: 500
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success: false, message: 'OpenAI API error', detail: errText.slice(0,400) });
    }

    const data = await response.json();
    const choice = data.choices && data.choices[0];
    const reply = choice?.message?.content || 'Sorry, I could not generate a response.';

    return res.status(200).json({
      success: true,
      data: {
        reply,
        usage: data.usage || null
      }
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Generate quiz questions based on provided course/lesson context
// Request body: { topic, lessonContent, count? }
// Returns: { success, data: { questions: [ { question, options:[], correctAnswerIndex, explanation? } ] } }
export const generateQuizQuestions = async (req, res) => {
  try {
    const { topic, lessonContent, count = 10, difficulty = 'medium' } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success:false, message: 'OPENAI_API_KEY not configured on server' });
    }
    if (!topic && !lessonContent) {
      return res.status(400).json({ success:false, message: 'topic or lessonContent required' });
    }
    const capped = Math.min(Math.max(parseInt(count,10)||10, 1), 25);
    const diff = String(difficulty).toLowerCase();
    const difficultyDescriptor = diff === 'easy' ? 'Entry-level, foundational, recall-focused' : diff === 'hard' ? 'Advanced, multi-step reasoning, application-level' : 'Moderate difficulty, conceptual understanding';
    const systemMessage = {
      role: 'system',
      content: 'You are an educational content generator. Produce high-quality multiple-choice quiz questions (4 options) focusing on conceptual understanding, one correct answer only. Adapt question complexity to requested difficulty.'
    };
    const userPrompt = `Generate ${capped} multiple-choice questions for the topic/course: "${topic || 'N/A'}".
Difficulty requested: ${diff} (${difficultyDescriptor}).
For each question: ensure exactly 4 plausible options (A-D). Avoid trivial rephrasing duplicates. Make distractors pedagogically meaningful.
Lesson/context content (may include markdown):\n---\n${(lessonContent||'').slice(0,5000)}\n---\nReturn STRICT valid JSON with schema: {"questions":[{"question":"text","options":["A","B","C","D"],"answer":0,"explanation":"short reasoning"}]}. Do not include markdown backticks or any text outside JSON.`;

    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [systemMessage, { role: 'user', content: userPrompt }],
      temperature: 0.6,
      max_tokens: 1200
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success:false, message:'OpenAI API error', detail: errText.slice(0,400) });
    }
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    let parsed = { questions: [] };
    try { parsed = JSON.parse(raw); } catch(_) {
      // Attempt to extract JSON via regex
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch(_ignore) {}
      }
    }
    if (!Array.isArray(parsed.questions)) parsed.questions = [];
    // Normalize
    const questions = parsed.questions.slice(0, capped).map((q,i) => ({
      id: `ai-${Date.now()}-${i}`,
      question: String(q.question||'').trim().slice(0,300),
      options: Array.isArray(q.options) ? q.options.slice(0,4).map(o=>String(o).trim().slice(0,120)) : [],
      correctAnswer: (typeof q.answer === 'number' && q.answer >=0 && q.answer <4) ? q.answer : 0,
      marks: 1,
      explanation: q.explanation ? String(q.explanation).trim().slice(0,400) : ''
    })).filter(q => q.question && q.options.length === 4);

    return res.status(200).json({ success:true, data:{ questions, difficulty: diff } });
  } catch (error) {
    console.error('AI generate quiz error:', error);
    return res.status(500).json({ success:false, message:'Internal server error' });
  }
};

// Generate a variant of a single question (regenerate or more-like-this)
// Request body: { baseQuestion: { question, options[], correctAnswer }, mode?: 'regenerate'|'more_like_this', difficulty? }
export const generateQuizVariant = async (req, res) => {
  try {
    const { baseQuestion, mode = 'regenerate', difficulty = 'medium' } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success:false, message:'OPENAI_API_KEY not configured on server' });
    }
    if (!baseQuestion || !baseQuestion.question) {
      return res.status(400).json({ success:false, message:'baseQuestion with question text required' });
    }
    const diff = String(difficulty).toLowerCase();
    const variantInstruction = mode === 'more_like_this'
      ? 'Create a new different question that assesses the SAME underlying concept/skill but with a different scenario or framing.'
      : 'Regenerate an improved alternative to the provided question (may adjust focus slightly but keep core concept).';
    const systemMessage = {
      role: 'system',
      content: 'You are an educational MCQ refiner. You generate ONE multiple-choice question (4 options, exactly one correct) based on guidance.'
    };
    const userPrompt = `Original question: ${baseQuestion.question}\nOptions: ${(baseQuestion.options||[]).join(' | ')}\nDifficulty: ${diff}.\nTask: ${variantInstruction}\nReturn STRICT JSON: {"question":"text","options":["A","B","C","D"],"answer":0,"explanation":"short reasoning"}`;
    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [systemMessage, { role:'user', content: userPrompt }],
      temperature: mode === 'more_like_this' ? 0.9 : 0.65,
      max_tokens: 400
    };
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success:false, message:'OpenAI API error', detail: errText.slice(0,400) });
    }
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch(_) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch(_ignore) {} }
    }
    const q = {
      id: `ai-var-${Date.now()}`,
      question: String(parsed.question || '').trim().slice(0,300),
      options: Array.isArray(parsed.options) ? parsed.options.slice(0,4).map(o=>String(o).trim().slice(0,120)) : [],
      correctAnswer: (typeof parsed.answer === 'number' && parsed.answer>=0 && parsed.answer<4) ? parsed.answer : 0,
      marks: 1,
      explanation: parsed.explanation ? String(parsed.explanation).trim().slice(0,400) : ''
    };
    if (!q.question || q.options.length !== 4) {
      return res.status(422).json({ success:false, message:'Failed to parse a valid question variant' });
    }
    return res.status(200).json({ success:true, data:{ question: q, mode, difficulty: diff } });
  } catch (error) {
    console.error('AI generate variant error:', error);
    return res.status(500).json({ success:false, message:'Internal server error' });
  }
};

export default { chatWithAI, generateQuizQuestions, generateQuizVariant };
