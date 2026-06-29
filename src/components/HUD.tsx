import React from 'react';
import { GameStats, ControlSettings } from '../types';

interface HUDProps {
  stats: GameStats;
  bossHP: number | null; // null if not active
  bossMaxHP: number;
  controls: ControlSettings;
  onAttackTrigger: () => void;
  onSkillTrigger: () => void;
  onTogglePause?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  bossHP,
  bossMaxHP,
  controls,
  onAttackTrigger,
  onSkillTrigger,
  onTogglePause,
}) => {
  const hpHearts = Array.from({ length: stats.maxHp });

  // Cooldown status calculation
  const cooldownPercent = stats.skillMaxCooldown > 0 
    ? Math.max(0, (stats.skillCooldown / stats.skillMaxCooldown) * 100) 
    : 0;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6 select-none font-sans">
      
      {/* Top Bar: Stats & HP & Boss */}
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Health Hearts */}
          <div id="hud-hp-bar" className="flex items-center gap-1.5 bg-slate-950/80 p-2 px-3.5 rounded-2xl border border-slate-900 shadow-lg">
            <span className="text-xs font-mono font-bold text-red-500 mr-2 tracking-widest">HP</span>
            <div className="flex gap-1">
              {hpHearts.map((_, i) => {
                const isActive = i < stats.hp;
                return (
                  <svg
                    key={i}
                    className={`w-6 h-6 transition-all duration-300 ${
                      isActive 
                        ? 'text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)] scale-100' 
                        : 'text-slate-800 scale-90'
                    }`}
                    fill={isActive ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                );
              })}
            </div>
          </div>

          {/* Score & Defeats Panel */}
          <div className="flex gap-3">
            <div className="bg-slate-950/80 p-2 px-4 rounded-2xl border border-slate-900 shadow-lg flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">SCORE</span>
              <span className="text-sm font-black font-mono text-amber-400">{stats.score}</span>
            </div>

            <div className="bg-slate-950/80 p-2 px-4 rounded-2xl border border-slate-900 shadow-lg flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">DEFEATS</span>
              <span className="text-sm font-black font-mono text-[#00ffff]">{stats.kills}/10</span>
            </div>
          </div>
        </div>

        {/* Boss HP Bar - Show only when bossHP is not null */}
        {bossHP !== null && bossHP > 0 && (
          <div className="w-full max-w-xl mx-auto bg-slate-950/90 border border-red-950 p-3 rounded-2xl shadow-xl pointer-events-auto animate-pulse-slow">
            <div className="flex justify-between items-center mb-1 px-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
                <span className="text-xs font-black font-mono text-red-500 tracking-wider">BOSS: IGNIS DEVOURER</span>
              </div>
              <span className="text-xs font-mono text-red-400">{bossHP} / {bossMaxHP}</span>
            </div>
            <div className="w-full h-3 bg-red-950/40 rounded-full overflow-hidden border border-red-900/50 p-[2px]">
              <div 
                className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 rounded-full transition-all duration-150"
                style={{ width: `${(bossHP / bossMaxHP) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Action overlays & cooldowns & Mobile Virtual Controls */}
      <div className="w-full flex flex-col md:flex-row items-end justify-between gap-4 mt-auto">
        
        {/* Help hints / Instructions */}
        <div className="hidden md:block bg-slate-950/80 p-3.5 rounded-2xl border border-slate-900 shadow-md font-mono text-[10px] text-slate-400">
          <div className="text-[#00ffff] font-bold mb-1">KEYBOARD MAP</div>
          <div>Move: <span className="text-white font-sans font-semibold">W / A / S / D</span> or <span className="text-white font-sans font-semibold">Arrows</span></div>
          <div>Punch Attack: <span className="text-white font-sans font-semibold font-bold">P Key</span></div>
          <div>Ring Blast Skill: <span className="text-white font-sans font-semibold font-bold">O Key</span></div>
        </div>

        {/* Virtual Controller Touch Overlay for mobile/iframe players */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-4 pointer-events-auto">
          {/* Skill Button Widget */}
          <div className="flex items-center gap-3">
            {/* Punch Button (P) */}
            <button
              id="virtual-btn-attack"
              onClick={onAttackTrigger}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 hover:from-[#00b4d8] hover:to-[#00ffff] active:scale-90 border border-slate-800 hover:border-[#00ffff] text-white hover:text-gray-900 shadow-xl transition-all flex flex-col items-center justify-center cursor-pointer"
            >
              <span className="text-xs font-black">PUNCH</span>
              <span className="text-[9px] font-mono opacity-60">Key P</span>
            </button>

            {/* Ultimate Skill Button (O) */}
            <button
              id="virtual-btn-skill"
              disabled={stats.skillCooldown > 0}
              onClick={onSkillTrigger}
              className={`w-16 h-16 rounded-full relative overflow-hidden border shadow-2xl transition-all flex flex-col items-center justify-center cursor-pointer ${
                stats.skillCooldown > 0
                  ? 'bg-slate-950 border-slate-900 text-slate-600 scale-95'
                  : 'bg-gradient-to-tr from-[#00b4d8] to-[#00ffff] hover:scale-105 active:scale-95 border-[#00ffff] text-gray-950'
              }`}
            >
              {/* Cooldown progress cover overlay */}
              {stats.skillCooldown > 0 && (
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-red-950/40 transition-all duration-100"
                  style={{ height: `${cooldownPercent}%` }}
                />
              )}
              <span className="text-xs font-black relative z-10">BLAST</span>
              {stats.skillCooldown > 0 ? (
                <span className="text-[10px] font-mono font-bold text-red-500 relative z-10">
                  {Math.ceil(stats.skillCooldown)}s
                </span>
              ) : (
                <span className="text-[9px] font-mono opacity-80 relative z-10">Key O</span>
              )}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
