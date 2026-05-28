import { useState, useEffect } from 'react';
import { Tab, ToolDef } from './types';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { TerminalEmulator } from './components/Terminal';
import { ToolsGrid } from './views/ToolsGrid';
import { Logbook } from './views/Logbook';
import { Resources } from './views/Resources';
import { Settings } from './views/Settings';
import { SplashScreen } from './components/SplashScreen';
import { AboutModal } from './components/AboutModal';
import { AnimatePresence } from 'motion/react';
import { initKotlinLogger } from './utils/kotlinLogger';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('tools');
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);

  useEffect(() => {
    initKotlinLogger();
  }, []);

  // Handle hardware back button for Tools
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If we go back and there's no tool state, but we had a tool open, close it
      if (activeTool && (!e.state || e.state.view !== 'tool')) {
        setActiveTool(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTool]);

  const handleSelectTool = (tool: ToolDef) => {
    setActiveTool(tool);
    window.history.pushState({ view: 'tool', id: tool.id }, '');
  };

  const handleCloseTool = () => {
    setActiveTool(null);
    if (window.history.state?.view === 'tool') {
      window.history.back();
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'tools': return 'PwnNet Tools';
      case 'logbook': return 'Logs';
      case 'resources': return 'Resources';
      case 'settings': return 'System';
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      <div className="flex flex-col h-[100dvh] w-full bg-obsidian text-neon-green font-mono overflow-hidden">
        <TopBar 
          title={getTitle()} 
          onTerminalToggle={activeTab === 'tools' ? () => setActiveTool(activeTool) : undefined} 
          onAboutClick={() => setShowAbout(true)}
        />
      
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {activeTab === 'tools' && <ToolsGrid onSelectTool={handleSelectTool} />}
        {activeTab === 'logbook' && <Logbook />}
        {activeTab === 'resources' && <Resources />}
        {activeTab === 'settings' && <Settings />}

        {activeTool && (
          <TerminalEmulator 
            tool={activeTool} 
            onClose={handleCloseTool} 
          />
        )}
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      <div className="shrink-0 z-50 relative bg-obsidian">
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} disabled={!!activeTool} />
      </div>
    </div>
    </>
  );
}
