// Vercel serverless function: put this at /api/index.js in your project.
// Set ANTHROPIC_API_KEY in your project's Environment Variables.

async function claude(system, content, maxTokens = 1500) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'AI request failed');
  const text = j.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });

  const { action, image, mode, notes } = req.body || {};

  try {
    if (action === 'explain') {
      if (!image) return res.status(400).json({ error: 'No image received' });
      const kid = mode === 'kid';
      const system = kid
        ? 'You are AISHA, a friendly tutor for young children. Read the book page in the photo and explain it with very simple words and short sentences. Also make a tiny story of 4-6 scenes about it. Reply with ONLY JSON: {"title":string,"explanation":string,"scenes":[{"emoji":"one emoji","line":"one short sentence"}]}'
        : 'You are AISHA, a clear and encouraging tutor. Read the book page in the photo and explain the topic step by step so a student can understand it. Reply with ONLY JSON: {"title":string,"explanation":string,"scenes":[]}';
      const out = await claude(system, [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
        { type: 'text', text: 'Explain this page.' },
      ]);
      return res.json({ snap: { title: out.title, explanation: out.explanation, scenes: kid ? out.scenes || [] : [], mode: kid ? 'kid' : 'student', created_at: new Date().toISOString() } });
    }

    if (action === 'quiz') {
      if (!notes || !notes.length) return res.status(400).json({ error: 'Snap a page first, then I can quiz you!' });
      const out = await claude(
        'Make 5 multiple-choice questions from the study notes. Reply with ONLY JSON: {"questions":[{"q":string,"options":[4 strings],"answer":index 0-3,"why":"short explanation"}]}',
        notes.join('\n\n')
      );
      return res.json({ questions: out.questions });
    }

    return res.status(501).json({ error: 'Accounts are not set up yet. Use "Get Started Free" instead.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
