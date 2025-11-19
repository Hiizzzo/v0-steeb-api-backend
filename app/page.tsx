'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Zap, Shield, Cpu, ArrowRight, Activity, Code, Rocket, Star } from 'lucide-react';

export default function Home() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'SISTEMA DE NAVEGACIÓN MILANO ACTIVO. ¿CUÁL ES NUESTRA PRÓXIMA MISIÓN, QUILL?' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/steeb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      const data = await res.json();
      
      if (data.error) {
        setHistory(prev => [...prev, { role: 'assistant', content: `ERROR: ${data.error}` }]);
      } else {
        setHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { role: 'assistant', content: 'ERROR DE CONEXIÓN. EL SERVIDOR NO RESPONDE.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none z-0" />
      <div className="fixed inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none z-0" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/40 bg-background/50 backdrop-blur-md sticky top-0">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
            <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-md">
              <Rocket size={20} fill="currentColor" />
            </div>
            GUARDIANS<span className="text-muted-foreground font-normal">NET</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Misiones</a>
            <a href="#console" className="hover:text-primary transition-colors">Comms</a>
            <a href="#docs" className="hover:text-primary transition-colors">Archivos Nova</a>
          </nav>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noreferrer"
            className="text-xs font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-full transition-colors"
          >
            v.G.O.T.G.3
          </a>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-20 pb-32 px-4">
          <div className="container mx-auto max-w-5xl text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono mb-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              MILANO SYSTEMS ONLINE
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-glow animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
              GUARDIANES DE <br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-primary">LA GALAXIA</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              Protegiendo el universo (y cobrando por ello). 
              <br />
              Sistema de comunicación intergaláctico seguro.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
              <a 
                href="#console"
                className="h-12 px-8 rounded-md bg-primary text-primary-foreground font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Terminal size={18} />
                Iniciar Transmisión
              </a>
              <a 
                href="#docs"
                className="h-12 px-8 rounded-md border border-border bg-background hover:bg-secondary transition-colors font-medium flex items-center gap-2"
              >
                <Star size={18} />
                Ver Recompensas
              </a>
            </div>
          </div>
        </section>

        {/* Console Section */}
        <section id="console" className="py-20 px-4 bg-secondary/30 border-y border-border/50">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="text-primary" />
                Canal Seguro Nova
              </h2>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/10">
              <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                <span className="text-xs font-mono text-muted-foreground">rocket@milano-ship:~</span>
                <span className="text-xs font-mono text-green-500">● Encrypted</span>
              </div>
              
              <div 
                ref={scrollRef}
                className="h-[400px] overflow-y-auto p-6 font-mono text-sm space-y-4 scroll-smooth"
              >
                {history.map((msg, i) => (
                  <div key={i} className={`flex gap-4 ${msg.role === 'assistant' ? 'text-primary' : 'text-foreground'}`}>
                    <span className="opacity-50 select-none shrink-0">
                      {msg.role === 'assistant' ? '>' : '$'}
                    </span>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-4 text-primary">
                    <span className="opacity-50 select-none">&gt;</span>
                    <span className="animate-pulse">_ Consultando a Groot...</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-white/10 p-4 bg-white/5">
                <div className="flex gap-2 items-center">
                  <span className="text-green-500 font-mono">$</span>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Envía un mensaje a la tripulación..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-foreground font-mono placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                  <button 
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="p-2 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Cpu className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Tecnología Rocket</h3>
                <p className="text-muted-foreground">
                  Armamento pesado y algoritmos explosivos. Si no funciona, lo hacemos explotar.
                </p>
              </div>
              
              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Shield className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Escudo Groot</h3>
                <p className="text-muted-foreground">
                  Yo soy Groot. (Traducción: Seguridad impenetrable de nivel vegetal).
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Zap className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Velocidad Drax</h3>
                <p className="text-muted-foreground">
                  Nada se le escapa. Sus reflejos son demasiado rápidos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-12 px-4 bg-secondary/20">
          <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-bold text-lg">
              <div className="w-6 h-6 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
                <Rocket size={14} fill="currentColor" />
              </div>
              GUARDIANS
            </div>
            <p className="text-sm text-muted-foreground text-center md:text-right">
              © 2025 GUARDIANS NET. No somos responsables si presionas el botón rojo.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
