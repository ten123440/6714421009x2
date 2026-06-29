import React, { useState } from 'react';
import { ControlSettings, DEFAULT_CONTROLS, ALTERNATIVE_CONTROLS } from '../types';

interface OptionsScreenProps {
  currentSettings: ControlSettings;
  onSave: (settings: ControlSettings) => void;
  onClose: () => void;
}

export const OptionsScreen: React.FC<OptionsScreenProps> = ({
  currentSettings,
  onSave,
  onClose,
}) => {
  const [settings, setSettings] = useState<ControlSettings>({ ...currentSettings });
  const [activeRemapField, setActiveRemapField] = useState<keyof ControlSettings | null>(null);

  const handleKeyDetect = (field: keyof ControlSettings, e: React.KeyboardEvent) => {
    e.preventDefault();
    setSettings((prev) => ({
      ...prev,
      [field]: e.code,
    }));
    setActiveRemapField(null);
  };

  const applyPreset = (preset: 'WASD' | 'Arrows') => {
    if (preset === 'WASD') {
      setSettings(DEFAULT_CONTROLS);
    } else {
      setSettings(ALTERNATIVE_CONTROLS);
    }
  };

  const saveAndExit = () => {
    onSave(settings);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 text-white select-none backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full transition-colors cursor-pointer"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-black tracking-tight text-[#00ffff]">CONTROL SETTINGS</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Configure your actions and keyboard mapping</p>
        </div>

        {/* Quick Presets */}
        <div className="flex justify-center gap-3 mb-6 bg-slate-950 border border-slate-800/80 p-2 rounded-2xl">
          <button
            onClick={() => applyPreset('WASD')}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer text-center bg-slate-900 border border-slate-700/50 text-[#00ffff]"
          >
            WASD Preset
          </button>
          <button
            onClick={() => applyPreset('Arrows')}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer text-center bg-slate-900 border border-slate-700/50 text-[#00ffff]"
          >
            Arrow Keys Preset
          </button>
        </div>

        {/* Interactive Configuration Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          
          {/* Key Remapper Form */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs text-slate-400 border-b border-slate-850 pb-1 mb-2">
              CLICK KEY TO REBIND
            </h3>

            {(Object.keys(settings) as Array<keyof ControlSettings>).map((key) => {
              const isActive = activeRemapField === key;
              let label = '';
              switch (key) {
                case 'moveUp': label = 'Move Up'; break;
                case 'moveDown': label = 'Move Down'; break;
                case 'moveLeft': label = 'Move Left'; break;
                case 'moveRight': label = 'Move Right'; break;
                case 'attack': label = 'Punch / Attack (P)'; break;
                case 'skill': label = 'Ultimate Skill (O)'; break;
              }

              return (
                <div key={key} className="flex items-center justify-between bg-slate-900/60 p-2 px-3 rounded-xl border border-slate-800/40">
                  <span className="text-sm font-medium text-slate-300 font-sans">{label}</span>
                  
                  {isActive ? (
                    <input
                      autoFocus
                      onKeyDown={(e) => handleKeyDetect(key, e)}
                      onBlur={() => setActiveRemapField(null)}
                      placeholder="Press Any Key..."
                      className="w-36 py-1 px-2 text-center text-xs font-mono rounded bg-[#00ffff]/10 border border-[#00ffff] text-[#00ffff] outline-none animate-pulse placeholder-[#00ffff]/80"
                    />
                  ) : (
                    <button
                      onClick={() => setActiveRemapField(key)}
                      className="w-36 py-1.5 px-2 bg-slate-950 border border-slate-800 text-slate-100 hover:border-[#00ffff]/80 hover:text-[#00ffff] rounded-lg font-mono text-xs transition-all text-center cursor-pointer"
                    >
                      {settings[key].replace('Key', '').replace('Arrow', '')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Graphical Reference Panel */}
          <div className="hidden md:flex flex-col items-center justify-center p-4 bg-slate-950/60 border border-slate-900 rounded-2xl h-full min-h-[260px]">
            <div className="relative w-28 h-28 overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              {/* Cropped Player Head / Portrait */}
              <img
                src="https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/player.png"
                alt="Player Sprite Preview"
                className="w-[300%] h-[300%] max-w-none object-cover scale-150 relative"
                style={{
                  objectPosition: '12.5% 12.5%', // Approximates frame 0, row 0 head location
                }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="mt-4 text-center">
              <span className="font-mono text-xs text-[#00ffff]">HERO CLASS</span>
              <p className="text-slate-400 text-[11px] max-w-xs mt-1">
                Flipped 2D sprites in 3D perspective. Controls WASD to walk, O to blast circular rings of light, and P to punch fast!
              </p>
            </div>
          </div>

        </div>

        {/* Buttons Action footer */}
        <div className="flex gap-3 mt-8 pt-4 border-t border-slate-800/60">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl text-slate-300 font-bold bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            onClick={saveAndExit}
            className="flex-1 py-3 px-4 rounded-xl text-gray-900 font-bold bg-gradient-to-r from-[#00ffff] to-[#00b4d8] hover:shadow-[0_0_15px_rgba(0,255,255,0.3)] transition-all cursor-pointer text-center"
          >
            Save Controls
          </button>
        </div>

      </div>
    </div>
  );
};
