import { useEffect, useRef, useState } from 'react';
import { CubeEngine } from './engine/CubeEngine';
import { useCubeStore } from './store/useCubeStore';
import { store } from './store/cubeStore';
import { ColorTheme, Move } from './core/types';
import { THEME_PALETTES } from './engine/themes';
import { RealCubePaintPanel } from './components/paint/RealCubePaintPanel';
import { TutorControlPanel } from './components/tutor/TutorControlPanel';
import { LevelSelectModal } from './components/levels/LevelSelectModal';
import { LevelPlayOverlay } from './components/levels/LevelPlayOverlay';
import { SpeedrunPanel } from './components/speedrun/SpeedrunPanel';
import { QuickTurnBar } from './components/common/QuickTurnBar';
import { LevelConfig, LEVELS } from './data/levels';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CubeEngine | null>(null);

  const {
    mode,
    theme,
    paintFacelets,
    initialTutorFacelets,
    solutionMoves,
    unlockedLevels,
  } = useCubeStore();

  const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(LEVELS[0]);
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  // 1. Initialize 3D CubeEngine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new CubeEngine({
      onFaceletClick: (faceletIndex, isCenter) => {
        if (store.getState().mode === 'paint') {
          if (isCenter) return;
          store.setPaintFacelet(faceletIndex, store.getState().selectedPaintColor);
        }
      },
    });

    engine.init(containerRef.current);
    engineRef.current = engine;

    // Load saved unlocked levels
    if (typeof localStorage !== 'undefined') {
      const savedUnlocked = parseInt(localStorage.getItem('cube_unlocked_levels') || '1', 10);
      store.setState({ unlockedLevels: savedUnlocked });
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // 2. Sync Theme
  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  // 3. Sync Mode & 3D Interaction
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.setInteractionMode(mode);

    if (mode === 'paint') {
      engine.setStateFromFacelets(paintFacelets);
      engine.hideTutorGuide();
    } else if (mode === 'tutor') {
      engine.setStateFromFacelets(initialTutorFacelets);
      engine.alignCamera('HOME');
    } else if (mode === 'level') {
      engine.hideTutorGuide();
    } else if (mode === 'free') {
      engine.hideTutorGuide();
    }
  }, [mode, initialTutorFacelets]);

  // 4. In Paint Mode: Keep 3D Cube Synchronized with 2D / Store Facelets
  useEffect(() => {
    if (mode === 'paint') {
      engineRef.current?.setStateFromFacelets(paintFacelets);
    }
  }, [paintFacelets, mode]);

  // 5. Global Keyboard Shortcuts in Free/Game Mode (U/D/L/R/F/B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (mode === 'paint' || mode === 'tutor') return; // Handled by respective modes

      const key = e.key.toUpperCase();
      const isShift = e.shiftKey;
      if (['U', 'D', 'L', 'R', 'F', 'B'].includes(key)) {
        const move = (isShift ? `${key}'` : key) as Move;
        engineRef.current?.applyMove(move);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // Switch to Level Play
  const handleSelectLevel = (level: LevelConfig) => {
    setActiveLevel(level);
    setShowLevelSelect(false);
    store.setState({ mode: 'level' });
  };

  const handleUnlockAll = () => {
    store.setState({ unlockedLevels: 20 });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cube_unlocked_levels', '20');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-[#0B1020] via-[#0F172A] to-[#131B2E]">
      {/* 3D WebGL Canvas Layer */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Master Navigation Bar */}
      <header className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 rounded-full glass-panel shadow-2xl max-w-[95vw] overflow-x-auto">
        {/* App Title */}
        <div className="flex items-center gap-2 pr-2 border-r border-slate-700/60 shrink-0">
          <div className="w-3.5 h-3.5 rounded bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
          <span className="text-xs sm:text-sm font-extrabold tracking-wide text-white whitespace-nowrap">
            3D 魔方大师
          </span>
        </div>

        {/* Core Mode Switcher Tabs */}
        <nav className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => store.setState({ mode: 'paint' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              mode === 'paint'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.5)] font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>📸</span>
            <span>实景录入魔方</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (solutionMoves.length > 0) {
                store.setState({ mode: 'tutor' });
              } else {
                store.setState({ mode: 'paint' });
              }
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              mode === 'tutor'
                ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(52,211,153,0.5)] font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>✨</span>
            <span>AI 手把手教学</span>
            {solutionMoves.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowLevelSelect(true);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              mode === 'level'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.5)] font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🏆</span>
            <span>20关闯关</span>
          </button>

          <button
            type="button"
            onClick={() => store.setState({ mode: 'free' })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              mode === 'free'
                ? 'bg-slate-700 text-sky-300 border border-sky-400/40 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🎲</span>
            <span>随机竞速</span>
          </button>
        </nav>

        {/* Theme Dropdown / Pill */}
        <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-slate-700/60 text-xs shrink-0">
          {(Object.keys(THEME_PALETTES) as ColorTheme[]).map((themeKey) => (
            <button
              key={themeKey}
              type="button"
              onClick={() => store.setState({ theme: themeKey })}
              className={`px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                theme === themeKey
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {THEME_PALETTES[themeKey].name}
            </button>
          ))}
        </div>
      </header>

      {/* MODE 1: Real-Cube Paint Panel Overlay */}
      {mode === 'paint' && (
        <aside className="absolute top-20 right-4 sm:right-6 bottom-6 z-20 w-full max-w-md sm:max-w-lg flex flex-col pointer-events-auto">
          <RealCubePaintPanel
            onAlignCamera={(view) => engineRef.current?.alignCamera(view)}
            onEnterTutor={() => {
              store.setState({ mode: 'tutor' });
            }}
          />
        </aside>
      )}

      {/* MODE 2: AI Step-by-Step Tutor Control Console Overlay */}
      {mode === 'tutor' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-auto">
          <TutorControlPanel
            engine={engineRef.current}
            onExitTutor={() => store.setState({ mode: 'free' })}
            onGoToLevels={() => {
              setShowLevelSelect(true);
            }}
          />
        </div>
      )}

      {/* MODE 3: 20 Levels Mode Playing Overlay */}
      {mode === 'level' && activeLevel && (
        <LevelPlayOverlay
          level={activeLevel}
          engine={engineRef.current}
          onExitLevels={() => setShowLevelSelect(true)}
          onNextLevel={(next) => setActiveLevel(next)}
        />
      )}

      {/* MODE 4: Free & Speedrun Panel Overlay */}
      {mode === 'free' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-auto">
          <SpeedrunPanel
            engine={engineRef.current}
            onAlignCamera={(view) => engineRef.current?.alignCamera(view)}
          />
        </div>
      )}

      {/* Bottom Collapsible Quick Rotator Keypad (Available in free and level modes) */}
      {(mode === 'free' || mode === 'level') && (
        <div className="absolute bottom-2 left-6 z-20 hidden sm:block">
          <QuickTurnBar engine={engineRef.current} />
        </div>
      )}

      {/* 20 Levels Selection Modal Dialog */}
      {showLevelSelect && (
        <LevelSelectModal
          unlockedLevels={unlockedLevels}
          onSelectLevel={handleSelectLevel}
          onClose={() => {
            setShowLevelSelect(false);
            if (!activeLevel) store.setState({ mode: 'free' });
          }}
          onUnlockAll={handleUnlockAll}
        />
      )}
    </div>
  );
}
