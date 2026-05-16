import React, { useState, useEffect, useMemo } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { LightLog, Location, PredictionResult, UserProfile } from './types';
import PlaceAutocomplete from './components/PlaceAutocomplete';
import StatusCard from './components/StatusCard';
import LiveFeed from './components/LiveFeed';
import PredictionView from './components/PredictionView';
import { Zap, LogOut, ShieldAlert, MapPin, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

const MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [logs, setLogs] = useState<LightLog[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  // Authentication
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // Sync user profile
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          displayName: user.displayName,
          email: user.email,
        }, { merge: true });
      }
    });
  }, []);

  // Listen for logs
  useEffect(() => {
    let q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
    
    // Filter by location if selected
    if (currentLocation) {
       // We can't easily filter by "near" in logic-less Firestore without Geohashes, 
       // but we'll filter by city/placeId for now or just show global then filter client-side
       // For this MVP, let's just show recent logs globally and maybe refine later.
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LightLog[];
      setLogs(newLogs);
    });

    return () => unsubscribe();
  }, [currentLocation]);

  // Handle Prediction
  useEffect(() => {
    if (!currentLocation || logs.length === 0) return;

    const generatePrediction = async () => {
      setIsPredicting(true);
      try {
        const relevantLogs = logs.filter(l => 
          l.location.placeId === currentLocation.placeId
        );

        const response = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            logs: relevantLogs, 
            currentLocation 
          }),
        });
        const data = await response.json();
        setPrediction(data);
      } catch (err) {
        console.error("Prediction fetch failed", err);
      } finally {
        setIsPredicting(false);
      }
    };

    const timeoutId = setTimeout(generatePrediction, 1000);
    return () => clearTimeout(timeoutId);
  }, [currentLocation, logs]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReport = async (status: 'on' | 'off') => {
    if (!user || !currentLocation) {
      alert("Please select a location first!");
      return;
    }

    setIsReporting(true);
    try {
      await addDoc(collection(db, 'logs'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        status,
        location: currentLocation,
        timestamp: serverTimestamp()
      });
      
      // Update user's last location
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { lastLocation: currentLocation }, { merge: true });

    } catch (err) {
      console.error("Failed to report", err);
    } finally {
      setIsReporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Zap className="w-12 h-12 text-orange-500 animate-bounce" />
          <p className="mt-4 text-orange-900 font-medium tracking-tight">Initializing LightWatch...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-200 rounded-full blur-[100px] opacity-30" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-200 rounded-full blur-[100px] opacity-30" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center relative z-10"
        >
          <div className="mb-8 inline-block p-4 bg-orange-100 rounded-3xl">
            <Zap className="w-12 h-12 text-orange-600 fill-orange-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-none mb-6">
            LightWatch <span className="text-orange-500">Nigeria</span>
          </h1>
          <p className="text-lg text-gray-600 mb-10 leading-relaxed">
            Join thousands of Nigerians tracking power outages. Get live updates and AI-powered predictions for your area.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-2xl transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
            Continue with Google
          </button>
          <p className="mt-8 text-xs text-gray-400 font-medium uppercase tracking-widest">
            PHCN no go see you fall
          </p>
        </motion.div>
      </div>
    );
  }

  if (!MAPS_API_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center border border-red-100">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">API Key Required</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Please add <code>GOOGLE_MAPS_PLATFORM_KEY</code> to your secrets in AI Studio to enable location services.
          </p>
          <div className="text-left bg-gray-50 p-4 rounded-xl text-sm font-mono text-gray-700">
            1. Open Settings (⚙️ icon)<br />
            2. Go to Secrets<br />
            3. Add GOOGLE_MAPS_PLATFORM_KEY
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY} version="weekly">
      <div className="min-h-screen bg-yellow-400 p-0 sm:p-4">
        <div className="max-w-[1200px] mx-auto bg-white min-h-[calc(100vh-2rem)] flex flex-col border-[8px] sm:border-[12px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          {/* Header */}
          <header className="border-b-[6px] border-black p-4 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-7xl font-black tracking-tighter uppercase italic leading-none">GRIDWATCH.NG</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Power Tracking Infrastructure</p>
            </div>
            
            <div className="flex items-center gap-4 border-t-2 sm:border-t-0 sm:border-l-4 border-black pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
              <div className="flex flex-col items-start sm:items-end flex-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Contributor</span>
                <span className="text-lg font-black uppercase italic truncate max-w-[150px]">{user.displayName}</span>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-12 h-12 border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col lg:flex-row">
            {/* Left Column: Input & Prediction */}
            <div className="flex-1 border-b-[6px] lg:border-b-0 lg:border-r-[6px] border-black p-4 sm:p-10 space-y-10">
              <section className="space-y-4">
                <div className="inline-block bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                  Location Selection
                </div>
                <h2 className="text-4xl font-black uppercase italic leading-none">Where are you?</h2>
                <div className="pt-2">
                  <PlaceAutocomplete 
                    onPlaceSelect={(p) => {
                      if (p.geometry?.location) {
                        setCurrentLocation({
                          address: p.formatted_address || '',
                          placeId: p.place_id || '',
                          lat: p.geometry.location.lat(),
                          lng: p.geometry.location.lng()
                        });
                      }
                    }}
                    defaultValue={currentLocation?.address}
                  />
                </div>
              </section>

              <div className="grid grid-cols-1 gap-10">
                <StatusCard 
                  onReport={handleReport} 
                  isLoading={isReporting} 
                />

                <PredictionView 
                  prediction={prediction} 
                  isLoading={isPredicting} 
                />
              </div>

              {/* Local Stats Section */}
              {currentLocation && (
                <div className="grid grid-cols-1 sm:grid-cols-2 border-4 border-black">
                  <div className="p-6 border-b-4 sm:border-b-0 sm:border-r-4 border-black bg-yellow-50">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Global reports</p>
                    <p className="text-5xl font-black italic">{logs.length}</p>
                  </div>
                  <div className="p-6 bg-white">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Target Area</p>
                    <p className="text-xl font-black uppercase italic truncate">
                      {currentLocation.address.split(',')[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Feed */}
            <aside className="w-full lg:w-[400px] bg-gray-50 flex flex-col h-[600px] lg:h-auto">
              <div className="p-4 border-b-4 border-black bg-black flex items-center justify-between">
                <span className="text-xs font-black uppercase text-yellow-400 tracking-widest">Live Community Feed</span>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LiveFeed logs={logs} />
              </div>
            </aside>
          </main>

          <footer className="border-t-[6px] border-black p-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              LIGHTWATCH © 2026 / DATA CROWDSOURCED
            </p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
              <span className="text-[10px] font-black uppercase">System Health: Optimal</span>
            </div>
          </footer>
        </div>
      </div>
    </APIProvider>
  );
}
