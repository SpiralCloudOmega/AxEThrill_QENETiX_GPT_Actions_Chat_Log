export default async function runNetworking({ ask, spec, context }) {
  const prompt = `You are the Networking agent. Describe any local HTTP endpoints, ports, CORS, and client fetch patterns for the static site. Include curl examples. CONTEXT:\n${context}\nINPUT SPEC:\n${spec}`;
  return await ask(prompt);
}
