import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Helper to get AI client lazily
function getAIClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("DEBUG: GEMINI_API_KEY is not defined in process.env");
    return null;
  }
  
  // Log masked key for verification in server logs
  const maskedKey = key.length > 8 
    ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` 
    : "****";
  console.log(`DEBUG: AI Client initialized with key: ${maskedKey} (Length: ${key.length})`);

  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Prediction API - Defined synchronously so it's available immediately
app.post("/api/predict", async (req, res) => {
  const { logs, currentLocation } = req.body;
  const aiClient = getAIClient();
  
  if (!aiClient) {
    return res.status(500).json({ 
      error: "AI configuration missing on server. Please add GEMINI_API_KEY to your env/secrets and REDEPLOY." 
    });
  }

  if (!logs || !Array.isArray(logs)) {
    return res.status(400).json({ error: "Missing logs for prediction" });
  }

  try {
    const prompt = `
      You are an expert analyst of power stability in Nigeria (NEPA/PHCN).
      Based on the following crowdsourced light logs for the area: "${currentLocation?.address || 'Unknown'}",
      predict when the light is likely to return or if it's expected to stay on.
      
      Recent Logs:
      ${JSON.stringify(logs.slice(0, 20), null, 2)}
      
      Provide a concise prediction (max 3 sentences). 
      Include a "confidence" percentage and an "estimatedTime" (e.g., "7:00 PM" or "Unknown").
      Return the result as JSON with keys: "prediction", "confidence", "estimatedTime".
    `;

    console.log(`Generating prediction for: ${currentLocation?.address}`);

    const result = await aiClient.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (!result.text) {
      throw new Error("Empty response from AI model");
    }

    res.json(JSON.parse(result.text));
  } catch (error: any) {
    console.error("Prediction error details:", error);
    
    let errorMessage = "Failed to generate prediction";
    let status = 500;

    if (error.message?.includes("API key expired") || error.message?.includes("API_KEY_INVALID")) {
      errorMessage = "The Gemini API key has expired or is invalid. Please update it in the Settings > Secrets panel (or Vercel Environment Variables).";
      status = 401;
    } else if (error.message?.includes("quota") || error.message?.includes("429")) {
      errorMessage = "Gemini API quota exceeded. Please wait or upgrade to a paid tier.";
      status = 429;
    }

    res.status(status).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export { app };
