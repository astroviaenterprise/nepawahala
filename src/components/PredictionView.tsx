import React from 'react';
import { Sparkles, Loader2, Info } from 'lucide-react';
import { PredictionResult } from '../types';

interface Props {
  prediction: PredictionResult | null;
  isLoading: boolean;
}

export default function PredictionView({ prediction, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-black p-10 border-[6px] border-black text-yellow-400">
        <div className="flex items-center gap-4 mb-6">
          <Loader2 className="w-8 h-8 animate-spin" />
          <h3 className="text-3xl font-black uppercase italic">Analyzing grid patterns...</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-yellow-400/20 w-full"></div>
          <div className="h-4 bg-yellow-400/20 w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="border-4 border-black border-dashed p-8 text-center bg-gray-50">
        <p className="text-lg font-black uppercase italic text-gray-400">
          Select area to initialize AI projection
        </p>
      </div>
    );
  }

  return (
    <div className="bg-black text-yellow-400 p-10 border-[6px] border-black brutal-shadow transition-all relative overflow-hidden group hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
      <div className="absolute -top-10 -right-10 opacity-10 group-hover:scale-110 transition-transform">
        <Sparkles className="w-48 h-48" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <p className="bg-yellow-400 text-black px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
            AI Projection Unit
          </p>
        </div>

        <div className="space-y-6">
          <p className="text-3xl font-black uppercase italic leading-none">
            {prediction.prediction}
          </p>
          
          {prediction.estimatedTime && (
            <div className="inline-block border-2 border-yellow-400 px-4 py-2 text-2xl font-black uppercase tabular-nums">
              Expectation: {prediction.estimatedTime}
            </div>
          )}

          <div className="pt-4 border-t-2 border-yellow-400/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Confidence level</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{prediction.confidence}%</span>
            </div>
            <div className="h-4 border-2 border-yellow-400 p-0.5">
              <div 
                className="h-full bg-yellow-400 transition-all duration-1000" 
                style={{ width: `${prediction.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
