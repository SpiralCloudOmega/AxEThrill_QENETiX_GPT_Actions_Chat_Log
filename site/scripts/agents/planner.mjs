export default async function runPlanner({ ask, spec }) {
  const prompt = `You are the Planner agent. Break the project into phases and tasks with owners (frontend/backend/security/networking), inputs/outputs, and acceptance tests. INPUT SPEC:\n${spec}`;
  return await ask(prompt);
}
