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
import { soundManager } from './audio/SoundManager';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CubeEngine | null>(null);

  const {
    mode,
    theme,
    paintFacelets,
    initialTutorFacelets,
    historyFacelets,
    currentStepIndex,
    solutionMoves,
    unlockedLevels,
  } = useCubeStore();

  const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(LEVELS[0]);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  // 1. Initialize 3D CubeEngine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new CubeEngine({
      onFaceletClick: (faceletIndex, isCenter) => {
        if (store.getState().mode === 'paint') {
          if (isCenter) return;
          store.setPaintFacelet(faceletIndex, store.getState().selectedPaintColor);
          soundManager.playPaint();
        }
      },
      onSound: (type) => {
        if (type === 'snap' || type === 'turn') soundManager.playSnap();
        else if (type === 'paint') soundManager.playPaint();
        else if (type === 'click') soundManager.playClick();
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
      const stepFacelets = historyFacelets[currentStepIndex] || initialTutorFacelets;
      engine.setStateFromFacelets(stepFacelets);
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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
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

  const handleToggleMute = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
  };

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden flex flex-col bg-[#0B1020]">
      {/* Top Master Navigation Bar (2-tier responsive on <640px phones, compact single-line h-14 on sm+) */}
      <header className="w-full border-b border-white/10 bg-slate-950/85 backdrop-blur-xl px-3 sm:px-6 py-1.5 sm:py-0 sm:h-14 flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-1.5 gap-x-3 shrink-0 z-30 select-none">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 sm:pr-3 sm:border-r border-slate-700/60 shrink-0">
          <div className="w-3.5 h-3.5 rounded bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
          <span className="text-xs sm:text-sm font-extrabold tracking-wide text-white whitespace-nowrap">
            3D 魔方大师
          </span>
        </div>

        {/* 4 Mode Tabs (full width clean row on <640px mobile, inline flex-1 on sm+ desktop) */}
        <nav className="order-3 sm:order-none w-full sm:w-auto sm:flex-1 sm:min-w-0 grid grid-cols-4 sm:flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => store.setState({ mode: 'paint' })}
            className={`px-1.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
              mode === 'paint'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.5)] font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>📸</span>
            <span>实景录入</span>
          </button>

          <button
            type="button"
            onClick={() => store.setState({ mode: 'tutor' })}
            className={`px-1.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
              mode === 'tutor'
                ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(52,211,153,0.5)] font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>✨</span>
            <span>AI 教学</span>
            {solutionMoves.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowLevelSelect(true);
            }}
            className={`px-1.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
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
            className={`px-1.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
              mode === 'free'
                ? 'bg-slate-700 text-sky-300 border border-sky-400/40 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🎲</span>
            <span>随机竞速</span>
          </button>
        </nav>

        {/* Right: Theme Selector Dropdown + Sound Toggle Button */}
        <div className="order-2 sm:order-none flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Theme Dropdown */}
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/60 rounded-xl px-2 py-1 text-xs">
            <span className="text-slate-400 text-xs">🎨</span>
            <select
              value={theme}
              onChange={(e) => store.setState({ theme: e.target.value as ColorTheme })}
              className="bg-transparent text-slate-200 text-[11px] sm:text-xs font-medium focus:outline-none cursor-pointer"
            >
              {(Object.keys(THEME_PALETTES) as ColorTheme[]).map((themeKey) => (
                <option key={themeKey} value={themeKey} className="bg-slate-900 text-white">
                  {THEME_PALETTES[themeKey].name}
                </option>
              ))}
            </select>
          </div>

          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl border border-slate-700/60 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-sm flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
            title={isMuted ? '点击开启音效' : '点击静音'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* Main Dual-Column Non-Overlapping Layout */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden w-full relative">
        {/* Left Side: Dedicated 3D Rubik's Cube Stage */}
        <section className="flex-1 relative min-h-0 h-[44dvh] lg:h-full w-full overflow-hidden bg-gradient-to-br from-[#0B1020] via-[#0F172A] to-[#131B2E]">
          {/* 3D WebGL Canvas Layer */}
          <div ref={containerRef} className="w-full h-full touch-none cursor-grab active:cursor-grabbing" />

          {/* Unified Top Floating HUD Bar (never collides on mobile or desktop) */}
          <div className="absolute top-2.5 sm:top-3.5 inset-x-3 sm:inset-x-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none select-none">
            {/* Mode Status Capsule */}
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-[11px] sm:text-xs shadow-lg">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
              <span className="text-slate-200 font-medium whitespace-nowrap">
                {mode === 'paint' && (
                  <>
                    <span className="sm:hidden">📸 实景涂色</span>
                    <span className="hidden sm:inline">📸 实景魔方录入：点击小格上色</span>
                  </>
                )}
                {mode === 'tutor' && (
                  <>
                    <span className="sm:hidden">✨ AI 教学</span>
                    <span className="hidden sm:inline">✨ AI 手把手教学：分步慢速指导</span>
                  </>
                )}
                {mode === 'level' && `🏆 第 ${activeLevel?.id || 1} 关`}
                {mode === 'free' && (
                  <>
                    <span className="sm:hidden">🎲 自由竞速</span>
                    <span className="hidden sm:inline">🎲 随机竞速：自由打乱与计时</span>
                  </>
                )}
              </span>
            </div>

            {/* Right Group: Handheld Orientation Legend + Reset Camera */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto ml-auto">
              {/* Handheld Orientation Legend */}
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] shadow-lg whitespace-nowrap">
                <span className="hidden sm:inline text-slate-400 font-medium">基准:</span>
                <span className="flex items-center gap-0.5 sm:gap-1 font-semibold text-white">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white border border-slate-400 shadow-sm" />
                  <span>顶白</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-0.5 sm:gap-1 font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-sm" />
                  <span>前绿</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-0.5 sm:gap-1 font-semibold text-rose-400">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shadow-sm" />
                  <span>右红</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => engineRef.current?.alignCamera('HOME')}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full glass-panel border border-sky-400/30 text-sky-300 hover:text-white text-[11px] sm:text-xs font-semibold shadow-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
                title="一键将视角回正为白顶绿前红右标准双手持视角"
              >
                <span>🧭</span>
                <span className="hidden sm:inline">回正视角</span>
                <span className="sm:hidden">回正</span>
              </button>
            </div>
          </div>

          {/* Floating Bottom: Collapsible Quick Turn Bar (only shown in free & level play modes) */}
          {(mode === 'free' || mode === 'level') && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 sm:left-4 sm:translate-x-0 z-20 pointer-events-auto">
              <QuickTurnBar engine={engineRef.current} />
            </div>
          )}
        </section>

        {/* Right / Bottom Side: Dedicated Non-Overlapping Work Control Panel */}
        <aside className="w-full lg:w-[410px] xl:w-[440px] shrink-0 h-[50dvh] sm:h-[52dvh] lg:h-full overflow-y-auto border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-900/80 backdrop-blur-xl p-3 sm:p-4 flex flex-col">
          {/* MODE 1: Real-Cube Paint Panel */}
          {mode === 'paint' && (
            <RealCubePaintPanel
              onAlignCamera={(view) => engineRef.current?.alignCamera(view)}
              onEnterTutor={() => {
                store.setState({ mode: 'tutor' });
              }}
            />
          )}

          {/* MODE 2: AI Step-by-Step Tutor Control Console */}
          {mode === 'tutor' && (
            <TutorControlPanel
              engine={engineRef.current}
              onExitTutor={() => store.setState({ mode: 'free' })}
              onGoToLevels={() => {
                setShowLevelSelect(true);
              }}
            />
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

          {/* MODE 4: Free & Speedrun Panel */}
          {mode === 'free' && (
            <SpeedrunPanel
              engine={engineRef.current}
              onAlignCamera={(view) => engineRef.current?.alignCamera(view)}
            />
          )}
        </aside>
      </main>

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
