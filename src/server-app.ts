import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

// Lazy initialize Firebase
function getDb() {
  try {
    const app = getApp();
    return getFirestore(app);
  } catch {
    const app = initializeApp(firebaseConfig);
    // Try provided database ID, fallback to default if it looks suspicious or fails
    try {
      if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
        return getFirestore(app, firebaseConfig.firestoreDatabaseId);
      }
    } catch (e) {
      console.warn("Retrying with default database...");
    }
    return getFirestore(app);
  }
}

const modelsToTry = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro'
];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export function registerRoutes(app: any) {
  app.get('/api/feed', async (req: any, res: any) => {
    try {
      const db = getDb();
      const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      const feed = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date()
      }));
      res.json(feed);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'logs');
      res.status(500).json({ error: "Failed to fetch feed" });
    }
  });

  app.post('/api/predict', async (req: any, res: any) => {
    const { location, description, lat, lng, status } = req.body;

    let result = null;
    let errorDetails = [];

    const aiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = aiClient.getGenerativeModel({ model: modelName });
        const response = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `You are an expert power grid analyst for Nigeria. 
              Predict power restoration time for the location: ${location}. 
              User description of the problem: ${description}. 
              Consider common grid issues in Nigeria (GenCo failures, transformer repairs, DisCo specific delays).
              Return JSON with "prediction" (a detailed professional analysis string, max 200 chars) and "estimatedHours" (a realistic number).`
            }]
          }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        });

        const text = response.response.text();
        result = JSON.parse(text);
        console.log(`Success with ${modelName}`);
        break;
      } catch (err: any) {
        console.error(`Error with ${modelName}:`, err.message);
        errorDetails.push({ model: modelName, error: err.message });
      }
    }

    if (!result) {
      // Heuristic Fallback
      result = {
        prediction: "AI analysis timeout. Historically, outages in this region typically resolve within 4-12 hours depending on technician availability.",
        estimatedHours: 8,
        isHeuristic: true
      };
    }

    // Log to Firestore safely
    try {
      const db = getDb();
      await addDoc(collection(db, 'logs'), {
        location,
        description,
        status: status || 'OFF',
        lat: Number(lat),
        lng: Number(lng),
        prediction: result.prediction,
        estimatedHours: result.estimatedHours,
        timestamp: serverTimestamp(),
        usingHeuristic: !!result.isHeuristic,
        errors: errorDetails
      });
    } catch (fsErr: any) {
      handleFirestoreError(fsErr, OperationType.CREATE, 'logs');
    }

    res.json(result);
  });

  app.get('/api/health', (req: any, res: any) => {
    res.json({ status: 'ok' });
  });
}
