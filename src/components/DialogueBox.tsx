import React, { useState } from 'react';
import { DialogueLine, ENDING_DIALOGUE } from '../types';

interface DialogueBoxProps {
  onFinish: () => void;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({ onFinish }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const currentDialogue: DialogueLine = ENDING_DIALOGUE[currentStep];
  const isLastStep = currentStep === ENDING_DIALOGUE.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onFinish();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4 select-none">
      
      {/* Speaker Portraits Grid */}
      <div className="flex justify-between items-end mb-4 px-2 md:px-8">
        {/* Player Portrait (Left) */}
        <div 
          className={`flex flex-col items-center transition-all duration-300 ${
            currentDialogue.speaker === 'Player' 
              ? 'scale-105 opacity-100 drop-shadow-[0_0_12px_rgba(0,255,255,0.4)]' 
              : 'scale-90 opacity-40 blur-[1px]'
          }`}
        >
          <div className="w-24 h-24 overflow-hidden rounded-2xl bg-slate-900 border-2 border-[#00ffff] flex items-center justify-center">
            <img
              src="https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/player.png"
              alt="Player"
              className="w-[300%] h-[300%] max-w-none object-cover scale-150 relative"
              style={{
                objectPosition: '12.5% 12.5%', // zoom to head
              }}
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="mt-1.5 px-3 py-0.5 rounded-full bg-slate-950 text-[11px] font-black font-mono tracking-widest text-[#00ffff] border border-[#00ffff]/40">
            HERO
          </span>
        </div>

        {/* NPC Portrait (Right) */}
        <div 
          className={`flex flex-col items-center transition-all duration-300 ${
            currentDialogue.speaker === 'NPC' 
              ? 'scale-105 opacity-100 drop-shadow-[0_0_12px_rgba(255,200,0,0.4)]' 
              : 'scale-90 opacity-40 blur-[1px]'
          }`}
        >
          <div className="w-24 h-24 overflow-hidden rounded-2xl bg-slate-900 border-2 border-amber-400 flex items-center justify-center">
            <img
              src="https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/npc1_pdraha.png"
              alt="NPC Elder"
              className="w-[300%] h-[300%] max-w-none object-cover scale-150 relative"
              style={{
                objectPosition: '12.5% 12.5%', // zoom to head
              }}
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="mt-1.5 px-3 py-0.5 rounded-full bg-slate-950 text-[11px] font-black font-mono tracking-widest text-amber-400 border border-amber-400/40">
            ELDER
          </span>
        </div>
      </div>

      {/* JRPG Styled Text Dialog Container */}
      <div 
        onClick={handleNext}
        className="w-full bg-slate-950/95 border-2 border-slate-850 p-5 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.8)] cursor-pointer hover:border-[#00ffff]/40 active:scale-[0.99] transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px]"
      >
        {/* Background Glow effects */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#00ffff]/5 blur-2xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-400/5 blur-2xl rounded-full" />

        {/* Speaker Label */}
        <div className="text-xs font-black font-mono tracking-wider mb-2 flex items-center gap-1.5">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${currentDialogue.speaker === 'Player' ? 'bg-[#00ffff]' : 'bg-amber-400'}`} />
          <span className={currentDialogue.speaker === 'Player' ? 'text-[#00ffff]' : 'text-amber-400'}>
            {currentDialogue.speaker.toUpperCase()}
          </span>
        </div>

        {/* Dialog Sentence */}
        <p className="text-base md:text-lg leading-relaxed text-slate-100 font-medium px-1 flex-1">
          {currentDialogue.text}
        </p>

        {/* Step indicator footer */}
        <div className="flex justify-between items-center text-xs text-slate-500 font-mono mt-3 border-t border-slate-900/60 pt-2">
          <span>Dialogue {currentStep + 1} / {ENDING_DIALOGUE.length}</span>
          
          {isLastStep ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFinish();
              }}
              className="py-1 px-4 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 font-bold text-gray-950 hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>FINISH GAME</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[#00ffff] animate-bounce-horizontal">
              <span>TAP OR CLICK TO NEXT</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
