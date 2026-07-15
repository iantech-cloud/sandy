'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { checkGameDepositStatus } from '@/app/actions/gaming-games';

const MIN_BET = 1000; // 10 KES in cents
const MAX_BET = 7000000; // 70,000 KES

export default function CrashGame() {
  const { data: session } = useSession();
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  // Game state
  const [balance, setBalance] = useState(0);
  const [bets, setBets] = useState({ 1: 1000, 2: 1000 }); // in cents
  const [betPlaced, setBetPlaced] = useState({ 1: false, 2: false });
  const [gameState, setGameState] = useState<'waiting' | 'running' | 'crashed'>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(2.0);
  const [history, setHistory] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(386);
  const [clock, setClock] = useState('08:23');

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const multRef = useRef(1.0);
  const startTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Update clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClock(`${h}:${m}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch balance
  useEffect(() => {
    if (!session?.user?.email) return;
    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/gaming/wallet');
        const data = await response.json();
        setBalance(data.balance_cents || 0);
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      }
    };
    fetchBalance();
  }, [session]);

  // Generate random multiplier history
  const generateRandomMultiplier = useCallback(() => {
    const r = Math.random();
    if (r < 0.65) return (1 + Math.random() * 2).toFixed(2);
    if (r < 0.9) return (2 + Math.random() * 6).toFixed(2);
    return (8 + Math.random() * 40).toFixed(2);
  }, []);

  // Initialize history
  useEffect(() => {
    const newHistory = Array.from({ length: 10 }, () => generateRandomMultiplier());
    setHistory(newHistory);
  }, [generateRandomMultiplier]);

  // Generate crash point
  const generateCrashPoint = useCallback(() => {
    return 1.2 + Math.pow(Math.random(), 2.2) * 30;
  }, []);

  // Draw SVG curve
  const drawCurve = useCallback((progress: number) => {
    if (!svgRef.current) return;

    const steps = 60;
    const W = 400;
    const H = 420;

    let fillPath = `M 0 ${H}`;
    let linePath = `M 0 ${H}`;

    for (let i = 0; i <= steps; i++) {
      const p = (i / steps) * progress;
      const x = p * W;
      const y = H - Math.pow(p, 1.6) * (H * 0.92);
      fillPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      if (i === 0) {
        linePath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        linePath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    fillPath += ` L ${(progress * W).toFixed(1)} ${H} Z`;

    const fillPath_ = svgRef.current.querySelector('#curveFill') as SVGPathElement;
    const linePath_ = svgRef.current.querySelector('#curveLine') as SVGPathElement;

    if (fillPath_) fillPath_.setAttribute('d', fillPath);
    if (linePath_) linePath_.setAttribute('d', linePath);
  }, []);

  // Position plane
  const positionPlane = useCallback((progress: number) => {
    if (!planeRef.current) return;

    const W = 400;
    const H = 420;
    const x = progress * W - 20;
    const y = H - Math.pow(progress, 1.6) * (H * 0.92) - 30;

    planeRef.current.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(-10, y)}px) rotate(-18deg)`;
  }, []);

  // Game tick
  const tick = useCallback((now: number) => {
    if (gameState !== 'running') return;

    const elapsed = (now - (startTimeRef.current || now)) / 1000;
    const newMult = 1 + elapsed * elapsed * 0.18 + elapsed * 0.35;

    if (newMult >= crashPoint) {
      crash();
      return;
    }

    multRef.current = newMult;
    setMultiplier(newMult);

    const t = Math.min(1, elapsed / 6);
    drawCurve(t);
    positionPlane(t);

    rafIdRef.current = requestAnimationFrame(tick);
  }, [gameState, crashPoint, drawCurve, positionPlane]);

  // Reset round
  const resetRound = useCallback(() => {
    setGameState('waiting');
    setMultiplier(1.0);
    multRef.current = 1.0;
    setBetPlaced({ 1: false, 2: false });

    // Clear SVG
    const fillPath = svgRef.current?.querySelector('#curveFill') as SVGPathElement;
    const linePath = svgRef.current?.querySelector('#curveLine') as SVGPathElement;
    if (fillPath) fillPath.setAttribute('d', '');
    if (linePath) linePath.setAttribute('d', '');

    // Reset plane
    if (planeRef.current) {
      planeRef.current.style.transform = `translate(-40px, 390px) rotate(-18deg)`;
      planeRef.current.style.opacity = '1';
    }

    // Update player count
    setPlayerCount(Math.floor(300 + Math.random() * 200));

    // Start next round
    setTimeout(startRound, 2500);
  }, []);

  // Start round
  const startRound = useCallback(() => {
    setGameState('running');
    const newCrashPoint = generateCrashPoint();
    setCrashPoint(newCrashPoint);
    startTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(tick);
  }, [generateCrashPoint, tick]);

  // Crash
  const crash = useCallback(() => {
    setGameState('crashed');
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    // Update history
    const newHistory = [multiplier.toFixed(2) + 'x', ...history.slice(0, 9)];
    setHistory(newHistory);

    // Hide plane
    if (planeRef.current) {
      planeRef.current.style.opacity = '0';
    }

    setTimeout(resetRound, 2200);
  }, [multiplier, history, resetRound]);

  // Initialize game
  useEffect(() => {
    resetRound();
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (gameLoopRef.current) clearTimeout(gameLoopRef.current);
    };
  }, []);

  // Bet handlers
  const adjustBet = (panelId: number, direction: number) => {
    setBets(prev => ({
      ...prev,
      [panelId]: Math.min(MAX_BET, Math.max(MIN_BET, prev[panelId] + direction * 1000))
    }));
  };

  const setBet = (panelId: number, amount: number) => {
    setBets(prev => ({ ...prev, [panelId]: amount * 100 })); // Convert KES to cents
  };

  const placeBet = (panelId: number) => {
    if (gameState !== 'waiting' && gameState !== 'running') return;
    setBetPlaced(prev => ({ ...prev, [panelId]: !prev[panelId] }));
  };

  const getColorForMultiplier = (value: number): string => {
    if (value < 2) return 'text-[#4da3ff]'; // blue
    if (value < 10) return 'text-[#c58cff]'; // purple
    return 'text-[#ff6fb0]'; // pink
  };

  return (
    <div className="min-h-screen bg-[#0e0b14]">
      {/* Status Bar */}
      <div className="flex justify-between items-center px-4 pt-2 text-sm font-semibold text-white">
        <span id="clock">{clock}</span>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>🔕</span>
          <span>14.0 KB/s</span>
          <span>4G+</span>
          <span>📶</span>
        </div>
      </div>

      {/* Top Nav */}
      <div className="flex items-center justify-center relative p-3">
        <Link href="/dashboard/gaming" className="absolute left-4 text-xl text-white cursor-pointer">
          ✕
        </Link>
        <h1 className="text-lg font-semibold">Aviator</h1>
      </div>

      {/* Game Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-purple-800 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <rect x="3" y="3" width="18" height="18" rx="5" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div className="font-bold text-2xl text-red-500" style={{ fontStyle: 'italic' }}>Aviator</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-base font-bold text-white">{(balance / 100).toFixed(2)} KES</div>
          <button className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-gray-400">💬</button>
          <button className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-gray-400">☰</button>
        </div>
      </div>

      {/* Challenge Banner */}
      <div className="mx-3 my-2 p-0.5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-blue-500">
        <div className="bg-gray-900 rounded-full px-3 py-2 flex items-center gap-2">
          <div className="border border-green-400 text-green-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <span>▶</span> LIVE
          </div>
          <div className="flex-1 text-sm font-semibold text-gray-200">
            Takeoff Challenge. <b>Collect multiplier 75x</b>
          </div>
          <div className="w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold">→</div>
        </div>
      </div>

      {/* History Strip */}
      <div className="flex items-center gap-4 px-3 py-2 overflow-x-auto scrollbar-hide text-sm font-bold">
        {history.map((value, i) => (
          <span key={i} className={getColorForMultiplier(parseFloat(value))}>
            {value}
          </span>
        ))}
        <div className="ml-auto w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 flex-shrink-0">⋯</div>
      </div>

      {/* Game Stage */}
      <div className="relative mx-0 mb-2 h-96 bg-gradient-radial overflow-hidden" style={{
        background: 'radial-gradient(circle at 55% 60%, #3a1550 0%, #1a0e28 38%, #0a0812 75%)'
      }}>
        {/* Rays background */}
        <div className="absolute inset-0 opacity-50" style={{
          background: 'repeating-conic-gradient(from 0deg at 58% 68%, rgba(255,255,255,0.05) 0deg 4deg, transparent 4deg 12deg)'
        }}></div>

        {/* SVG Curve */}
        <svg ref={svgRef} viewBox="0 0 400 420" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e42b3c" stopOpacity="0.85"/>
              <stop offset="100%" stopColor="#3a0810" stopOpacity="0.65"/>
            </linearGradient>
          </defs>
          <path id="curveFill" d="" fill="url(#fillGrad)"/>
          <path id="curveLine" d="" fill="none" stroke="#ff3b4e" strokeWidth="4" strokeLinecap="round"/>
        </svg>

        {/* Plane */}
        <div ref={planeRef} className="absolute z-10 w-16 h-16" style={{
          filter: 'drop-shadow(0 0 10px rgba(228,43,60,0.7))',
          transform: 'translate(-40px, 390px) rotate(-18deg)',
          transition: 'none'
        }}>
          <svg viewBox="0 0 64 64">
            <path d="M4 46 L40 46 L58 24 L52 22 L38 34 L20 30 L12 20 L6 22 L14 34 L4 38 Z" fill="#e42b3c"/>
          </svg>
        </div>

        {/* Multiplier Display */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="text-6xl font-black text-white" style={{
            textShadow: '0 0 40px rgba(180,60,255,0.9), 0 0 12px rgba(255,255,255,0.4)',
            letterSpacing: '-1px',
            transition: gameState === 'crashed' ? 'color 0.15s' : 'none',
            color: gameState === 'crashed' ? '#e42b3c' : '#fff'
          }}>
            {multiplier.toFixed(2)}x
          </div>
        </div>

        {/* Players */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black bg-opacity-35 px-3 py-1 rounded-full z-20">
          <div className="flex">
            {['🐯', '🐼', '🦁'].map((emoji, i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-gray-900 bg-gray-700 flex items-center justify-center text-xs -ml-2 first:ml-0">
                {emoji}
              </div>
            ))}
          </div>
          <span className="ml-2 text-sm font-bold text-white">{playerCount}</span>
        </div>
      </div>

      {/* Bet Panels */}
      <div className="px-3 pb-2 space-y-2">
        {[1, 2].map(panelId => (
          <div key={panelId} className="bg-[#17131f] rounded-2xl p-3">
            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex gap-1 bg-gray-900 rounded-full p-1">
                <button className="flex-1 bg-gray-700 text-white text-sm font-bold py-2 rounded-full">Bet</button>
                <button className="flex-1 text-gray-400 text-sm font-bold py-2 rounded-full">Auto</button>
              </div>
              {panelId === 2 && (
                <button className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center">−</button>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center justify-between bg-gray-900 rounded-2xl px-2 py-1">
                <button onClick={() => adjustBet(panelId, -1)} className="w-9 h-9 rounded-full bg-gray-700 text-white font-bold">−</button>
                <div className="text-2xl font-black text-white">{(bets[panelId] / 100).toFixed(2)}</div>
                <button onClick={() => adjustBet(panelId, 1)} className="w-9 h-9 rounded-full bg-gray-700 text-white font-bold">+</button>
              </div>
              <button
                onClick={() => placeBet(panelId)}
                className={`flex-1 rounded-2xl font-bold text-white flex flex-col items-center justify-center py-3 ${
                  betPlaced[panelId]
                    ? 'bg-gradient-to-b from-yellow-500 to-yellow-600 shadow-lg'
                    : 'bg-gradient-to-b from-green-500 to-green-600 shadow-lg'
                }`}
              >
                <div className="text-sm">{betPlaced[panelId] ? 'Cancel' : 'Bet'}</div>
                <div className="text-lg">{(bets[panelId] / 100).toFixed(2)}<span className="text-xs ml-1">KES</span></div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[50, 100, 200, 500].map(amount => (
                <button
                  key={amount}
                  onClick={() => setBet(panelId, amount)}
                  className="bg-gray-900 text-gray-400 text-sm font-semibold py-2 rounded-xl"
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-full mx-3 mb-3 p-1">
        <button className="flex-1 bg-gray-700 text-white text-sm font-bold py-2 rounded-full">All Bets</button>
        <button className="flex-1 text-gray-400 text-sm font-bold py-2 rounded-full">Previous</button>
        <button className="flex-1 text-gray-400 text-sm font-bold py-2 rounded-full">Top</button>
      </div>

      {/* Home Bar */}
      <div className="flex justify-center py-2">
        <div className="w-32 h-1 rounded bg-gray-700"></div>
      </div>
    </div>
  );
}
