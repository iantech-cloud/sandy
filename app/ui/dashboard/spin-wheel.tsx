import { useState, useEffect } from 'react';
import { Award, Gift, Loader2, TrendingUp, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

// Prize configuration - 10 rewards total
const PRIZE_CONFIG = [
  { type: 'BONUS_CREDIT', color: '#4ECDC4', icon: '💰', segment: 1, label: 'Bonus Credit' },
  { type: 'EXTRA_SPIN', color: '#FF6B6B', icon: '🎟️', segment: 2, label: 'Free Spin' },
  { type: 'AIRTIME', color: '#45B7D1', icon: '📱', segment: 3, label: 'Airtime' },
  { type: 'SURVEY_BOOST', color: '#98D8C8', icon: '🧾', segment: 4, label: 'Survey Boost' },
  { type: 'REFERRAL_BONUS', color: '#96CEB4', icon: '🧭', segment: 5, label: 'Referral Bonus' },
  { type: 'MYSTERY_REWARD', color: '#F7DC6F', icon: '🎲', segment: 6, label: 'Mystery Reward' },
  { type: 'COURSE_ACCESS', color: '#FFEAA7', icon: '🧠', segment: 7, label: 'Free Course' },
  { type: 'COMMISSION_BOOST', color: '#BB8FCE', icon: '💎', segment: 8, label: 'Commission Boost' },
  { type: 'BADGE_UNLOCK', color: '#E8DAEF', icon: '👑', segment: 9, label: 'Badge' },
  { type: 'ZERO', color: '#CCCCCC', icon: '⭕', segment: 10, label: 'Try Again' }
];

interface SpinWheelProps {
  userId: string;
  onSpinComplete?: (result: any) => void;
}

export default function SpinWheel({ userId, onSpinComplete }: SpinWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinStatus, setSpinStatus] = useState<any>(null);
  const [spinWallet, setSpinWallet] = useState<any>(null);
  const [error, setError] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  // Fetch initial data
  useEffect(() => {
    loadSpinData();
  }, []);

  const loadSpinData = async () => {
    setLoading(true);
    try {
      // Fetch available prizes
      const prizesRes = await fetch('/api/spin/prizes');
      const prizesData = await prizesRes.json();
      
      if (prizesData.success) {
        setPrizes(prizesData.data);
      }

      // Check spin activation status
      const statusRes = await fetch('/api/spin/status');
      const statusData = await statusRes.json();
      setSpinStatus(statusData);

      // Fetch spin wallet balance
      const walletRes = await fetch('/api/spin-wallet/balance');
      const walletData = await walletRes.json();
      if (walletData.success) {
        setSpinWallet(walletData);
      }

    } catch (err) {
      console.error('[v0] Error loading spin data:', err);
      setError('Failed to load spin data');
    } finally {
      setLoading(false);
    }
  };

  const handleSpinClick = () => {
    // Check if user has sufficient balance
    if (!spinWallet || spinWallet.balance_cents < (SPIN_COST_KES * 100)) {
      setShowDepositModal(true);
      return;
    }
    
    performSpin();
  };

  const performSpin = async () => {
    if (spinning) return;

    setSpinning(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/spin/perform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        setSpinning(false);
        return;
      }

      // Calculate rotation based on prize
      const prizeIndex = PRIZE_CONFIG.findIndex(p => p.type === data.prizeType);
      const segmentAngle = 360 / PRIZE_CONFIG.length;
      const targetRotation = 360 * 5 + (prizeIndex * segmentAngle);
      
      setRotation(targetRotation);

      // Wait for animation and data refresh
      setTimeout(async () => {
        setResult(data);
        setSpinning(false);
        await loadSpinData();
        
        if (onSpinComplete) {
          onSpinComplete(data);
        }
      }, 2000);

    } catch (err) {
      console.error('[v0] Spin error:', err);
      setError('An error occurred while spinning');
      setSpinning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading Spin Wheel...</p>
        </div>
      </div>
    );
  }

  const SPIN_COST_KES = 30;
  const canSpin = spinStatus?.active && 
                  spinWallet && 
                  spinWallet.balance_cents >= (SPIN_COST_KES * 100);

  // Helper function to create proper wheel segments
  const createWheelSegment = (index: number, total: number) => {
    const anglePerSegment = 360 / total;
    const startAngle = index * anglePerSegment;
    const endAngle = (index + 1) * anglePerSegment;
    
    // Convert to radians for calculation
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    
    // Calculate points for the segment (as percentage from center)
    const x1 = 50 + 50 * Math.cos(startRad);
    const y1 = 50 + 50 * Math.sin(startRad);
    const x2 = 50 + 50 * Math.cos(endRad);
    const y2 = 50 + 50 * Math.sin(endRad);
    
    return {
      clipPath: `polygon(50% 50%, ${x1}% ${y1}%, ${x2}% ${y2}%)`,
      rotation: startAngle + anglePerSegment / 2
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Award className="w-12 h-12 text-yellow-400" />
            Spin to Win
          </h1>
          <p className="text-blue-200 text-lg">
            {spinStatus?.active ? 'Wheel is Active!' : 'Wheel is Currently Inactive'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Spin Wallet Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-yellow-300" />
              <h3 className="text-lg font-semibold text-white">Spin Wallet</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-blue-200">Balance:</span>
                <span className="text-2xl font-bold text-yellow-400">KES {spinWallet?.balance_kes || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-200">Cost per Spin:</span>
                <span className="text-white font-semibold">KES 30</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-200">Total Spins:</span>
                <span className="text-white font-semibold">{spinWallet?.total_spins || 0}</span>
              </div>
              {spinWallet && spinWallet.balance_cents < (SPIN_COST_KES * 100) && (
                <p className="text-sm text-orange-300 mt-3 font-semibold">
                  Insufficient balance. Deposit via M-Pesa to spin.
                </p>
              )}
            </div>
          </div>

          {/* How to Spin Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-green-300" />
              <h3 className="text-lg font-semibold text-white">How to Spin</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold flex-shrink-0">1.</span>
                <span className="text-blue-200">Deposit KES 30 via M-Pesa to your spin wallet</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold flex-shrink-0">2.</span>
                <span className="text-blue-200">Click the spin button on the wheel</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold flex-shrink-0">3.</span>
                <span className="text-blue-200">Win amazing rewards every time!</span>
              </div>
            </div>
          </div>

          {/* Deposit Card */}
          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-md rounded-xl p-6 border border-orange-400/30">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6 text-orange-300" />
              <h3 className="text-lg font-semibold text-white">Quick Deposit</h3>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-blue-200 mb-3">
                Deposit KES 30 to spin and win amazing rewards!
              </p>
              <button
                onClick={() => setShowDepositModal(true)}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all transform hover:scale-105"
              >
                Deposit Now
              </button>
              <p className="text-xs text-gray-300">
                Balance: KES {spinWallet?.balance_kes || '0.00'}
              </p>
            </div>
          </div>
        </div>

        {/* Spin Wheel Container */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 mb-8">
          <div className="relative w-full max-w-lg mx-auto">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-red-500 drop-shadow-lg" />
            </div>

            {/* Wheel */}
            <div 
              className="relative w-full aspect-square rounded-full shadow-2xl border-8 border-yellow-400"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 2s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
              }}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                {prizes.map((prize, index) => {
                  const anglePerSegment = 360 / prizes.length;
                  const startAngle = index * anglePerSegment - 90;
                  const endAngle = (index + 1) * anglePerSegment - 90;
                  
                  const startRad = startAngle * Math.PI / 180;
                  const endRad = endAngle * Math.PI / 180;
                  
                  const x1 = 50 + 48 * Math.cos(startRad);
                  const y1 = 50 + 48 * Math.sin(startRad);
                  const x2 = 50 + 48 * Math.cos(endRad);
                  const y2 = 50 + 48 * Math.sin(endRad);
                  
                  const config = PRIZE_CONFIG.find(p => p.type === prize.type);
                  const midAngle = (startAngle + endAngle) / 2;
                  const textX = 50 + 30 * Math.cos(midAngle * Math.PI / 180);
                  const textY = 50 + 30 * Math.sin(midAngle * Math.PI / 180);
                  
                  return (
                    <g key={prize._id}>
                      <path
                        d={`M 50 50 L ${x1} ${y1} A 48 48 0 0 1 ${x2} ${y2} Z`}
                        fill={config?.color || '#ccc'}
                        stroke="white"
                        strokeWidth="0.5"
                      />
                      <text
                        x={textX}
                        y={textY - 3}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="8"
                        fill="white"
                        fontWeight="bold"
                        transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                      >
                        {config?.icon}
                      </text>
                      <text
                        x={textX}
                        y={textY + 4}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="2.5"
                        fill="white"
                        fontWeight="600"
                        transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                      >
                        {prize.display_name.length > 15 
                          ? prize.display_name.substring(0, 13) + '...'
                          : prize.display_name}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Center Circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg z-10 border-4 border-white">
                <Zap className="w-10 h-10 text-purple-900" />
              </div>
            </div>

            {/* Spin Button */}
            <button
              onClick={handleSpinClick}
              disabled={spinning}
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-8 py-4 rounded-full font-bold text-lg shadow-2xl transition-all transform ${
                !spinning
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-purple-900 hover:scale-110 hover:shadow-yellow-400/50'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }`}
            >
              {spinning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Spinning...
                </span>
              ) : (
                'SPIN NOW'
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4 text-center">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Result Modal */}
        {result && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-yellow-400 animate-pulse">
              <div className="text-6xl mb-4">
                {PRIZE_CONFIG.find(p => p.type === result.prizeType)?.icon || '🎁'}
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {result.prizeType === 'TRY_AGAIN' ? 'Try Again!' : 'Congratulations!'}
              </h2>
              <p className="text-xl text-yellow-300 mb-4 font-semibold">
                {result.prizeName}
              </p>
              {result.prizeValue > 0 && (
                <p className="text-lg text-white/90 mb-6">
                  Value: KES {(result.prizeValue / 100).toFixed(2)}
                </p>
              )}
              <p className="text-white/80 mb-6">{result.prizeDescription}</p>
              <button
                onClick={() => setResult(null)}
                className="bg-white text-purple-900 px-8 py-3 rounded-full font-bold hover:bg-yellow-400 transition-colors"
              >
                Awesome!
              </button>
            </div>
          </div>
        )}

        {/* Prize Legend */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 text-center">Available Prizes</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {prizes.slice(0, 8).map((prize) => {
              const config = PRIZE_CONFIG.find(p => p.type === prize.type);
              return (
                <div 
                  key={prize._id}
                  className="bg-white/5 rounded-lg p-3 text-center border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="text-3xl mb-1">{config?.icon}</div>
                  <div className="text-xs text-white font-medium">{prize.display_name}</div>
                  <div className="text-xs text-blue-300 mt-1">{prize.base_probability}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-yellow-400">
            <h2 className="text-3xl font-bold text-white mb-4 text-center">
              Deposit to Spin
            </h2>
            
            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <p className="text-white text-center mb-2">Amount to deposit:</p>
              <p className="text-4xl font-bold text-yellow-400 text-center">KES 30</p>
              <p className="text-sm text-blue-300 text-center mt-2">Cost per spin</p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-sm text-blue-200 mb-1">Current Balance:</p>
                <p className="text-2xl font-bold text-white">KES {spinWallet?.balance_kes || '0.00'}</p>
              </div>

              <div>
                <label className="block text-white text-sm font-semibold mb-2">
                  M-Pesa Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="254712345678"
                  maxLength="12"
                  className="w-full bg-white/20 border-2 border-white/40 rounded-lg px-4 py-2 text-white placeholder-blue-300/50 focus:outline-none focus:border-yellow-400"
                />
                <p className="text-xs text-blue-300 mt-1">
                  Enter your M-Pesa registered number (format: 254XXXXXXXXX)
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!phoneNumber || phoneNumber.length < 10) {
                  setError('Please enter a valid phone number');
                  return;
                }

                setDepositLoading(true);
                try {
                  const response = await fetch('/api/spin-wallet/deposit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      phoneNumber: phoneNumber,
                      amount_cents: 3000 
                    })
                  });
                  
                  const data = await response.json();
                  if (data.success) {
                    console.log('[v0] Deposit initiated:', data);
                    setError('');
                    setPhoneNumber('');
                    setShowDepositModal(false);
                    // Reload wallet data after deposit
                    await loadSpinData();
                  } else {
                    setError(data.message || 'Failed to initiate deposit');
                  }
                } catch (err) {
                  console.error('[v0] Deposit error:', err);
                  setError('Failed to initiate deposit. Please try again.');
                } finally {
                  setDepositLoading(false);
                }
              }}
              disabled={depositLoading || !phoneNumber}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all mb-3"
            >
              {depositLoading ? 'Processing...' : 'Request M-Pesa STK'}
            </button>

            <button
              onClick={() => {
                setShowDepositModal(false);
                setPhoneNumber('');
              }}
              disabled={depositLoading}
              className="w-full bg-white/20 hover:bg-white/30 disabled:bg-white/10 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <p className="text-xs text-blue-300 text-center mt-3">
              You will receive an M-Pesa prompt on your phone to enter your PIN
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
