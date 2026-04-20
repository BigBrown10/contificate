// Test Gemma using the /api/chat endpoint instead
const OLLAMA = "http://localhost:11434/api/chat";

async function main() {
  console.log("[Test] Calling Gemma 4 via /api/chat...");
  const start = Date.now();

  const res = await fetch(OLLAMA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma4:e4b",
      messages: [
        {
          role: "user",
          content: 'Write 4 short TikTok slide hooks about cold showers for a male self-improvement brand. Respond ONLY with a JSON array like: [{"text":"...","role":"hook"},{"text":"...","role":"problem"},{"text":"...","role":"deepen"},{"text":"...","role":"shift"}]'
        }
      ],
      stream: false,
      options: { temperature: 0.7, num_predict: 400 },
    }),
  });

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[Test] Done in ${elapsed}s`);
  console.log(`[Test] Message role:`, data.message?.role);
  console.log(`[Test] Content length:`, data.message?.content?.length);
  console.log(`[Test] Content:`);
  console.log(data.message?.content);
}

main().catch(console.error);
