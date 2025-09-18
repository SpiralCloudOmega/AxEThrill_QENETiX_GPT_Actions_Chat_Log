// OpenAI provider adapter
export default {
  name: 'openai',
  async ask({ prompt, model }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    const mdl = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const r = await client.chat.completions.create({
      model: mdl,
      messages: [
        { role: 'system', content: 'You are a concise, accurate assistant.' },
        { role: 'user', content: prompt }
      ]
    });
    const text = r.choices?.[0]?.message?.content || '';
    return text || '(no response)';
  }
};
