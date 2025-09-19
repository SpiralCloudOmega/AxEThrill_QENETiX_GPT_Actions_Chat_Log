export default async function runSecurity({ ask, spec, context }) {
  const prompt = `You are the Security agent. Threat model the plan. Call out unsafe file writes, code exec risks, secrets handling, supply-chain, and client risks. Provide concrete mitigations compatible with this repo (local-first, static site). CONTEXT:\n${context}\nINPUT SPEC:\n${spec}`;
  return await ask(prompt);
}
