import React, { useState, useEffect, useMemo } from 'react';
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
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { LightLog, Location, PredictionResult, UserProfile } from './types';
import LocationInput from './components/LocationInput';
import StatusCard from './components/StatusCard';
import LiveFeed from './components/LiveFeed';
import PredictionView from './components/PredictionView';
import { Zap, LogOut, MapPin, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [logs, setLogs] = useState<LightLog[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Authentication and Real-time Profile Sync
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // Initial sync of profile
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            displayName: user.displayName,
            email: user.email,
          }, { merge: true });
          
          // Listen to profile changes live (e.g. from other devices)
          onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data.lastLocation && !currentLocation) {
                setCurrentLocation(data.lastLocation);
              }
            }
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    });
  }, [currentLocation]);

  // Real-time Power Logs Listener
  useEffect(() => {
    // This connects the app to Firebase and listens for any changes in the 'logs' collection.
    // When a new log is added by ANY user, this callback fires automatically.
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LightLog[];
      setLogs(newLogs);
      setIsSynced(true);
      setConnectionError(null);
    }, (error) => {
      setIsSynced(false);
      setConnectionError(error.message);
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    return () => unsubscribe();
  }, []);

  // Handle Prediction
  useEffect(() => {
    if (!currentLocation) return;

    const generatePrediction = async () => {
      setIsPredicting(true);
      try {
        // Filter logs by matching address string
        const relevantLogs = logs.filter(l => 
          l.location.address.toLowerCase().includes(currentLocation.address.toLowerCase()) ||
          currentLocation.address.toLowerCase().includes(l.location.address.toLowerCase())
        );

        const response = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            logs: relevantLogs, 
            currentLocation 
          }),
        });

        const contentType = response.headers.get("content-type");
        if (!response.ok) {
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
          } else {
            const text = await response.text();
            throw new Error(`Server returned non-JSON error (${response.status}): ${text.substring(0, 100)}...`);
          }
        }

        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          throw new Error(`Server returned invalid content type (${contentType}): ${text.substring(0, 100)}...`);
        }

        const data = await response.json();
        setPrediction(data);
      } catch (err: any) {
        console.error("Prediction fetch failed:", err);
        setPrediction({
          prediction: `Analysis unavailable: ${err.message}`,
          confidence: 0,
          estimatedTime: "Unknown"
        });
      } finally {
        setIsPredicting(false);
      }
    };

    const timeoutId = setTimeout(generatePrediction, 1000);
    return () => clearTimeout(timeoutId);
  }, [currentLocation, logs]);

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(false);

  const handleLogin = async () => {
    setLoginError(null);
    setIsAuthChecking(true);
    try {
      const provider = new GoogleAuthProvider();
      console.log("Attempting Google login via popup...");
      // Using popup as it's generally better in this iframe environment
      await signInWithPopup(auth, provider);
      console.log("Login success");
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code === 'auth/popup-blocked') {
        setLoginError("Login popup was blocked. Please check your browser's address bar for a blocked popup icon and allow it.");
      } else if (err.code === 'auth/network-request-failed') {
        setLoginError("Network connection failed. If you have an ad-blocker or VPN, try disabling them for this site.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        setLoginError("Login window was closed before completion.");
      } else {
        setLoginError(err.message || "An unexpected error occurred during login.");
      }
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleNewTabLogin = () => {
    window.open(window.location.href, '_blank');
  };

  const handleReport = async (status: 'on' | 'off') => {
    if (!user || !currentLocation) {
      alert("Please enter your area first!");
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
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { lastLocation: currentLocation }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'logs');
    } finally {
      setIsReporting(false);
    }
  };

  const handleLocationSubmit = (address: string) => {
    setCurrentLocation({
      address,
      placeId: address.toLowerCase().replace(/\s+/g, '-'), // dummy ID for grouping
      lat: 0,
      lng: 0
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Zap className="w-12 h-12 text-orange-500 animate-bounce" />
          <p className="mt-4 text-orange-900 font-medium tracking-tight">Initializing NepaWahala...</p>
          {connectionError && (
            <div className="mt-8 max-w-md p-6 bg-white border-[4px] border-black brutal-shadow">
              <h3 className="text-red-600 font-black uppercase italic mb-2">Network Issue Detected</h3>
              <p className="text-xs text-gray-600 font-bold leading-tight">
                {connectionError}
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 w-full py-2 bg-black text-white text-xs font-black uppercase tracking-widest hover:bg-gray-800"
              >
                Retry Connection
              </button>
            </div>
          )}
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
            NepaWahala <span className="text-orange-500">Nigeria</span>
          </h1>
          <p className="text-lg text-gray-600 mb-10 leading-relaxed">
            Join thousands of Nigerians tracking power outages. Get live updates and AI-powered predictions for your area.
          </p>
          <button 
            onClick={handleLogin}
            disabled={isAuthChecking}
            className="w-full bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-2xl transition-all hover:scale-[1.02] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait"
          >
            {isAuthChecking ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Signing in...
              </span>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
                Continue with Google
              </>
            )}
          </button>
          
          {loginError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium text-left"
            >
              <p className="font-bold mb-1">Login Issue</p>
              <p className="text-xs">{loginError}</p>
              
              <div className="mt-4 p-3 bg-white border border-red-100 rounded-lg">
                <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">Pro Tip</p>
                <p className="text-xs text-gray-600 mb-3">If popups aren't working in this window, try opening the app in a new tab.</p>
                <button 
                  onClick={handleNewTabLogin}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-orange-600 hover:text-orange-700"
                >
                  Open in New Tab
                </button>
              </div>

              <button 
                onClick={() => setLoginError(null)}
                className="block mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 underline"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          <p className="mt-8 text-xs text-gray-400 font-medium uppercase tracking-widest">
            PHCN no go see you fall
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-400 p-0 sm:p-4">
      <div className="max-w-[1200px] mx-auto bg-white min-h-[calc(100vh-2rem)] flex flex-col border-[8px] sm:border-[12px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        {/* Header */}
        <header className="border-b-[6px] border-black p-4 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-7xl font-black tracking-tighter uppercase italic leading-none">NEPAWAHALA</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Power Tracking Infrastructure</p>
          </div>
          
            <div className="flex items-center gap-4 border-t-2 sm:border-t-0 sm:border-l-4 border-black pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
            <div className="flex items-center gap-2 mr-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isSynced ? "bg-green-500 animate-pulse" : "bg-red-500"
              )} />
              <span className="text-[8px] font-black uppercase text-gray-400">
                {isSynced ? "Live" : "Offline"}
              </span>
            </div>
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
                <LocationInput 
                  onLocationSubmit={handleLocationSubmit}
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
                    {currentLocation.address}
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
            NEPAWAHALA © 2026 / DATA CROWDSOURCED
          </p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
            <span className="text-[10px] font-black uppercase">Astrovia Enterprise</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
