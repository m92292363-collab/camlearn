// Vercel serverless function: /api/index.js
// Env var needed: GEMINI_API_KEY (free from aistudio.google.com/apikey)

const MODEL = 'gemini-flash-latest';

async function gemini(system, parts) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'AI request failed');
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error('The AI sent back nothing. Try a clearer photo.');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });

  const { action, image, mode, notes } = req.body || {};

  try {
    if (action === 'explain') {
      if (!image) return res.status(400).json({ error: 'No image received' });
      const kid = mode === 'kid';
      const system = kid
        ? 'You are AISHA, a friendly tutor for young children. Read the book page in the photo and explain it with very simple words and short sentences. Also make a tiny story of 4-6 scenes about it. Reply with ONLY JSON: {"title":string,"explanation":string,"scenes":[{"emoji":"one emoji","line":"one short sentence"}]}'
        : 'You are AISHA, a clear and encouraging tutor. Read the book page in the photo and explain the topic step by step so a student can understand it. Reply with ONLY JSON: {"title":string,"explanation":string,"scenes":[]}';
      const out = await gemini(system, [
        { inline_data: { mime_type: 'image/jpeg', data: image } },
        { text: 'Explain this page.' },
      ]);
      return res.json({ snap: { title: out.title, explanation: out.explanation, scenes: kid ? out.scenes || [] : [], mode: kid ? 'kid' : 'student', created_at: new Date().toISOString() } });
    }

    if (action === 'quiz') {
      if (!notes || !notes.length) return res.status(400).json({ error: 'Snap a page first, then I can quiz you!' });
      const out = await gemini(
        'Make 5 multiple-choice questions from the study notes. Reply with ONLY JSON: {"questions":[{"q":string,"options":[4 strings],"answer":index 0-3,"why":"short explanation"}]}',
        [{ text: notes.join('\n\n') }]
      );
      return res.json({ questions: out.questions });
    }

    return res.status(501).json({ error: 'Accounts are not set up yet. Use "Get Started Free" instead.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
