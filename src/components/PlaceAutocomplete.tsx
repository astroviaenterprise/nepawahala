import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search } from 'lucide-react';

interface Props {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  defaultValue?: string;
}

export default function PlaceAutocomplete({ onPlaceSelect, defaultValue }: Props) {
  const [inputValue, setInputValue] = useState(defaultValue || '');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);
  
  const placesLib = useMapsLibrary('places');
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    autocompleteService.current = new placesLib.AutocompleteService();
    // Dummy div for PlacesService as it requires a map or a div
    const dummyDiv = document.createElement('div');
    placesService.current = new placesLib.PlacesService(dummyDiv);
  }, [placesLib]);

  useEffect(() => {
    if (!inputValue || !autocompleteService.current || inputValue.length < 3) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const result = await autocompleteService.current?.getPlacePredictions({
          input: inputValue,
          componentRestrictions: { country: 'NG' }, // Restrict to Nigeria
          types: ['geocode', 'establishment']
        });
        setSuggestions(result?.predictions || []);
      } catch (err) {
        console.error(err);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  const handleSelect = (suggestion: google.maps.places.AutocompletePrediction) => {
    setInputValue(suggestion.description);
    setOpen(false);

    if (placesService.current) {
      placesService.current.getDetails(
        { placeId: suggestion.place_id, fields: ['name', 'formatted_address', 'geometry', 'place_id'] },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            onPlaceSelect(place);
          }
        }
      );
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-black" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          className="w-full pl-14 pr-6 py-5 bg-white border-[6px] border-black focus:bg-yellow-50 focus:outline-none transition-all shadow-none font-black text-xl uppercase placeholder:text-gray-300 italic"
          placeholder="ENTER NEIGHBORHOOD..."
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-0 bg-white border-[6px] border-t-0 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => handleSelect(s)}
              className="w-full px-6 py-4 text-left hover:bg-black hover:text-white transition-colors border-b-4 border-black last:border-0"
            >
              <p className="text-lg font-black uppercase italic truncate">{s.structured_formatting.main_text}</p>
              <p className="text-[10px] font-bold uppercase opacity-60 truncate">{s.structured_formatting.secondary_text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
