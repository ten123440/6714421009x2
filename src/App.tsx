import { useEffect, useRef, useState } from 'react';
import { GameState, ControlSettings, DEFAULT_CONTROLS, GameStats } from './types';
import { GameEngine } from './game/GameEngine';
import { TitleScreen } from './components/TitleScreen';
import { OptionsScreen } from './components/OptionsScreen';
import { HUD } from './components/HUD';
import { DialogueBox } from './components/DialogueBox';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [controls, setControls] = useState<ControlSettings>(DEFAULT_CONTROLS);

  // Live game stats from ThreeJS loop
  const [gameStats, setGameStats] = useState<GameStats>({
    hp: 5,
    maxHp: 5,
    score: 0,
    kills: 0,
    skillCooldown: 0,
    skillMaxCooldown: 8,
    bossDefeated: false,
  });

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);

  // Initialize and clean up ThreeJS Game Engine when PLAYING or ENDING
  useEffect(() => {
    const isRunningState = gameState === GameState.PLAYING || gameState === GameState.ENDING;

    if (isRunningState && canvasContainerRef.current) {
      if (!gameEngineRef.current) {
        const engine = new GameEngine(
          canvasContainerRef.current,
          (stats) => {
            setGameStats(stats);
          },
          (state) => {
            setGameState(state);
          }
        );

        engine.setControlSettings(controls);
        gameEngineRef.current = engine;

        // Force ending cutscene if state is ENDING directly (for dialogues)
        if (gameState === GameState.ENDING) {
          engine.triggerEndingCutscene();
        }
      } else {
        // If engine already exists and we are in ENDING, ensure ending cutscene is triggered
        if (gameState === GameState.ENDING) {
          gameEngineRef.current.triggerEndingCutscene();
        }
      }
    } else {
      // Clean up when leaving active gameplay states
      if (gameEngineRef.current) {
        gameEngineRef.current.cancelLoop();
        gameEngineRef.current = null;
      }
    }
  }, [gameState]);

  // Push controls updates down to active engine instance dynamically
  useEffect(() => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setControlSettings(controls);
    }
  }, [controls]);

  // Virtual controllers triggers
  const handleVirtualAttack = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.triggerPlayerAttack();
    }
  };

  const handleVirtualSkill = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.triggerPlayerSkill();
    }
  };

  const handleStartGame = () => {
    // Reset stats to initial clean values on start to prevent leftover states from previous games
    setGameStats({
      hp: 5,
      maxHp: 5,
      score: 0,
      kills: 0,
      skillCooldown: 0,
      skillMaxCooldown: 8,
      bossDefeated: false,
    });
    setGameState(GameState.PLAYING);
  };

  const handleRestart = () => {
    setGameState(GameState.TITLE);
    setGameStats({
      hp: 5,
      maxHp: 5,
      score: 0,
      kills: 0,
      skillCooldown: 0,
      skillMaxCooldown: 8,
      bossDefeated: false,
    });
  };

  return (
    <div className="w-screen h-screen relative bg-[#0c0f1d] overflow-hidden select-none font-sans text-white">
      
      {/* 1. Main Title Screen View */}
      {gameState === GameState.TITLE && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenOptions={() => setShowOptions(true)}
        />
      )}

      {/* 2. Options Overlay (Renders above Title or Gameplay) */}
      {showOptions && (
        <OptionsScreen
          currentSettings={controls}
          onSave={(updated) => setControls(updated)}
          onClose={() => setShowOptions(false)}
        />
      )}

      {/* 3. Main Gameplay ThreeJS Render Canvas */}
      {(gameState === GameState.PLAYING || gameState === GameState.ENDING) && (
        <div id="game-canvas-container" ref={canvasContainerRef} className="absolute inset-0 w-full h-full z-0" />
      )}

      {/* 4. Active Gameplay HUD HUD */}
      {gameState === GameState.PLAYING && (
        <HUD
          stats={gameStats}
          bossHP={gameStats.kills >= 10 && !gameStats.bossDefeated ? (gameEngineRef.current ? (gameStats.hp > 0 ? (gameStats.bossDefeated ? 0 : (gameStats.score >= 2000 ? 0 : 25)) : 25) : 25) : null} // Simple computed fallback sync
          bossMaxHP={25}
          controls={controls}
          onAttackTrigger={handleVirtualAttack}
          onSkillTrigger={handleVirtualSkill}
        />
      )}

      {/* 5. JRPG Dialogue Cutscene View (Ending State) */}
      {gameState === GameState.ENDING && (
        <DialogueBox
          onFinish={() => {
            setGameState(GameState.TITLE);
            setGameStats({
              hp: 5,
              maxHp: 5,
              score: 0,
              kills: 0,
              skillCooldown: 0,
              skillMaxCooldown: 8,
              bossDefeated: false,
            });
          }}
        />
      )}

      {/* 6. Game Over Screen Overlay Modal */}
      {gameState === GameState.GAMEOVER && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-red-950/80 to-slate-950 border border-red-900 rounded-3xl p-8 text-center shadow-2xl shadow-red-500/10">
            {/* Defeated Icon */}
            <div className="mx-auto w-20 h-20 bg-red-950/50 rounded-full border-2 border-red-500/40 flex items-center justify-center mb-6 text-red-500 animate-pulse">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-4xl font-black tracking-tight text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] mb-2">
              YOU DIED
            </h2>
            <p className="text-sm text-slate-400 font-mono tracking-wider mb-6">
              Your hit points reached 0. The elemental forces overcame your defense.
            </p>

            {/* Stats Summary */}
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl mb-8 space-y-2">
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-slate-500">FINAL SCORE</span>
                <span className="text-amber-400 font-black text-base">{gameStats.score}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono border-t border-slate-800 pt-2">
                <span className="text-slate-500">FOES DEFEATED</span>
                <span className="text-[#00ffff] font-black text-base">{gameStats.kills}</span>
              </div>
            </div>

            {/* Reset Actions */}
            <button
              onClick={handleRestart}
              className="w-full py-4 px-6 rounded-2xl font-bold text-lg bg-gradient-to-r from-red-500 to-orange-600 text-slate-950 shadow-[0_4px_20px_rgba(239,68,68,0.4)] hover:shadow-[0_4px_30px_rgba(239,68,68,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer text-center"
            >
              RETRY ADVENTURE
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
