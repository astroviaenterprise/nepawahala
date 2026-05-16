import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';

interface Props {
  onLocationSubmit: (location: string) => void;
  defaultValue?: string;
}

export default function LocationInput({ onLocationSubmit, defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onLocationSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full group">
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-black group-focus-within:scale-110 transition-transform" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value.trim() && onLocationSubmit(value.trim())}
          className="w-full pl-14 pr-32 py-5 bg-white border-[6px] border-black focus:bg-yellow-50 focus:outline-none transition-all shadow-none font-black text-xl uppercase placeholder:text-gray-300 italic"
          placeholder="ENTER YOUR AREA (E.G. LEKKI)..."
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black text-white px-4 py-2 text-xs font-black uppercase italic hover:bg-gray-800 transition-colors"
        >
          Set Area
        </button>
      </div>
      <p className="mt-2 text-[10px] font-black uppercase text-gray-400 italic">
        Tip: Be specific (Street, Area, City) for better AI predictions
      </p>
    </form>
  );
}
