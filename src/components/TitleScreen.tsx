import React from 'react';
import { GameState } from '../types';

interface TitleScreenProps {
  onStartGame: () => void;
  onOpenOptions: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame, onOpenOptions }) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between bg-radial from-[#121c3b] via-[#0b0f19] to-[#04060a] p-8 text-white select-none">
      
      {/* Decorative Top Accent */}
      <div className="mt-4 flex flex-col items-center">
        <span className="font-mono text-xs tracking-[0.3em] text-[#00ffff] uppercase animate-pulse">
          Premium Retro 2.5D Experience
        </span>
        <div className="h-[2px] w-12 bg-gradient-to-r from-transparent via-[#00ffff] to-transparent mt-2" />
      </div>

      {/* Main Logo & Title */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-lg text-center animate-fade-in">
        {/* Logo Image */}
        <div className="relative mb-6 group">
          <div className="absolute inset-0 bg-[#00ffff]/20 blur-xl rounded-full scale-95 group-hover:scale-105 transition-all duration-700" />
          <img
            id="title-logo"
            src="https://res.cloudinary.com/dsucg33fv/image/upload/v1782709347/logo_i8827v.png"
            alt="Game Logo"
            className="w-72 h-auto object-contain relative drop-shadow-[0_10px_15px_rgba(0,255,255,0.3)] select-none pointer-events-none"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Humbler, more polished Title tag */}
        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#00ffff] via-white to-[#00ffff] drop-shadow-md mb-2">
          2.5D Action RPG Adventure
        </h1>
        <p className="text-sm text-gray-400 font-mono tracking-wide px-4">
          Defeat the spawning elemental forces, gather healing potions, and challenge the mighty Fire Boss!
        </p>
      </div>

      {/* Menu Options Buttons */}
      <div className="mb-12 flex flex-col sm:flex-row gap-4 w-full max-w-md px-4">
        <button
          id="btn-start-game"
          onClick={onStartGame}
          className="flex-1 py-4 px-6 rounded-xl font-bold text-lg bg-gradient-to-r from-[#00e1ff] to-[#00b4d8] text-gray-900 border border-[#00ffff] shadow-[0_0_20px_rgba(0,225,255,0.4)] hover:shadow-[0_0_30px_rgba(0,225,255,0.7)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>ENTER GAME</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        <button
          id="btn-options"
          onClick={onOpenOptions}
          className="flex-1 py-4 px-6 rounded-xl font-bold text-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700/80 shadow-md hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="w-5 h-5 animate-spin-slow" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>OPTIONS</span>
        </button>
      </div>

      {/* Bottom Footer - Minimalist and neat */}
      <div className="font-mono text-[10px] text-gray-500 mb-2">
        Controls: WASD / Arrows to Move • P to Attack • O for Ultimate Skill
      </div>

    </div>
  );
};
