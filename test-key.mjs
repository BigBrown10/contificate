import { GoogleGenerativeAI } from "@google/generative-ai";

async function run() {
  try {
    const key = process.env.GEMINI_API_KEY || "AIzaSyCs_G6OF-jYdPRHTvYTVRXGuvtWNKxCM7Y";
    console.log("Using API Key starting with:", key.substring(0, 15) + "...");
    
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent("Reply ONLY with the word SUCCESS");
    console.log("API Response:", result.response.text());
  } catch (error) {
    console.error("API Error details:", error.message || error);
    if (error.status) console.error("Status:", error.status);
  }
}

run();
