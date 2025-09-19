// Gemini provider adapter
export default {
  name: 'gemini',
  async ask({ prompt, model }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const mdl = model || process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
    // Lazy import to keep optional dep
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model: mdl });
    const r = await genModel.generateContent(prompt);
    const text = r.response?.text?.() || r.response?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n') || '';
    return text || '(no response)';
  }
};
