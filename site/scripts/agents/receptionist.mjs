export default async function runReceptionist({ ask, spec }) {
  const prompt = `You are the Receptionist agent. Restate the user's goal clearly, list 3-5 clarifying questions, and propose a concise success criteria checklist. INPUT SPEC:\n${spec}`;
  return await ask(prompt);
}
