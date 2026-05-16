import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { LightLog } from '../types';
import { User, MapPin, Zap, ZapOff } from 'lucide-react';

interface Props {
  logs: LightLog[];
}

export default function LiveFeed({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="p-8 text-center italic text-gray-400">
        Waiting for grid activity...
      </div>
    );
  }

  return (
    <div className="divide-y-[4px] divide-black">
      {logs.map((log) => (
        <div key={log.id} className="p-6 bg-white hover:bg-yellow-50 transition-colors">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 border-2 border-black rounded-full ${log.status === 'on' ? 'bg-green-500' : 'bg-red-500'}`} />
              <p className="text-sm font-black uppercase italic tracking-tight">{log.userName}</p>
            </div>
            <span className="text-[10px] font-black uppercase text-gray-400">
              {log.timestamp?.toDate ? formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true }) : 'Now'}
            </span>
          </div>
          
          <p className="text-xs font-bold text-gray-500 mb-4 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {log.location.address}
          </p>
          
          <div className={cn(
            "inline-block border-2 border-black px-3 py-1 text-xs font-black uppercase italic",
            log.status === 'on' ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
          )}>
            NEPA {log.status}
          </div>
        </div>
      ))}
    </div>
  );
}
