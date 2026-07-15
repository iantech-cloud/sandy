'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Menu, MessageCircle } from 'lucide-react';
import Link from 'next/link';

type GameState = 'waiting' | 'running' | 'crashed';

export default function AviatorGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  // Clock state
  const [clock, setClock] = useState('08:23');

  // Game state
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(2 + Math.random() * 15);
  const [playerCount, setPlayerCount] = useState(386);

  // Bet state
  const [balance, setBalance] = useState(5000);
  const [bets, setBets] = useState({ 1: 10, 2: 10 });
  const [betPlaced, setBetPlaced] = useState({ 1: false, 2: false });
  const [history, setHistory] = useState<string[]>([]);

  const MIN_BET = 10;
  const MAX_BET = 5000;
  const W = 400;
  const H = 420;

  // Clock update
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      setClock(`${h}:${m}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize history
  useEffect(() => {
    const generateHistory = () => {
      const hist: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = Math.random();
        let val: number;
        if (r < 0.65) val = 1 + Math.random() * 2;
        else if (r < 0.9) val = 2 + Math.random() * 6;
        else val = 8 + Math.random() * 40;
        hist.push(val.toFixed(2));
      }
      setHistory(hist);
    };

    generateHistory();
  }, []);

  // Format number
  const fmt = (n: number) => n.toFixed(2);

  // Adjust bet
  const adjustBet = (id: 1 | 2, dir: number) => {
    setBets((prev) => ({
      ...prev,
      [id]: Math.min(MAX_BET, Math.max(MIN_BET, prev[id] + dir * 10)),
    }));
  };

  // Set bet
  const setBetAmount = (id: 1 | 2, val: number) => {
    setBets((prev) => ({ ...prev, [id]: val }));
  };

  // Place bet
  const placeBet = (id: 1 | 2) => {
    if (gameState === 'waiting') {
      setBetPlaced((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  // Calculate path for curve
  const generatePath = (t: number) => {
    const steps = 60;
    let fillPath = `M 0 ${H}`;
    let linePath = `M 0 ${H}`;

    for (let i = 0; i <= steps; i++) {
      const p = (i / steps) * t;
      const x = p * W;
      const y = H - Math.pow(p, 1.6) * (H * 0.92);
      fillPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      linePath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    fillPath += ` L ${(t * W).toFixed(1)} ${H} Z`;
    return { fill: fillPath, line: linePath };
  };

  // Position plane
  const updatePlanePosition = (t: number) => {
    if (!planeRef.current) return;
    const x = t * W - 20;
    const y = H - Math.pow(t, 1.6) * (H * 0.92) - 30;
    planeRef.current.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(-10, y)}px) rotate(-18deg)`;
    planeRef.current.style.opacity = '1';
  };

  // Draw SVG curve
  const drawCurve = (t: number) => {
    if (!canvasRef.current) return;
    const paths = generatePath(t);
    const fillPath = canvasRef.current.querySelector('#curveFill') as SVGPathElement;
    const linePath = canvasRef.current.querySelector('#curveLine') as SVGPathElement;
    if (fillPath) fillPath.setAttribute('d', paths.fill);
    if (linePath) linePath.setAttribute('d', paths.line);
  };

  // Crash game
  const crash = useCallback(() => {
    setGameState('crashed');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (planeRef.current) {
      planeRef.current.style.opacity = '0';
    }

    setBetPlaced({ 1: false, 2: false });

    // Generate new history
    const r = Math.random();
    let val: number;
    if (r < 0.65) val = 1 + Math.random() * 2;
    else if (r < 0.9) val = 2 + Math.random() * 6;
    else val = 8 + Math.random() * 40;

    setHistory((prev) => [val.toFixed(2), ...prev.slice(0, 9)]);
    setPlayerCount(Math.floor(300 + Math.random() * 200));

    setTimeout(resetRound, 2200);
  }, []);

  // Game tick
  const tick = useCallback(
    (now: number, startTime: number) => {
      if (gameState !== 'running') return;

      const elapsed = (now - startTime) / 1000;
      const newMult = 1 + elapsed * elapsed * 0.18 + elapsed * 0.35;

      if (newMult >= crashPoint) {
        crash();
        return;
      }

      setMultiplier(newMult);

      const t = Math.min(1, elapsed / 6);
      drawCurve(t);
      updatePlanePosition(t);

      rafRef.current = requestAnimationFrame((n) => tick(n, startTime));
    },
    [gameState, crashPoint, crash]
  );

  // Start round
  const startRound = useCallback(() => {
    setGameState('running');
    setCrashPoint(1.2 + Math.pow(Math.random(), 2.2) * 30);
    setMultiplier(1.0);

    const startTime = performance.now();
    rafRef.current = requestAnimationFrame((n) => tick(n, startTime));
  }, [tick]);

  // Reset round
  const resetRound = useCallback(() => {
    setGameState('waiting');
    setMultiplier(1.0);

    if (planeRef.current) {
      planeRef.current.style.transform = `translate(-40px, ${H - 30}px) rotate(-18deg)`;
      planeRef.current.style.opacity = '1';
    }

    // Clear canvas
    const fillPath = canvasRef.current?.querySelector('#curveFill') as SVGPathElement;
    const linePath = canvasRef.current?.querySelector('#curveLine') as SVGPathElement;
    if (fillPath) fillPath.setAttribute('d', '');
    if (linePath) linePath.setAttribute('d', '');

    setTimeout(startRound, 2500);
  }, [startRound]);

  // Initialize game
  useEffect(() => {
    resetRound();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resetRound]);

  const colorFor = (v: string) => {
    const val = parseFloat(v);
    if (val < 2) return 'text-blue-400';
    if (val < 10) return 'text-purple-400';
    return 'text-pink-400';
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Status Bar */}
      <div className="flex justify-between items-center px-4 py-2 text-xs text-white">
        <span>{clock}</span>
        <div className="flex items-center gap-1 text-gray-400">
          <span>🔕</span>
          <span>14.0 KB/s</span>
          <span>4G+</span>
          <span>📶</span>
          <div className="w-5 h-3 border border-gray-400 rounded px-0.5">
            <div className="w-1 h-full bg-orange-500 rounded"></div>
          </div>
        </div>
      </div>

      {/* Top Nav */}
      <div className="flex items-center justify-center relative py-3">
        <Link href="/dashboard/gaming" className="absolute left-4 text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold text-white">Aviator</h1>
      </div>

      {/* Game Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
            <div className="w-5 h-5 bg-white rounded-sm"></div>
          </div>
          <div className="font-bold text-red-500 text-2xl italic">Aviator</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-white font-bold">KES {balance.toFixed(2)}</div>
          <button className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-gray-300">
            💬
          </button>
          <button className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-gray-300">
            ☰
          </button>
        </div>
      </div>

      {/* Challenge Banner */}
      <div className="mx-3 my-2 rounded-3xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-0.5">
        <div className="bg-slate-900 rounded-3xl px-3 py-2 flex items-center gap-2">
          <div className="border border-green-500 text-green-500 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
            <span>▶</span> LIVE
          </div>
          <div className="flex-1 text-sm font-semibold text-white">
            Takeoff Challenge. <b>Collect multiplier 75x</b>
          </div>
          <div className="w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold flex-shrink-0">
            →
          </div>
        </div>
      </div>

      {/* History Strip */}
      <div className="flex gap-4 overflow-x-auto px-4 py-2 text-sm font-bold scrollbar-hide">
        {history.map((v, i) => (
          <span key={i} className={colorFor(v)}>
            {v}x
          </span>
        ))}
        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-gray-400 flex-shrink-0 ml-auto">
          ⋯
        </div>
      </div>

      {/* Game Stage */}
      <div className="relative mx-2 mb-2 h-96 bg-gradient-to-b from-purple-900 via-slate-900 to-black rounded-lg overflow-hidden">
        {/* Rays background */}
        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: 'repeating-conic-gradient(from 0deg at 58% 68%, rgba(255,255,255,0.05) 0deg 4deg, transparent 4deg 12deg)',
        }}></div>

        {/* SVG Curve */}
        <svg ref={canvasRef} className="absolute inset-0 w-full h-full" viewBox="0 0 400 420" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e42b3c" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#3a0810" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <path id="curveFill" fill="url(#fillGrad)" />
          <path id="curveLine" fill="none" stroke="#ff3b4e" strokeWidth="4" strokeLinecap="round" />
        </svg>

        {/* Plane */}
        <div
          ref={planeRef}
          className="absolute w-16 h-16 z-40"
          style={{
            transform: `translate(-40px, ${H - 30}px) rotate(-18deg)`,
            filter: 'drop-shadow(0 0 10px rgba(228,43,60,0.7))',
          }}
        >
          <svg viewBox="0 0 64 64" className="w-full h-full">
            <path d="M4 46 L40 46 L58 24 L52 22 L38 34 L20 30 L12 20 L6 22 L14 34 L4 38 Z" fill="#e42b3c" />
          </svg>
        </div>

        {/* Multiplier Display */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
          <div className={`text-7xl font-black transition-colors ${
            gameState === 'crashed' ? 'text-red-500' : 'text-white'
          }`} style={{
            textShadow: gameState === 'crashed' ? 'none' : '0 0 40px rgba(180,60,255,0.9), 0 0 12px rgba(255,255,255,0.4)',
          }}>
            {multiplier.toFixed(2)}x
          </div>
        </div>

        {/* Status Message */}
        {gameState === 'crashed' && (
          <div className="absolute left-1/2 top-1/3 transform -translate-x-1/2 -translate-y-1/2 z-30 text-center">
            <div className="text-2xl font-bold text-red-500">FLEW AWAY!</div>
          </div>
        )}

        {/* Players */}
        <div className="absolute right-3 bottom-3 z-50 flex items-center bg-black/35 px-2.5 py-1 rounded-full">
          <div className="flex">
            {['🐯', '🐼', '🦁'].map((emoji, i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 -ml-2 first:ml-0 bg-slate-600 flex items-center justify-center text-xs">
                {emoji}
              </div>
            ))}
          </div>
          <span className="ml-2 text-white font-bold text-sm">{playerCount}</span>
        </div>
      </div>

      {/* Bet Panels */}
      <div className="space-y-3 px-3 pb-3">
        {[1, 2].map((id) => (
          <div key={id} className="bg-slate-800 rounded-2xl p-3">
            <div className="flex bg-slate-900 rounded-2xl p-1 mb-3">
              <button className="flex-1 bg-slate-700 text-white font-bold py-2 rounded-2xl text-sm">Bet</button>
              <button className="flex-1 text-gray-500 font-bold py-2 text-sm">Auto</button>
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-slate-900 rounded-2xl flex items-center justify-between px-2 py-1.5">
                <button onClick={() => adjustBet(id as 1 | 2, -1)} className="w-9 h-9 rounded-full bg-slate-700 text-white font-bold">−</button>
                <div className="text-2xl font-black text-white">{fmt(bets[id as 1 | 2])}</div>
                <button onClick={() => adjustBet(id as 1 | 2, 1)} className="w-9 h-9 rounded-full bg-slate-700 text-white font-bold">+</button>
              </div>

              <button
                onClick={() => placeBet(id as 1 | 2)}
                className={`flex-1 rounded-2xl font-bold text-sm flex flex-col items-center justify-center transition-all ${
                  betPlaced[id as 1 | 2]
                    ? 'bg-gradient-to-b from-amber-400 to-amber-600 shadow-lg shadow-amber-900'
                    : 'bg-gradient-to-b from-green-400 to-green-600 shadow-lg shadow-green-900'
                }`}
              >
                <span className="text-xs">{betPlaced[id as 1 | 2] ? 'Cancel' : 'Bet'}</span>
                <span className="text-lg">
                  {fmt(bets[id as 1 | 2])}<span className="text-xs">KES</span>
                </span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 200, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(id as 1 | 2, amount)}
                  className="bg-slate-900 text-gray-400 font-semibold py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors"
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Tabs */}
      <div className="flex bg-slate-900 rounded-2xl mx-3 mb-3 p-1">
        <button className="flex-1 bg-slate-700 text-white font-bold py-2 rounded-2xl text-sm">All Bets</button>
        <button className="flex-1 text-gray-500 font-bold py-2 text-sm">Previous</button>
        <button className="flex-1 text-gray-500 font-bold py-2 text-sm">Top</button>
      </div>

      {/* Home Bar */}
      <div className="flex justify-center py-2">
        <div className="w-32 h-1 rounded-full bg-gray-600"></div>
      </div>
    </div>
  );
}
