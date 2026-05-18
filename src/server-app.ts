import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
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
  
  // Log masked key for verification (safe because it's only a hint)
  const maskedKey = key.length > 8 
    ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` 
    : "****";
  console.log(`DEBUG: AI Client initializing with key hint: ${maskedKey}`);

  try {
    return new GoogleGenAI({
      apiKey: key,
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
        error: "AI configuration missing on server. Please add GEMINI_API_KEY to your Vercel Environment Variables." 
      });
    }

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: "Missing logs for prediction" });
    }

    const prompt = `
      You are an expert analyst of power stability in Nigeria.
      Based on the following crowdsourced light logs for the area: "${currentLocation?.address || 'Unknown'}",
      predict when the light is likely to return or if it's expected to stay on.
      
      Recent Logs:
      ${JSON.stringify(logs.slice(0, 20), null, 2)}
      
      Provide a concise prediction (max 3 sentences). 
      Include a "confidence" percentage (0-100) and an "estimatedTime" (e.g., "7:00 PM", "Stable", or "Unknown").
      Return the result as JSON with keys: "prediction", "confidence", "estimatedTime".
    `;

    // HEURISTIC ENGINE (Fallback when AI fails)
    const getHeuristicPrediction = (logs: any[]) => {
      console.log("DEBUG: Running heuristic fallback prediction");
      const recent = logs.slice(0, 10);
      const isCurrentlyOn = recent[0]?.status === 'on';
      
      if (recent.length < 3) {
        return {
          prediction: "Insufficient data for a precise prediction. Power appears " + (isCurrentlyOn ? "unstable." : "to be out."),
          confidence: 30,
          estimatedTime: "Unknown"
        };
      }

      // Simple pattern detection
      const totalOn = recent.filter(l => l.status === 'on').length;
      const ratio = totalOn / recent.length;
      
      let prediction = "";
      let confidence = ratio * 100;
      let estimatedTime = "Unknown";

      if (isCurrentlyOn) {
        prediction = ratio > 0.8 
          ? "Power is currently stable. High probability it stays on for the next few hours." 
          : "Power is back but has been fluctuating recently. Expect possible interruptions.";
        estimatedTime = "Stable";
      } else {
        prediction = "Power is currently out. Based on recent activity, light usually returns after a few hours of downtime.";
        // Guessing based on common Nigerian patterns if not specified
        confidence = 50;
      }

      return { prediction, confidence: Math.round(confidence), estimatedTime };
    };

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
      "gemini-2.0-flash-exp"
    ];
    
    let resultText = "";
    let lastError;

    // TRY GEMINI
    if (aiClient) {
      for (const modelName of modelsToTry) {
        try {
          console.log(`DEBUG: Trying Gemini model: ${modelName}`);
          const model = aiClient.getGenerativeModel({ model: modelName });
          const generation = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          });
          
          const text = generation.response.text();
          if (text) {
            resultText = text;
            console.log(`DEBUG: Success with Gemini: ${modelName}`);
            break; 
          }
        } catch (err: any) {
          console.error(`DEBUG: Gemini ${modelName} failed:`, (err.message || "").substring(0, 100));
          lastError = err;
        }
      }
    }

    // FALLBACK TO HEURISTIC IF ALL AI FAILED
    let parsedContent;
    if (!resultText) {
      console.warn("AI Fallbacks failed. Using Heuristic Engine.");
      parsedContent = getHeuristicPrediction(logs);
    } else {
      try {
        const cleanJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedContent = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error("JSON parse error:", resultText);
        parsedContent = getHeuristicPrediction(logs);
      }
    }

    res.json(parsedContent);
  } catch (error: any) {
    console.error("CATCH ALL Prediction error:", error);
    
    let errorMessage = "Prediction service unavailable";
    let status = 500;

    const message = error.message || String(error);
    const errorStatus = error.status || (error.response?.status);

    if (message.includes("API key") || errorStatus === 401) {
      errorMessage = "Gemini API key is invalid or missing.";
      status = 401;
    } else if (message.includes("quota") || errorStatus === 429) {
      errorMessage = "Gemini quota exceeded. Please try again in 1 minute.";
      status = 429;
    } else if (message.includes("not found") || errorStatus === 404) {
      errorMessage = "AI model not found. Check if your API key has access to standard models.";
      status = 404;
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
