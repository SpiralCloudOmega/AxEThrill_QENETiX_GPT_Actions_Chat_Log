export default async function runBackend({ ask, spec, context }) {
  const prompt = `You are the Backend agent. Design minimal endpoints, data shapes, and file IO. Target Node.js scripts under site/scripts and static pages consuming JSON under site/public. CONTEXT:\n${context}\nINPUT SPEC:\n${spec}`;
  return await ask(prompt);
}
