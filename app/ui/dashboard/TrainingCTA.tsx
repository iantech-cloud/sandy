'use client';

import React from 'react';
import { MessageCircle, Zap } from 'lucide-react';

export default function TrainingCTA() {
  const handleWhatsAppClick = () => {
    window.open('https://whatsapp.com/channel/0029VbDM4efEQIaqFshy3L2H', '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleWhatsAppClick}
      className="w-full group relative overflow-hidden rounded-xl transition-all duration-300 ease-out hover:scale-105"
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Animated shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
      
      {/* Content */}
      <div className="relative z-10 p-4 flex flex-col items-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <Zap size={18} className="text-white animate-pulse" />
          <span className="text-sm font-bold text-white">Want to be trained?</span>
        </div>
        <div className="flex items-center justify-center space-x-1">
          <MessageCircle size={16} className="text-white" />
          <span className="text-xs font-medium text-white/90">Click here</span>
        </div>
      </div>

      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-400/0 via-emerald-400/0 to-teal-400/0 group-hover:from-green-400/20 group-hover:via-emerald-400/20 group-hover:to-teal-400/20 rounded-xl transition-all duration-300"></div>
    </button>
  );
}
