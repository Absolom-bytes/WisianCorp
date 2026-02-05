
import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { TOOLS_CONFIG, TOOL_CATEGORIES, ToolConfig } from './constants';
import { ThinkingIcon } from './components/Icons';
import DottedGlowBackground from './components/DottedGlowBackground';

// Types for persistent history
interface SavedResource {
  id: string;
  toolName: string;
  categoryName: string;
  content: string;
  timestamp: number;
}

declare global {
  interface Window {
    // Fixed: Using 'any' to avoid conflict with existing 'AIStudio' type definition in the environment
    aistudio?: any;
  }
}

function App() {
  const [activeCategory, setActiveCategory] = useState(TOOL_CATEGORIES[0].id);
  const [selectedTool, setSelectedTool] = useState<ToolConfig>(TOOLS_CONFIG[0]);
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState('');
  const [savedResources, setSavedResources] = useState<SavedResource[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [apiStatus, setApiStatus] = useState<'online' | 'error' | 'idle'>('idle');
  const [hasAccess, setHasAccess] = useState(false);
  
  const outputRef = useRef<HTMLDivElement>(null);

  // Load history on mount and check Auth
  useEffect(() => {
    const history = localStorage.getItem('wisian_history');
    if (history) {
      try {
        setSavedResources(JSON.parse(history));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    
    const checkAuth = async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setHasAccess(hasKey);
            setApiStatus(hasKey ? 'online' : 'idle');
        } else {
            // Fallback for environment injected key
            const hasKey = !!process.env.API_KEY;
            setHasAccess(hasKey);
            setApiStatus(hasKey ? 'online' : 'error');
        }
    };
    checkAuth();
  }, []);

  // Update selected tool when category changes
  useEffect(() => {
    const firstOfCat = TOOLS_CONFIG.find(t => t.categoryId === activeCategory);
    if (firstOfCat) setSelectedTool(firstOfCat);
  }, [activeCategory]);

  // Save history when updated
  useEffect(() => {
    localStorage.setItem('wisian_history', JSON.stringify(savedResources));
  }, [savedResources]);

  const filteredTools = TOOLS_CONFIG.filter(t => t.categoryId === activeCategory);

  const handleAuth = async () => {
      if (window.aistudio) {
          try {
              await window.aistudio.openSelectKey();
              // Protocol: Assume success after opening dialog to mitigate race conditions
              setHasAccess(true);
              setApiStatus('online');
              setTimeout(() => scrollToId('demo'), 500);
          } catch(e) {
              console.error("Auth failed", e);
              setApiStatus('error');
          }
      } else {
          // If no window.aistudio, we rely on environment process.env.API_KEY
          const hasKey = !!process.env.API_KEY;
          if (hasKey) {
            setHasAccess(true);
            setApiStatus('online');
          } else {
            alert("Security Clearance required. No API key detected in environment.");
          }
      }
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    
    if (!hasAccess && !process.env.API_KEY) {
      setOutput("### Access Denied\nWisian Corporation Protocol: Please authenticate to access the intelligence engine.");
      return;
    }

    setIsGenerating(true);
    setOutput('');
    
    const terminal = document.getElementById('terminal-view');
    if (terminal) {
      terminal.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
      // Create new instance right before call as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `
        You are Wisian, the proprietary AI engine of Wisian Corporation.
        Your mission is to democratize high-tier corporate intelligence for the South African education sector.
        Guidelines:
        - Output MUST be structured, professional, and authoritative.
        - Use South African English spelling and terminology.
        - Format as a high-end consultancy deliverable.
      `.trim();

      const userPrompt = `
        **Directive:** Execute the following task using the ${selectedTool.name} module.
        **Context:** ${promptInput || 'Standard operating procedure.'}
        **Core Task:** ${selectedTool.basePrompt}
      `.trim();

      const modelName = selectedTool.modelTier === 'pro' 
        ? 'gemini-3-pro-preview' 
        : 'gemini-3-flash-preview';

      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: 0.6,
        }
      });

      let accumulated = '';
      for await (const chunk of responseStream) {
        accumulated += chunk.text;
        setOutput(accumulated);
      }

      const newResource: SavedResource = {
        id: Date.now().toString(),
        toolName: selectedTool.name,
        categoryName: TOOL_CATEGORIES.find(c => c.id === activeCategory)?.name || '',
        content: accumulated,
        timestamp: Date.now(),
      };
      setSavedResources(prev => [newResource, ...prev].slice(0, 15));
    } catch (error: any) {
      console.error("Generation error:", error);
      // Reset key selection state if "Requested entity was not found" error occurs as per guidelines
      if (error?.message?.includes('Requested entity was not found')) {
        setHasAccess(false);
        setApiStatus('error');
        if (window.aistudio) {
           await window.aistudio.openSelectKey();
           setHasAccess(true);
           setApiStatus('online');
        }
      }
      const msg = error?.message?.includes('API_KEY') 
        ? "### Authentication Failed\nSecurity Protocol: API Key invalid or missing. Please reconnect."
        : "### Network Interruption\nThe Wisian Link is experiencing latency. Retrying connection...";
      setOutput(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  const downloadResource = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wisian-corp-${selectedTool.id}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printResource = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Wisian Corp Asset - ${selectedTool.name}</title>
            <style>
              body { font-family: sans-serif; padding: 50px; line-height: 1.5; color: #111; max-width: 800px; margin: 0 auto; }
              h1, h2, h3 { color: #000; border-bottom: 3px solid #000; padding-bottom: 8px; margin-top: 30px; }
            </style>
          </head>
          <body>
            ${output.replace(/\n/g, '<br/>').replace(/### (.*)/g, '<h3>$1</h3>').replace(/\*\* (.*)\*\*/g, '<strong>$1</strong>')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const shareResource = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Wisian Corporation: ${selectedTool.name}`,
          text: output.slice(0, 100) + "...",
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const clearHistory = () => {
    if (confirm("Purge vault? This action is irreversible.")) {
      setSavedResources([]);
      localStorage.removeItem('wisian_history');
    }
  };

  const loadFromHistory = (resource: SavedResource) => {
    setOutput(resource.content);
    setShowHistory(false);
    scrollToId('terminal-view');
  };

  const scrollToId = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-purple-200 scroll-smooth">
      {/* Navbar */}
      <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 h-20 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-full flex justify-between items-center">
              <div className="flex items-center gap-4 group cursor-pointer" onClick={scrollToTop}>
                  <div className="bg-slate-900 p-2.5 rounded-xl group-hover:bg-purple-600 transition-colors shadow-lg">
                      <i className="fa-solid fa-diamond text-white text-xl"></i>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-2xl tracking-tighter uppercase text-slate-900 leading-none">Wisian</span>
                    <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-purple-600">Corporation</span>
                  </div>
              </div>
              <div className="hidden md:flex items-center gap-8">
                  <button onClick={() => scrollToId('demo')} className="text-sm font-bold text-slate-600 hover:text-purple-600 transition uppercase tracking-wide">Intelligence Engine</button>
                  <button onClick={() => setShowHistory(true)} className="text-sm font-bold text-slate-600 hover:text-purple-600 transition flex items-center gap-2 uppercase tracking-wide">Vault</button>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${apiStatus === 'online' ? 'text-teal-600' : 'text-red-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-teal-500 animate-pulse' : 'bg-red-500'}`}></span>
                    System {apiStatus === 'online' ? 'Active' : 'Offline'}
                  </div>
                  <a href="https://www.backabuddy.co.za/home" target="_blank" rel="noopener noreferrer" className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-purple-600 transition-all shadow-lg text-xs uppercase tracking-widest border border-slate-800">
                      Invest In Future
                  </a>
              </div>
          </div>
          <div className="sa-accent"></div>
      </nav>

      {/* Hero */}
      <header className="premium-gradient text-white py-32 relative overflow-hidden">
          <DottedGlowBackground opacity={0.3} gap={30} speedScale={0.2} color="rgba(255,255,255,0.1)" glowColor="rgba(255, 255, 255, 0.4)" />
          <div className="max-w-7xl mx-auto px-6 relative z-10 text-center lg:text-left">
              <div className="max-w-4xl mx-auto lg:mx-0">
                  <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-white/20">
                      <i className="fa-solid fa-bolt text-teal-400"></i>
                      <span>Powered by Gemini Intelligence</span>
                  </div>
                  <h1 className="text-6xl lg:text-8xl font-black mb-8 leading-[0.95] tracking-tight">
                      Intelligence <br/><span className="wisian-accent italic">Democratized.</span>
                  </h1>
                  <p className="text-xl lg:text-2xl text-slate-200 mb-12 leading-relaxed font-medium max-w-2xl">
                      Wisian Corporation delivers elite corporate-grade AI infrastructure to the South African public education sector. 
                  </p>
                  <div className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start">
                      {hasAccess ? (
                        <button onClick={() => scrollToId('demo')} className="bg-white text-slate-900 px-10 py-5 rounded-xl font-black text-lg hover:scale-105 transition shadow-2xl flex items-center justify-center gap-3">
                            <i className="fa-solid fa-microchip"></i> ACCESS ENGINE
                        </button>
                      ) : (
                        <button onClick={handleAuth} className="bg-teal-500 text-slate-900 px-10 py-5 rounded-xl font-black text-lg hover:bg-teal-400 hover:scale-105 transition shadow-2xl shadow-teal-500/30 flex items-center justify-center gap-3 animate-pulse">
                            <i className="fa-solid fa-key"></i> CONNECT INTELLIGENCE
                        </button>
                      )}
                      <button onClick={() => scrollToId('strategic-impact')} className="border border-white/30 bg-white/5 backdrop-blur-sm text-white px-10 py-5 rounded-xl font-black text-lg hover:bg-white/10 transition flex items-center justify-center">
                          MISSION BRIEF
                      </button>
                  </div>
              </div>
          </div>
          <div className="absolute -right-20 -bottom-40 w-[800px] h-[800px] bg-purple-500/30 blur-[150px] rounded-full mix-blend-overlay"></div>
      </header>

      {/* Impact Ticker */}
      <div className="bg-slate-900 py-6 text-white/50 text-[10px] font-black uppercase tracking-[0.3em] overflow-hidden whitespace-nowrap border-b border-slate-800 relative z-20">
        <div className="flex gap-24 animate-marquee items-center">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-24 items-center">
              <span className="flex items-center gap-3"><i className="fa-solid fa-check-circle text-teal-500"></i> CAPS Compliant</span>
              <span className="flex items-center gap-3"><span className="text-purple-500">PRO Model</span> Active</span>
              <span className="flex items-center gap-3">Wisian Corp</span>
              <span className="flex items-center gap-3"><i className="fa-solid fa-shield-halved text-red-500"></i> Enterprise Security</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sandbox Demo */}
      <section id="demo" className="py-24 bg-slate-50 scroll-mt-20 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-purple-600 font-black tracking-widest text-xs uppercase mb-4 block">System Interface</span>
            <h2 className="text-5xl font-black mb-6 text-slate-900">The Wisian Sandbox</h2>
            <p className="text-slate-500 text-xl max-w-2xl mx-auto leading-relaxed text-center">
              Select a module below to engage the generative engine.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 bg-white rounded-[2rem] p-4 lg:p-12 border border-slate-200 shadow-2xl relative overflow-hidden">
            
            {/* Security Overlay */}
            {!hasAccess && (
              <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 animate-slide-in">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-8 border border-slate-700 shadow-xl">
                      <i className="fa-solid fa-lock text-red-500 text-4xl"></i>
                  </div>
                  <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">Security Clearance Required</h3>
                  <p className="text-slate-400 max-w-md mb-8 leading-relaxed">The Wisian Intelligence Engine requires a verified Google Gemini API key to operate. Please authenticate to proceed.</p>
                  <button onClick={handleAuth} className="bg-teal-500 text-slate-900 px-8 py-4 rounded-xl font-black text-lg hover:bg-teal-400 hover:scale-105 transition-all shadow-xl shadow-teal-500/20 flex items-center gap-3 uppercase tracking-wider">
                    <i className="fa-brands fa-google"></i> Connect via AI Studio
                  </button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="mt-8 text-xs text-slate-500 hover:text-white transition underline decoration-slate-700 underline-offset-4">
                    View Billing Documentation
                  </a>
              </div>
            )}

            {/* Controls */}
            <div className={`lg:col-span-4 space-y-8 transition-all duration-500 ${!hasAccess ? 'blur-sm opacity-50 pointer-events-none' : ''}`}>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">1. Division</label>
                <div className="grid grid-cols-2 gap-3">
                  {TOOL_CATEGORIES.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`p-4 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-3 border ${activeCategory === cat.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-purple-200 hover:bg-white'}`}
                    >
                      <i className={`fa-solid ${cat.icon} text-2xl ${activeCategory === cat.id ? 'text-teal-400' : 'text-slate-300'}`}></i>
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">2. Module</label>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredTools.map(tool => (
                    <button 
                      key={tool.id}
                      onClick={() => setSelectedTool(tool)}
                      className={`w-full text-left p-4 rounded-xl text-sm font-bold border transition-all group ${selectedTool.id === tool.id ? 'border-purple-500 bg-purple-50 text-purple-900 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span>{tool.name}</span>
                        {selectedTool.id === tool.id && <i className="fa-solid fa-circle-check text-purple-500"></i>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded ${tool.modelTier === 'pro' ? 'bg-slate-900 text-teal-400' : 'bg-slate-200 text-slate-500'}`}>
                          {tool.modelTier === 'pro' ? 'Gemini Pro' : 'Gemini Flash'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">3. Input Parameters</label>
                <div className="space-y-4">
                  <textarea 
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Enter specific variables..."
                    className="w-full p-5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none h-32 transition-all resize-none font-medium text-slate-700 text-sm"
                  />
                  <div className="bg-teal-50 border border-teal-100 p-4 rounded-xl">
                    <button onClick={() => setPromptInput(selectedTool.examplePrompt)} className="text-[10px] font-black bg-teal-500 text-white px-3 py-1 rounded hover:bg-teal-600 transition-all uppercase tracking-wide">Auto-Inject</button>
                    <p className="text-xs text-teal-800 font-medium italic mt-2 opacity-80">{selectedTool.examplePrompt}</p>
                  </div>
                </div>
              </div>

              <button onClick={handleGenerate} disabled={isGenerating} className={`w-full py-5 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-4 shadow-xl uppercase tracking-wider ${isGenerating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-purple-600 active:scale-95'}`}>
                {isGenerating ? <ThinkingIcon /> : <i className="fa-solid fa-bolt"></i>}
                {isGenerating ? 'Processing...' : 'Initialize'}
              </button>
            </div>

            {/* Output Display */}
            <div id="terminal-view" className={`lg:col-span-8 bg-white rounded-[2rem] border border-slate-200 shadow-inner overflow-hidden flex flex-col min-h-[750px] relative transition-all duration-500 ${!hasAccess ? 'blur-sm opacity-50' : ''}`}>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-purple-500 to-teal-500 z-10"></div>
              <div className="bg-slate-50 px-8 py-4 text-slate-600 flex justify-between items-center border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">Wisian Output Terminal v2.1</span>
                </div>
                {output && !isGenerating && (
                  <div className="flex items-center gap-2">
                    <button onClick={copyToClipboard} className="text-[10px] font-bold text-slate-500 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded transition uppercase flex items-center gap-2">
                      <i className={showCopySuccess ? "fa-solid fa-check text-green-500" : "fa-regular fa-copy"}></i> Copy
                    </button>
                    <button onClick={downloadResource} className="text-[10px] font-bold bg-purple-600 text-white hover:bg-purple-500 px-4 py-1.5 rounded transition uppercase">Export</button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar bg-white relative">
                <div ref={outputRef} className="max-w-3xl mx-auto h-full">
                  {!output && !isGenerating && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-32">
                      <i className="fa-solid fa-layer-group text-4xl text-slate-300 mb-8"></i>
                      <h3 className="text-2xl font-black text-slate-900">System Ready</h3>
                    </div>
                  )}
                  {isGenerating && !output && (
                    <div className="h-full flex flex-col items-center justify-center py-32 gap-10">
                      <div className="w-48 h-48 flex items-center justify-center animate-wisian-pulse">
                         <svg viewBox="0 0 200 200" className="w-full h-full text-slate-900" fill="currentColor">
                            <path d="M60,150 Q70,170 100,170 Q130,170 140,150 L140,100 Q140,60 100,60 Q60,60 60,100 Z" />
                            <path d="M100,60 L100,10 M85,60 L75,20 M115,60 L125,20 M70,70 L50,35 M130,70 L150,35 M60,90 L35,65 M140,90 L165,65" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                            <circle cx="115" cy="110" r="10" fill="white" />
                         </svg>
                      </div>
                      <div className="text-center">
                         <p className="text-slate-900 font-black tracking-[0.4em] text-xs animate-pulse mb-3 uppercase">Decrypting Intelligence...</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Protocol: {selectedTool.modelTier === 'pro' ? 'Gemini 3 Pro' : 'Gemini 3 Flash'}</p>
                      </div>
                    </div>
                  )}
                  <div className="markdown-content">
                    {output.split('\n').map((line, i) => {
                      if (line.startsWith('###')) {
                        return <h3 key={i} className="text-2xl font-black text-slate-900 mt-12 mb-6 border-l-4 border-purple-500 pl-4">{line.replace('###', '').trim()}</h3>;
                      }
                      if (line.startsWith('**')) {
                        return <p key={i} className="font-bold text-slate-800 text-lg mb-2 mt-6 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>{line.replace(/\*\*/g, '').trim()}</p>;
                      }
                      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                        return <li key={i} className="ml-4 mb-3 text-slate-600 list-none flex items-start gap-3"><span className="text-purple-400 mt-1.5 text-[8px]"><i className="fa-solid fa-circle"></i></span>{line.replace(/^[-*]/, '').trim()}</li>;
                      }
                      return line.trim() ? <p key={i} className="mb-5 text-slate-600 leading-relaxed font-medium text-base text-justify">{line}</p> : <div key={i} className="h-2"></div>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strategic Impact */}
      <section id="strategic-impact" className="py-24 bg-slate-900 text-white border-t border-slate-800 relative overflow-hidden">
        <DottedGlowBackground color="rgba(168, 85, 247, 0.1)" glowColor="rgba(20, 184, 166, 0.4)" speedScale={0.2} />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <h2 className="text-5xl font-black mb-8 leading-tight">Closing the <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-purple-400 to-teal-400 italic">Excellence Gap.</span></h2>
          <div className="grid lg:grid-cols-2 gap-20">
            <div className="space-y-10">
              <div className="flex gap-6 group">
                <div className="w-12 h-12 border border-slate-700 bg-slate-800 rounded-xl flex items-center justify-center text-white text-xl font-black group-hover:border-purple-500 transition-colors">1</div>
                <div>
                  <h4 className="text-xl font-bold mb-2 text-white">National Digital Infrastructure</h4>
                  <p className="text-slate-400 font-medium leading-relaxed text-sm">Providing a state-of-the-art AI ecosystem designed specifically for the South African education landscape.</p>
                </div>
              </div>
              <div className="flex gap-6 group">
                <div className="w-12 h-12 border border-slate-700 bg-slate-800 rounded-xl flex items-center justify-center text-white text-xl font-black group-hover:border-purple-500 transition-colors">2</div>
                <div>
                  <h4 className="text-xl font-bold mb-2 text-white">Strategic Empowerment</h4>
                  <p className="text-slate-400 font-medium leading-relaxed text-sm">By treating every Principal as a CEO, we inject elite corporate productivity methods into school management.</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-md rounded-[3rem] p-12 border border-white/5 shadow-2xl">
              <h3 className="text-2xl font-black mb-8">Implementation Protocol</h3>
              <p className="text-slate-400 mb-10 leading-relaxed">By 2026, Wisian aims to reduce administrative burden by 60%, returning millions of hours to direct classroom teaching.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700"><div className="text-3xl font-black text-white mb-2">Free</div><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Public Access</div></div>
                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700"><div className="text-3xl font-black text-teal-400">85%</div><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Efficiency Boost</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Side Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in p-8">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black text-slate-900">Intelligence Vault</h2>
              <button onClick={() => setShowHistory(false)} className="bg-slate-100 p-2 rounded-full"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {savedResources.map(res => (
                <div key={res.id} onClick={() => loadFromHistory(res)} className="p-5 rounded-xl border border-slate-100 hover:border-purple-400 hover:shadow-lg cursor-pointer bg-white group">
                  <div className="flex justify-between items-start mb-2"><span className="text-[9px] font-black uppercase bg-slate-100 px-2 py-1 rounded">{res.categoryName}</span></div>
                  <h4 className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors text-sm">{res.toolName}</h4>
                </div>
              ))}
            </div>
            <button onClick={clearHistory} className="w-full py-4 text-xs font-black text-red-500 uppercase mt-4">Purge Vault</button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-500 py-20 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-16">
              <div className="md:col-span-5">
                  <div className="flex items-center gap-4 mb-6 group cursor-pointer" onClick={scrollToTop}>
                      <div className="bg-slate-800 p-2 rounded-lg border border-slate-700"><i className="fa-solid fa-diamond text-teal-400 text-lg"></i></div>
                      <div className="flex flex-col">
                        <span className="font-black text-xl tracking-tighter uppercase text-white leading-none">Wisian</span>
                        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-slate-500">Corporation</span>
                      </div>
                  </div>
                  <p className="text-sm leading-relaxed max-w-sm font-medium text-slate-400">Wisian is a National Interest project dedicated to the digital transformation of public education in South Africa.</p>
              </div>
              <div className="md:col-span-7 text-right">
                  <p className="text-xs font-bold text-slate-600 mb-4">© 2024 Wisian Corporation. All rights reserved.</p>
                  <p className="text-[10px] text-slate-700 italic">Built for the children of the Rainbow Nation.</p>
              </div>
          </div>
      </footer>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
