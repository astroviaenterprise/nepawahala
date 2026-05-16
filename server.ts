import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Prediction API
  app.post("/api/predict", async (req, res) => {
    const { logs, currentLocation } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing in environment");
      return res.status(500).json({ error: "AI configuration missing on server" });
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

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
      res.status(500).json({ 
        error: "Failed to generate prediction",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
