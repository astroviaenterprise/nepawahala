import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Power, 
  Zap, 
  Clock, 
  AlertTriangle, 
  Activity, 
  ShieldCheck, 
  ChevronRight,
  Info,
  Menu,
  X,
  MapPin,
  TrendingUp,
  BarChart3,
  Network
} from 'lucide-react';
import AddressSearch from './components/AddressSearch';
import { cn } from './lib/utils';
import { subscribeToLogs } from './lib/firebase';

interface Prediction {
  prediction: string;
  estimatedHours: number;
  isHeuristic?: boolean;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ON' | 'OFF'>('OFF');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [feed, setFeed] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<'CONNECTING' | 'CONNECTED' | 'ERROR'>('CONNECTING');
  const [mapsError, setMapsError] = useState<string | null>(null);

  useEffect(() => {
    // Detect Maps Billing/API errors via custom event from index.html
    const handleMapsFailure = () => {
      setMapsError("BillingNotEnabledMapError");
    };
    window.addEventListener('maps-auth-failure', handleMapsFailure);
    
    // Fallback detection in case event was missed or browser behavior varies
    (window as any).gm_authFailure = handleMapsFailure;
    
    const unsubscribe = subscribeToLogs(setFeed, setSyncStatus);
    return () => {
      window.removeEventListener('maps-auth-failure', handleMapsFailure);
      unsubscribe();
    };
  }, []);

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    const locationStr = typeof selectedPlace === 'string' 
      ? selectedPlace 
      : (selectedPlace as google.maps.places.PlaceResult)?.formatted_address;
    
    if (!locationStr && !description) return;

    setLoading(true);
    setPrediction(null);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          location: locationStr, 
          description,
          status,
          lat: typeof selectedPlace?.geometry?.location?.lat === 'function' ? selectedPlace.geometry.location.lat() : 6.5244,
          lng: typeof selectedPlace?.geometry?.location?.lng === 'function' ? selectedPlace.geometry.location.lng() : 3.3792
        }),
      });
      const data = await res.json();
      setPrediction(data);
      if (!data.logSuccessful) {
        console.warn("Prediction generated but failed to sync to live nodes.");
      }
    } catch (err) {
      console.error('Prediction failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const feedMarkers = feed
    .filter(item => {
      if (!item) return false;
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      return !isNaN(lat) && !isNaN(lng);
    })
    .map(item => ({
      id: item.id,
      position: { lat: Number(item.lat), lng: Number(item.lng) },
      title: typeof item.location === 'object' ? (item.location.address || item.location.formatted_address || 'Reported Outage') : (item.location || 'Reported Outage')
    }));

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden grid-bg">
      {/* Sidebar - Control Panel */}
      <aside 
        className={cn(
          "bg-zinc-950/90 backdrop-blur-3xl border-r border-zinc-800 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-30 shadow-[40px_0_100px_rgba(0,0,0,0.8)] lg:shadow-none",
          isSidebarOpen ? "w-full lg:w-[440px]" : "w-0 lg:w-0"
        )}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-amber-500/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full" />
        </div>
        {/* Header */}
        <div className="p-8 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 p-2.5 rounded-xl amber-glow relative overflow-hidden group">
               <Zap className="text-zinc-950 w-5 h-5 fill-current relative z-10" />
               <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">Nepa Wahala</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="tech-label text-emerald-500">Grid Monitor</span>
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Maps Billing Alert */}
        <AnimatePresence>
          {mapsError === 'BillingNotEnabledMapError' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500/10 border-b border-red-500/20 px-8 py-3"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-tight">
                  Maps Billing Required: <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-300">Enable Billing</a> to activate full geolocation.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Content */}
        <div className="flex-grow overflow-y-auto p-8 space-y-10 custom-scrollbar relative z-10">
          {/* Diagnostic Form Area */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="tech-label">Reporting Node</h2>
              <span className="text-[10px] font-mono text-zinc-500">INPUT-01</span>
            </div>
            
            <form onSubmit={handlePredict} className="space-y-6">
              <div className="space-y-3">
                <label className="tech-label text-zinc-400">Current State</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('ON')}
                    className={cn(
                      "flex items-center justify-center gap-3 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border-2",
                      status === 'ON' 
                        ? "bg-emerald-500 border-emerald-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
                        : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <Power className={cn("w-3.5 h-3.5", status === 'ON' && "fill-current")} />
                    On
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('OFF')}
                    className={cn(
                      "flex items-center justify-center gap-3 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border-2",
                      status === 'OFF' 
                        ? "bg-red-500 border-red-500 text-zinc-950 shadow-[0_0_20px_rgba(239,68,68,0.3)]" 
                        : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <AlertTriangle className={cn("w-3.5 h-3.5", status === 'OFF' && "fill-current")} />
                    Off
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="tech-label text-zinc-400">Location Identification</label>
                <AddressSearch 
                  onPlaceSelect={setSelectedPlace}
                  placeholder="GEO-COORDINATES OR STREET..."
                  error={mapsError}
                  onManualEntry={(val) => setSelectedPlace(val as any)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="tech-label text-zinc-400">Issue / Maintenance Logs</label>
                  <span className="text-[8px] font-mono text-zinc-400 uppercase">Context for Prediction AI</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Transformer sparking, 3-phase line drop, regular loadshedding..."
                  className="w-full px-4 py-4 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all min-h-[100px] text-xs font-mono placeholder:text-zinc-500 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || (!selectedPlace && !description)}
                className={cn(
                  "w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98]",
                  loading 
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                    : "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-500/10"
                )}
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {loading ? 'ANALYZING...' : 'PREDICT RESOLUTION'}
              </button>
            </form>
          </section>

          {/* Prediction Result */}
          <AnimatePresence>
            {prediction && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="hardware-card p-6 bg-amber-500/5 border-amber-500/20"
              >
                <div className="flex items-center gap-2 tech-label text-amber-500 mb-4">
                  <Activity className="w-3 h-3" /> Analysis Result
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-black text-white font-mono">{prediction.estimatedHours}</span>
                  <span className="text-[10px] text-zinc-300 uppercase font-mono">Hours estimated restoration</span>
                </div>
                <p className="text-[11px] text-zinc-300 font-mono italic leading-relaxed bg-zinc-950/50 p-3 rounded-lg border border-zinc-900">
                  "{prediction.prediction}"
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* System Status Info */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Network Stability</span>
                <span className="text-[10px] font-mono text-emerald-500">98.2%</span>
             </div>
             <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[98.2%] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
             </div>
             <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[8px] text-zinc-400 uppercase mb-1">Active Nodes</div>
                  <div className="text-xs font-mono text-zinc-100">1,242</div>
                </div>
                <div>
                  <div className="text-[8px] text-zinc-400 uppercase mb-1">Reports/hr</div>
                  <div className="text-xs font-mono text-zinc-100">42</div>
                </div>
             </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-8 border-t border-zinc-800/50 bg-[#0C0C0E]">
           <p className="text-[9px] text-zinc-400 font-mono italic">
             Grid synchronization module v1.0.4. Critical reporting only.
           </p>
        </div>
      </aside>

      {/* Main Content - Live Monitoring Dashboard */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl px-12 flex items-center justify-between z-20">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-xs font-black text-white italic tracking-tighter uppercase italic leading-none">Global Awareness</span>
              <span className="text-[9px] text-amber-500 font-mono font-bold uppercase tracking-[0.2em] mt-1">Real-time Telemetry</span>
            </div>
            <div className="h-8 w-px bg-zinc-800 lg:block hidden" />
            <div className="lg:flex hidden items-center gap-6">
               <div className="flex flex-col">
                  <span className="text-[8px] text-zinc-400 uppercase font-mono">Sync Latency</span>
                  <span className="text-[10px] text-zinc-200 font-mono">14ms</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] text-zinc-400 uppercase font-mono">Uptime</span>
                  <span className="text-[10px] text-emerald-400 font-mono">99.99%</span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest font-bold">Grid Live</span>
             </div>
          </div>
        </header>

        {/* Dashboard Area */}
        <div className="flex-grow relative overflow-y-auto custom-scrollbar p-12 lg:p-20 z-10">
          <div className="max-w-5xl mx-auto space-y-20">
            {/* Hero Stats */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'Outages Detected', value: feed.filter(f => f.status === 'OFF').length, icon: AlertTriangle, color: 'text-red-500' },
                { label: 'Grid Restored', value: feed.filter(f => f.status === 'ON').length, icon: Zap, color: 'text-emerald-500' },
                { label: 'Avg Restore Time', value: '4.2h', icon: Clock, color: 'text-amber-500' }
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label}
                  className="hardware-card p-8 bg-zinc-900/20 flex items-center justify-between group hover:border-zinc-700 transition-all"
                >
                  <div>
                    <h3 className="tech-label mb-2">{stat.label}</h3>
                    <div className="text-4xl font-black text-white font-mono">{stat.value}</div>
                  </div>
                  <stat.icon className={cn("w-8 h-8 opacity-20 group-hover:opacity-100 transition-opacity", stat.color)} />
                </motion.div>
              ))}
            </section>

            {/* Feed Section */}
            <section className="space-y-8">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
                <div className="flex items-center gap-4">
                  <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-700">
                    <Activity className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Live Activity Stream</h2>
                    <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest mt-1">Cross-referencing verified crowdsourced data</p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900 border border-zinc-700">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      syncStatus === 'CONNECTED' ? "bg-emerald-500" : syncStatus === 'CONNECTING' ? "bg-amber-500" : "bg-red-500"
                    )} />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                      {syncStatus}
                    </span>
                  </div>
                  <div className="px-3 py-1 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-zinc-400 whitespace-nowrap">SORT: RECENT</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {feed.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-20 text-center border-2 border-dashed border-zinc-900 rounded-3xl"
                    >
                      <Network className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                      <p className="tech-label !text-zinc-700">No active reports in current sector</p>
                    </motion.div>
                  ) : (
                    feed.map((item, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.05, 0.5) }}
                        key={item.id}
                        className="group relative"
                      >
                        <div className="hardware-card p-6 bg-zinc-900/10 hover:bg-zinc-900/30 transition-all border-zinc-800/40 hover:border-zinc-700 flex flex-col md:flex-row md:items-center gap-6">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0",
                            item.status === 'ON' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                          )}>
                            {item.status === 'ON' ? <Zap className="w-6 h-6 fill-current" /> : <Power className="w-6 h-6" />}
                          </div>
                          
                          <div className="flex-grow">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border",
                                item.status === 'ON' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : "bg-red-500/5 border-red-500/20 text-red-500"
                              )}>
                                {item.status === 'ON' ? 'Grid UP' : 'Grid DOWN'}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                {new Date(item.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white uppercase tracking-tight mb-1">
                              {typeof item.location === 'object' ? (item.location.address || item.location.formatted_address || 'Substation Node') : (item.location || 'Substation Node')}
                            </h4>
                            <p className="text-xs text-zinc-300 font-mono italic leading-relaxed line-clamp-1">
                              "{item.description}"
                            </p>
                          </div>

                          <div className="flex items-center gap-6 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-zinc-700/50 md:pl-8">
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] text-zinc-400 uppercase font-mono mb-1">Impact</span>
                              <span className="text-xs font-bold text-zinc-200">High</span>
                            </div>
                            <button className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>

        {/* Ambient Background Visuals */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 right-0 w-[60%] h-[60%] bg-amber-500/5 blur-[160px] rounded-full" />
          <div className="absolute bottom-1/4 left-1/4 w-[40%] h-[40%] bg-emerald-500/5 blur-[160px] rounded-full" />
          <div className="absolute inset-0 opacity-[0.02] grid-bg" />
        </div>
      </main>
    </div>
  );
}
