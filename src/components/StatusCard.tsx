import React from 'react';
import { Power, PowerOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onReport: (status: 'on' | 'off') => void;
  isLoading?: boolean;
}

export default function StatusCard({ onReport, isLoading }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-2 h-8 bg-black"></div>
        <h2 className="text-2xl font-black uppercase italic text-gray-900">Current neighborhood status</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <button
          disabled={isLoading}
          onClick={() => onReport('on')}
          className={cn(
            "flex flex-col items-center justify-center p-8 border-[6px] border-black transition-all brutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none bg-green-500",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="w-16 h-16 bg-white border-4 border-black rounded-full flex items-center justify-center mb-4">
            <Power className="w-8 h-8 text-black" />
          </div>
          <span className="text-3xl font-black uppercase italic text-black">NEPA ON</span>
          <span className="text-xs font-bold uppercase mt-2 opacity-80">Light is back!</span>
        </button>

        <button
          disabled={isLoading}
          onClick={() => onReport('off')}
          className={cn(
            "flex flex-col items-center justify-center p-8 border-[6px] border-black transition-all brutal-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none bg-red-500",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="w-16 h-16 bg-white border-4 border-black rounded-full flex items-center justify-center mb-4">
            <PowerOff className="w-8 h-8 text-black" />
          </div>
          <span className="text-3xl font-black uppercase italic text-black">NEPA OFF</span>
          <span className="text-xs font-bold uppercase mt-2 opacity-80">Up NEPA no dey...</span>
        </button>
      </div>
    </div>
  );
}
