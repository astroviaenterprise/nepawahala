import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';

interface MapComponentProps {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  markers?: Array<{ id: string; position: google.maps.LatLngLiteral; title: string }>;
  error?: string | null;
}

export default function MapComponent({ center = { lat: 6.5244, lng: 3.3792 }, zoom = 12, markers = [], error }: MapComponentProps) {
  if (!API_KEY || error === 'BillingNotEnabledMapError') {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-800 p-8 text-center pointer-events-auto">
        <div className="max-w-xs">
          <div className="bg-red-500/10 p-3 rounded-full w-fit mx-auto mb-4 border border-red-500/20">
            <h3 className="text-red-500 font-mono text-xs font-bold uppercase tracking-widest leading-tight">
              {error === 'BillingNotEnabledMapError' ? 'Billing Error' : 'Maps Access Required'}
            </h3>
          </div>
          <p className="text-zinc-500 font-mono text-[10px] leading-relaxed uppercase tracking-tight">
            Terminal connection failed. 
            {error === 'BillingNotEnabledMapError' ? (
              <> Please ensure <span className="text-amber-500">Billing is Enabled</span> for your project in the Google Cloud Console. Cloud projects require an active billing account for Maps API usage.</>
            ) : (
              <> Please provide <span className="text-amber-500">VITE_GOOGLE_MAPS_PLATFORM_KEY</span> in the system settings to initialize the geolocation sub-processor.</>
            )}
          </p>
          <a 
            href="https://console.cloud.google.com/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-6 inline-block bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            Check Billing Console
          </a>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="h-full w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="NEPA_WAHALA_MAP"
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          className="h-full w-full"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {markers.map((m) => (
            <AdvancedMarker key={m.id} position={m.position} title={m.title}>
              <Pin background="#f59e0b" glyphColor="#fff" borderColor="#b45309" />
            </AdvancedMarker>
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}
