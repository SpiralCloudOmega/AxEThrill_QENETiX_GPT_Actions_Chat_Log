export default async function runFrontend({ ask, spec, context }) {
  const prompt = `You are the Frontend agent. Propose the component/file structure and produce small HTML/CSS/JS samples. Prefer clean, accessible UI, no heavy deps. CONTEXT:\n${context}\nINPUT SPEC:\n${spec}`;
  return await ask(prompt);
}
