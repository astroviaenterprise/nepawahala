import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

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
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prediction: {
              type: Type.STRING,
              description: "A concise prediction about light return or stability."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence percentage (0-100)."
            },
            estimatedTime: {
              type: Type.STRING,
              description: "Estimated time of light return or 'Stable'."
            }
          },
          required: ["prediction", "confidence", "estimatedTime"]
        }
      }
    });

    if (!result.text) {
      console.error("AI response has no text content:", JSON.stringify(result));
      throw new Error("Empty response from AI model");
    }

    let parsedContent;
    try {
      // Clean up markdown if present, though responseMimeType should prevent it
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedContent = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("JSON parse error for AI response:", result.text);
      throw new Error("Failed to parse AI response as JSON");
    }

    res.json(parsedContent);
  } catch (error: any) {
    console.error("Prediction error details:", error);
    
    let errorMessage = "Failed to generate prediction";
    let status = 500;

    // Enhanced error detection for Gemini API
    const message = error.message || String(error);
    const errorStatus = error.status || (error.response?.status);

    if (message.includes("API key expired") || message.includes("API_KEY_INVALID") || errorStatus === 401 || (errorStatus === 400 && message.includes("API key"))) {
      errorMessage = "The Gemini API key is reported as EXPIRED or INVALID. Please go to Settings > Secrets in AI Studio and generate/update your GEMINI_API_KEY.";
      status = 401;
    } else if (message.includes("quota") || errorStatus === 429 || message.includes("429")) {
      errorMessage = "Gemini API quota exceeded. Please wait or upgrade to a paid tier in the Google AI Studio settings.";
      status = 429;
    } else if (message.includes("not found") || errorStatus === 404) {
      errorMessage = "The selected Gemini model was not found. We have reverted to 'gemini-flash-latest'. Please redeploy.";
      status = 404;
    } else if (message.includes("safety") || message.includes("block")) {
      errorMessage = "The AI model blocked the request due to safety concerns. Please refine your input.";
      status = 400;
    }

    res.status(status).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? message : undefined
    });
  }
});

// Catch-all for undefined API routes to prevent falling through to SPA HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

export { app };
