import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';

interface AddressSearchProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  onManualEntry?: (value: string) => void;
  className?: string;
  placeholder?: string;
  error?: string | null;
}

export default function AddressSearch({ onPlaceSelect, onManualEntry, className, placeholder, error }: AddressSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'IDLE' | 'NOT_FOUND' | 'ERROR'>( 'IDLE');
  
  const placesLib = useMapsLibrary('places');
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    try {
      autocompleteService.current = new placesLib.AutocompleteService();
      const dummyElement = document.createElement('div');
      placesService.current = new placesLib.PlacesService(dummyElement);
    } catch (e) {
      console.error("Failed to initialize Places Lib:", e);
      setSearchStatus('ERROR');
    }
  }, [placesLib]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (onManualEntry) onManualEntry(value);

    if (!value || !autocompleteService.current || error === 'BillingNotEnabledMapError') {
      setSuggestions([]);
      return;
    }

    try {
      autocompleteService.current.getPlacePredictions(
        { input: value, componentRestrictions: { country: 'NG' } },
        (predictions, status) => {
          if (status === 'OK' && predictions) {
            setSuggestions(predictions);
            setIsOpen(true);
            setSearchStatus('IDLE');
          } else if (status === 'ZERO_RESULTS') {
            setSuggestions([]);
            setSearchStatus('NOT_FOUND');
          } else {
            console.warn("Autocomplete failed with status:", status);
            setSuggestions([]);
            setSearchStatus('ERROR');
          }
        }
      );
    } catch (e) {
      setSearchStatus('ERROR');
    }
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;

    setInputValue(prediction.description);
    setIsOpen(false);

    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry', 'formatted_address', 'name', 'place_id'] },
      (place, status) => {
        if (status === 'OK' && place) {
          onPlaceSelect(place);
        }
      }
    );
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-500 w-4 h-4 transition-colors" />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder || "SCAN NETWORK FOR NODE..."}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all shadow-inner font-mono text-xs uppercase tracking-tight"
        />
      </div>

      {isOpen && (suggestions.length > 0 || searchStatus !== 'IDLE' || error === 'BillingNotEnabledMapError' || inputValue) && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
          {error === 'BillingNotEnabledMapError' ? (
            <div className="px-4 py-3 text-[10px] text-red-500 font-mono text-center bg-red-500/5">
              GOOGLE MAPS BILLING REQUIRED FOR AUTOCOMPLETE.
              <button 
                onClick={() => setIsOpen(false)}
                className="block mx-auto mt-2 text-zinc-400 hover:text-white underline text-[9px]"
              >
                USE MANUAL ENTRY: "{inputValue || 'TYPE LOCATION'}"
              </button>
            </div>
          ) : searchStatus === 'ERROR' ? (
            <div className="px-4 py-3 text-[10px] text-amber-500 font-mono text-center">
              SYSTEM ERROR: UNABLE TO ACCESS SEARCH CLUSTER.
              <button 
                onClick={() => setIsOpen(false)}
                className="block mx-auto mt-2 text-zinc-400 hover:text-white underline text-[9px]"
              >
                USE MANUAL ENTRY
              </button>
            </div>
          ) : searchStatus === 'NOT_FOUND' ? (
            <div className="px-4 py-3 text-[10px] text-zinc-500 font-mono text-center">
              NO GEOGRAPHIC NODES FOUND.
            </div>
          ) : (
            <>
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-0"
                >
                  <div className="bg-zinc-800 p-1.5 rounded text-zinc-500">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-zinc-200 uppercase tracking-tight">{s.structured_formatting.main_text}</div>
                    <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-tighter">{s.structured_formatting.secondary_text}</div>
                  </div>
                </button>
              ))}
              {inputValue && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left text-zinc-400"
                >
                  <MapPin className="w-3 h-3 text-zinc-600" />
                  <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-tight">Use Manual Entry</div>
                  <div className="text-[9px] text-zinc-500 font-mono ml-auto">"{inputValue}"</div>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
