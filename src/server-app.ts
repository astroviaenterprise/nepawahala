import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
try {
  dotenv.config();
} catch (e) {
  // Ignore in production
}

const app = express();
app.use(express.json());

// Request logger with more detail
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Headers: ${JSON.stringify(req.headers['user-agent'])}`);
  next();
});

// Health check / Ping
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    time: new Date().toISOString(),
    env: {
      hasApiKey: !!process.env.GEMINI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      keyLength: process.env.GEMINI_API_KEY?.length || 0
    }
  });
});

app.get("/api/ping", (req, res) => {
  res.send("pong");
});

// Helper to get AI client lazily
function getAIClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is not defined in process.env");
    return null;
  }
  
  // Log masked key for verification in server logs (safe because it's only 8 chars visible)
  const maskedKey = key.length > 8 
    ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` 
    : "****";
  console.log(`DEBUG: AI Client initializing with key: ${maskedKey}`);

  try {
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } catch (err) {
    console.error("AI Client initialization failed:", err);
    return null;
  }
}

// Prediction API
const handlePredict = async (req, res: express.Response) => {
  console.log("DEBUG: Received predict request");
  const { logs, currentLocation } = req.body;
  
  try {
    const aiClient = getAIClient();
    
    if (!aiClient) {
      console.error("DEBUG: No AI client available");
      return res.status(500).json({ 
        error: "AI configuration missing on server. Please add GEMINI_API_KEY to your env/secrets and REDEPLOY." 
      });
    }

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: "Missing logs for prediction" });
    }

    const prompt = `
      You are an expert analyst of power stability in Nigeria (NEPA/PHCN).
      Based on the following crowdsourced light logs for the area: "${currentLocation?.address || 'Unknown'}",
      predict when the light is likely to return or if it's expected to stay on.
      
      Recent Logs:
      ${JSON.stringify(logs.slice(0, 20), null, 2)}
      
      Provide a concise prediction (max 3 sentences). 
      Include a "confidence" percentage (0-100) and an "estimatedTime" (e.g., "7:00 PM", "Stable", or "Unknown").
      Return the result as JSON with keys: "prediction", "confidence", "estimatedTime".
    `;

    const modelsToTry = [
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
      "gemini-2.0-flash",
      "gemini-flash-latest"
    ];
    
    let result;
    let lastError;

    for (const modelName of modelsToTry) {
      try {
        console.log(`DEBUG: Attempting prediction with model: ${modelName}`);
        
        // Log available models once to help debugging safely
        if (modelName === modelsToTry[0]) {
          try {
            const modelsResponse = await aiClient.models.list();
            if (modelsResponse && Array.isArray(modelsResponse)) {
               console.log("DEBUG: Available models count:", modelsResponse.length);
            }
          } catch (listErr) {
            console.error("DEBUG: Failed to list models:", listErr);
          }
        }

        result = await aiClient.models.generateContent({
          model: modelName, 
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
        
        if (result && result.text) {
          console.log(`DEBUG: Successfully generated prediction with model: ${modelName}`);
          break; // Success!
        }
      } catch (err: any) {
        console.error(`DEBUG: Model ${modelName} failed:`, err.message || err);
        lastError = err;
        // Proceed to next model in loop
      }
    }

    if (!result || !result.text) {
      console.error("AI: All prediction models failed.");
      throw lastError || new Error("All AI models failed to generate content");
    }

    if (!result || !result.text) {
      console.error("AI response has no text content. Result:", JSON.stringify(result));
      throw new Error("Empty response from AI model");
    }

    let parsedContent;
    try {
      // Clean up markdown if present, though responseMimeType should prevent it
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedContent = JSON.parse(cleanJson);
      console.log("DEBUG: AI Generation successful");
    } catch (parseError) {
      console.error("JSON parse error for AI response. Raw text:", result.text);
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
      errorMessage = "The Gemini API key is reported as EXPIRED or INVALID. Please check your GEMINI_API_KEY setting.";
      status = 401;
    } else if (message.includes("quota") || errorStatus === 429 || message.includes("429")) {
      errorMessage = "Gemini API quota exceeded. Please wait or upgrade your tier.";
      status = 429;
    } else if (message.includes("not found") || errorStatus === 404) {
      errorMessage = "The selected Gemini model was not found. Please check model availability.";
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
};

app.post("/api/predict", handlePredict);
app.post("/predict", handlePredict);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("GLOBAL SERVER ERROR:", err);
  res.status(500).json({ 
    error: "A critical server error occurred",
    details: process.env.NODE_ENV === 'development' ? err.message : "Internal Server Error"
  });
});

// Catch-all for undefined API routes
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

export { app };
