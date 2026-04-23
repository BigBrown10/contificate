const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const key = process.env.GEMINI_API_KEY || "AIzaSyCs_G6OF-jYdPRHTvYTVRXGuvtWNKxCM7Y";
  const genAI = new GoogleGenerativeAI(key);

  try {
    const fetch = globalThis.fetch;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    console.log("Available models:");
    data.models.forEach(m => console.log(m.name, m.supportedGenerationMethods));
  } catch (err) {
    console.error("Failed:", err);
  }
}

listModels();
