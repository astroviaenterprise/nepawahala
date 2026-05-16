import path from "path";
import { createServer as createViteServer } from "vite";
import { app } from "./src/app.js";

async function startServer() {
  const PORT = 3000;

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
      // Handle favicon or other static assets that might be requested
      if (req.path.includes('.')) {
         return res.status(404).end();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only start the server if we're not in a serverless environment (like Vercel)
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
