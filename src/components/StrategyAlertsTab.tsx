/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, TrendingUp, AlertTriangle, AlertCircle, Compass, ShieldCheck, Sliders, Bell, BadgeAlert, Plus, CheckCircle2, Pause, Trash2, Layers, CheckCircle } from 'lucide-react';
import { Alert, Strategy, StrategyLeg, Position } from '../types';

interface StrategyAlertsTabProps {
  alerts: Alert[];
  addAlert: (alertInput: { name: string; alert_type: string; condition: string }) => void;
  deleteAlert: (id: string) => void;
  pauseAlert: (id: string) => void;
  resumeAlert: (id: string) => void;
  buildStrategyUrl: (type: string, data: any) => void;
  activeStrategy: Strategy | null;
  buildingStrategy: boolean;
  niftyLtp: number;
  positions?: Position[];
  removePosition?: (id: string) => void;
}

export default function StrategyAlertsTab({
  alerts = [],
  addAlert,
  deleteAlert,
  pauseAlert,
  resumeAlert,
  buildStrategyUrl,
  activeStrategy,
  buildingStrategy,
  niftyLtp,
  positions = [],
  removePosition,
}: StrategyAlertsTabProps) {
  // Option Buyer Risk Analytics
  const totalMarginUsed = positions.reduce((acc, p) => acc + p.avgPrice * p.qty * 50, 0); // 50 is NIFTY lot scaling
  const totalUnrealizedPnL = positions.reduce((acc, p) => acc + p.pnl, 0);

  // Alert form parameters
  const [alertName, setAlertName] = useState<string>('NIFTY Spot Price Breach');
  const [alertType, setAlertType] = useState<string>('PRICE');
  const [alertCondition, setAlertCondition] = useState<string>('price > 22250');
  const [alertMessage, setAlertMessage] = useState<string>('Spot price break above resistance 22250');

  // Strategy Builder Parameters
  const [selectedStrategyType, setSelectedStrategyType] = useState<string>('BULL_CALL_SPREAD');
  const [spotOverride, setSpotOverride] = useState<number>(niftyLtp);

  // Bull Call Spread Fields
  const [lowerStrike, setLowerStrike] = useState<number>(22000);
  const [higherStrike, setHigherStrike] = useState<number>(22300);
  const [lowerPremium, setLowerPremium] = useState<number>(120);
  const [higherPremium, setHigherPremium] = useState<number>(40);

  // Iron Condor Fields
  const [putSellStrike, setPutSellStrike] = useState<number>(21800);
  const [putBuyStrike, setPutBuyStrike] = useState<number>(21600);
  const [callSellStrike, setCallSellStrike] = useState<number>(22400);
  const [callBuyStrike, setCallBuyStrike] = useState<number>(22600);
  const [icPremiums, setIcPremiums] = useState({
    put_sell: 60,
    put_buy: 20,
    call_sell: 55,
    call_buy: 18,
  });

  const triggerBuildStrategy = () => {
    if (selectedStrategyType === 'BULL_CALL_SPREAD') {
      buildStrategyUrl('bull-call-spread', {
        underlying: 'NIFTY',
        spot_price: spotOverride || niftyLtp,
        lower_strike: lowerStrike,
        higher_strike: higherStrike,
        lower_premium: lowerPremium,
        higher_premium: higherPremium,
        expiry: '2026-06-25',
        quantity: 1,
      });
    } else if (selectedStrategyType === 'IRON_CONDOR') {
      buildStrategyUrl('iron-condor', {
        underlying: 'NIFTY',
        spot_price: spotOverride || niftyLtp,
        put_sell_strike: putSellStrike,
        put_buy_strike: putBuyStrike,
        call_sell_strike: callSellStrike,
        call_buy_strike: callBuyStrike,
        premiums: icPremiums,
        expiry: '2026-06-25',
        quantity: 1,
      });
    } else {
      // Long Straddle
      buildStrategyUrl('long-straddle', {
        underlying: 'NIFTY',
        spot_price: spotOverride || niftyLtp,
        strike: Math.round((spotOverride || niftyLtp) / 50) * 50,
        call_premium: 120.5,
        put_premium: 105.0,
        expiry: '2026-06-25',
        quantity: 1,
      });
    }
  };

  // Generate interactive SVG payoff graph data
  const generatePayoffPoints = () => {
    const points = [];
    const minRange = (spotOverride || niftyLtp) - 400;
    const maxRange = (spotOverride || niftyLtp) + 400;
    const steps = 30;
    const increment = (maxRange - minRange) / steps;

    for (let i = 0; i <= steps; i++) {
      const price = minRange + i * increment;
      let payoffVal = 0;

      if (selectedStrategyType === 'BULL_CALL_SPREAD') {
        // lowerStrike = Buy Call, higherStrike = Sell Call
        const lowerPayoff = Math.max(0, price - lowerStrike) - lowerPremium;
        const higherPayoff = -(Math.max(0, price - higherStrike) - higherPremium);
        payoffVal = (lowerPayoff + higherPayoff) * 50; // scaled by Lot size 50
      } else if (selectedStrategyType === 'IRON_CONDOR') {
        // Sell PUT put_sell_strike, Buy PUT put_buy_strike, Sell CALL call_sell_strike, Buy CALL call_buy_strike
        const putSellPayoff = icPremiums.put_sell - Math.max(0, putSellStrike - price);
        const putBuyPayoff = Math.max(0, putBuyStrike - price) - pcrHistoryPremium(icPremiums.put_buy);
        const callSellPayoff = icPremiums.call_sell - Math.max(0, price - callSellStrike);
        const callBuyPayoff = Math.max(0, price - callBuyStrike) - pcrHistoryPremium(icPremiums.call_buy);
        payoffVal = (putSellPayoff + putBuyPayoff + callSellPayoff + callBuyPayoff) * 50;
      } else {
        // STRADDLE: ATM base. Buy Call & Buy Put
        const strikeVal = Math.round((spotOverride || niftyLtp) / 50) * 50;
        const callPayoff = Math.max(0, price - strikeVal) - 120.5;
        const putPayoff = Math.max(0, strikeVal - price) - 105.0;
        payoffVal = (callPayoff + putPayoff) * 50;
      }

      points.push({ price, pnl: payoffVal });
    }
    return points;
  };

  const pcrHistoryPremium = (val: any) => Number(val) || 0;

  const payoffPoints = generatePayoffPoints();
  const maxPnlY = Math.max(...payoffPoints.map((p) => Math.abs(p.pnl))) || 5000;

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertName || !alertCondition) return;
    addAlert({
      name: alertName,
      alert_type: alertType,
      condition: alertCondition,
    });
    setAlertName('');
  };

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* ROW 1: OPTION STRATEGIST PAYOFF MODULE */}
        <div className="lg:col-span-8 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-3 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
              <Compass className="w-4 h-4 text-emerald-400" />
              Legs Payoff Curve visualizer
            </h3>

            {/* Strategy Select Toggle */}
            <div className="flex items-center space-x-1 border border-slate-800 rounded bg-[#0b0f19] p-0.5">
              {[
                { id: 'BULL_CALL_SPREAD', title: 'BULL SPREAD' },
                { id: 'IRON_CONDOR', title: 'IRON CONDOR' },
                { id: 'LONG_STRADDLE', title: 'LONG STRADDLE' },
              ].map((strat) => (
                <button
                  key={strat.id}
                  onClick={() => setSelectedStrategyType(strat.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all ${
                    selectedStrategyType === strat.id
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {strat.title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-grow">
            {/* Parameters Settings side */}
            <div className="md:col-span-4 p-2.5 bg-[#0b0f19] border border-slate-900 rounded-lg text-xs leading-relaxed space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block border-b border-slate-800 pb-1">
                Customize Option Legs:
              </span>

              {/* Spot Price custom override */}
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-mono">SPOT INDEX VALUE</label>
                <input
                  type="number"
                  value={spotOverride}
                  onChange={(e) => setSpotOverride(Number(e.target.value))}
                  className="w-full px-2 py-1 text-xs bg-[#070b14] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {selectedStrategyType === 'BULL_CALL_SPREAD' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">BUY CALL STRIKE</label>
                    <input
                      type="number"
                      value={lowerStrike}
                      onChange={(e) => setLowerStrike(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">BUY CE PREMIUM (₹)</label>
                    <input
                      type="number"
                      value={lowerPremium}
                      onChange={(e) => setLowerPremium(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-slate-800 rounded text-slate-300 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">SELL CALL STRIKE</label>
                    <input
                      type="number"
                      value={higherStrike}
                      onChange={(e) => setHigherStrike(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">SELL CE PREMIUM (₹)</label>
                    <input
                      type="number"
                      value={higherPremium}
                      onChange={(e) => setHigherPremium(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-slate-800 rounded text-slate-300 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {selectedStrategyType === 'IRON_CONDOR' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">PUT BUY STRIKE</label>
                    <input
                      type="number"
                      value={putBuyStrike}
                      onChange={(e) => setPutBuyStrike(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-[#1e293b] rounded text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">PUT SELL STRIKE</label>
                    <input
                      type="number"
                      value={putSellStrike}
                      onChange={(e) => setPutSellStrike(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-[#1e293b] rounded text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">CALL SELL STRIKE</label>
                    <input
                      type="number"
                      value={callSellStrike}
                      onChange={(e) => setCallSellStrike(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-[#1e293b] rounded text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono">CALL BUY STRIKE</label>
                    <input
                      type="number"
                      value={callBuyStrike}
                      onChange={(e) => setCallBuyStrike(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-[#070b14] border border-[#1e293b] rounded text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </>
              )}

              {selectedStrategyType === 'LONG_STRADDLE' && (
                <div className="text-[11px] text-slate-400 p-2 bg-sky-950/20 border border-sky-800/10 rounded">
                  ATM straddles buy CE and PE at the closest multiple of 50. Ideal for heavy volatility breakout events.
                </div>
              )}

              <button
                onClick={triggerBuildStrategy}
                disabled={buildingStrategy}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition-all active:scale-95 text-[11px] font-sans flex items-center justify-center gap-1.5"
              >
                <Sliders className="w-4 h-4" />
                {buildingStrategy ? 'ANALYZING...' : 'ANALYZE STRATEGY'}
              </button>
            </div>

            {/* Payoff visualization side */}
            <div className="md:col-span-8 flex flex-col justify-between">
              {/* Payoff Graph View wrapper (Custom SVG payoff plotting) */}
              <div className="relative bg-[#050912] border border-[#141d2f]/60 rounded-lg p-2 h-[220px]">
                <svg className="w-full h-full" viewBox="0 0 350 200">
                  {/* Zero price divider axis */}
                  <line x1="0" y1="100" x2="350" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />

                  {/* Draw polygon shades (Green for Profit, Red for Loss) */}
                  <path
                    d={`
                      M 15,${100 - (payoffPoints[0].pnl / maxPnlY) * 80}
                      ${payoffPoints
                        .map((pt, idx) => {
                          const x = 15 + idx * 11;
                          const y = 100 - (pt.pnl / maxPnlY) * 80;
                          return `L ${x},${y}`;
                        })
                        .join(' ')}
                      L 335,100
                      L 15,100
                      Z
                    `}
                    fill="url(#profitGradient)"
                    opacity="0.12"
                  />

                  {/* Main solid trend payload line */}
                  <path
                    d={`
                      M 15,${100 - (payoffPoints[0].pnl / maxPnlY) * 80}
                      ${payoffPoints
                        .map((pt, idx) => {
                          const x = 15 + idx * 11;
                          const y = 100 - (pt.pnl / maxPnlY) * 80;
                          return `L ${x},${y}`;
                        })
                        .join(' ')}
                    `}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.2"
                  />

                  {/* Center spot index vertical marker */}
                  <line x1="175" y1="15" x2="175" y2="185" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="1.2" strokeDasharray="2,2" />

                  {/* Profit shader variables definitions */}
                  <defs>
                    <linearGradient id="profitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#050912" />
                    </linearGradient>
                  </defs>

                  {/* Coordinates Markers on graph */}
                  <text x="178" y="30" fill="#38bdf8" fontSize="8" fontFamily="monospace">SPOT SPOT INDEX</text>
                  <text x="310" y="95" fill="#64748b" fontSize="8" fontFamily="monospace">0.00</text>
                  <text x="15" y="20" fill="#ef4444" fontSize="8" fontFamily="monospace">LOSS (-)</text>
                  <text x="15" y="190" fill="#10b981" fontSize="8" fontFamily="monospace">PROFIT (+)</text>
                </svg>

                {/* High definition overlay HUD payload */}
                {activeStrategy?.analysis && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-[#0b0f19]/90 border border-slate-800 rounded text-[9.5px] font-mono text-slate-300 space-x-2">
                    <span>
                      PROFIT: <strong className="text-emerald-400">UNLIMITED</strong>
                    </span>
                    <span>
                      MAX LOSS:{' '}
                      <strong className="text-rose-400">
                        ₹{(activeStrategy.analysis.max_loss || 4500).toLocaleString()}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Strategy Milestones Report */}
              <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-center text-xs">
                <div className="p-2 bg-[#0b0f19] border border-slate-900 rounded">
                  <span className="text-[9px] text-slate-500 uppercase block">MAX PROFIT TARGET</span>
                  <span className="font-bold text-emerald-400">₹7,500</span>
                </div>
                <div className="p-2 bg-[#0b0f19] border border-slate-900 rounded">
                  <span className="text-[9px] text-slate-500 uppercase block">MAX PROTECTION COLLATERAL</span>
                  <span className="font-bold text-rose-400">₹4,250</span>
                </div>
                <div className="p-2 bg-[#0b0f19] border border-slate-900 rounded">
                  <span className="text-[9px] text-slate-500 uppercase block">LEG EST. BREAKEVENS</span>
                  <span className="font-bold text-sky-400">₹22,082 / ₹22,395</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 1: DYNAMIC ALERTS CREATOR PANEL */}
        <div className="lg:col-span-4 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col min-h-[380px]">
          <div className="border-b border-slate-800 pb-1.5 mb-3 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
              <Bell className="w-4 h-4 text-sky-400" />
              CREATE PRICE/OI TRIGGER
            </h3>
          </div>

          {/* Form container */}
          <form onSubmit={handleCreateAlert} className="space-y-3 flex-grow text-xs leading-relaxed">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-mono block">TRIGGER IDENTIFIER</label>
              <input
                type="text"
                value={alertName}
                onChange={(e) => setAlertName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-sky-500 font-mono"
                placeholder="Alert ID..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-mono block">METRIC TYPE</label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0b0f19] border border-slate-850 rounded text-slate-300 focus:outline-none focus:border-sky-500 font-mono h-8"
              >
                <option value="PRICE">SPOT INDEX PRICE</option>
                <option value="PCR">PUT-CALL RATIO (PCR)</option>
                <option value="IV">IMPLIED VOLATILITY (IV)</option>
                <option value="OI">CONTRACT OI CHANGE</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-mono block">LOGGER CONDITION RULE</label>
              <input
                type="text"
                value={alertCondition}
                onChange={(e) => setAlertCondition(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-sky-500 font-mono"
                placeholder="price > 22250 or pcr < 0.8"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-mono block">TEMPLATE BROADCAST SMS</label>
              <textarea
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                className="w-full h-16 px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-sky-500 font-mono resize-none h-16"
                placeholder="Alert triggered template..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs font-sans mt-3"
            >
              <Plus className="w-4 h-4" />
              ARM ACTIVE TRIGGER
            </button>
          </form>
        </div>
      </div>

      {/* ROW 2: PORTFOLIO RISK & MARGIN MONITOR */}
      <div className="bg-[#080d1a] border border-[#1e293b] rounded-lg p-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-sky-400" />
          PORTFOLIO RISK & MARGIN MONITOR
        </h4>

        {/* Quick HUD Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3 font-mono">
          <div className="p-2.5 bg-[#0d1527] border border-slate-800 rounded flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase">MARGIN USED</span>
            <span className="text-sm font-bold text-white">
              ₹{totalMarginUsed.toLocaleString()}
            </span>
          </div>
          <div className="p-2.5 bg-[#0d1527] border border-slate-800 rounded flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase">ACTIVE CONTRACT LEGS</span>
            <span className="text-sm font-bold text-sky-400">{positions.length} Active</span>
          </div>
          <div className="p-2.5 bg-[#0d1527] border border-slate-800 rounded flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase">TOTAL UNREALIZED P&L</span>
            <span
              className={`text-sm font-bold ${
                totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalUnrealizedPnL >= 0 ? '+' : ''}
              ₹{totalUnrealizedPnL.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Position table list */}
        <div className="font-mono text-xs">
          {positions.length === 0 ? (
            <div className="p-8 bg-[#0b0f19] border border-slate-900 rounded text-center text-slate-500 flex flex-col items-center">
              <CheckCircle className="w-8 h-8 text-slate-600 mb-2" />
              <span>No open option contracts to report in portfolio risk ledger.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="p-3 bg-[#0d1527] border border-slate-800 hover:border-slate-700 rounded-lg flex items-center justify-between gap-3 hover:translate-y-[-1px] transition-all"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className={`px-1 rounded text-[9px] font-bold ${
                          pos.type === 'CE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {pos.type}
                      </span>
                      <span className="font-bold text-white text-[11px] truncate max-w-[140px]">{pos.symbol}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug">
                      <div>Qty: {pos.qty * 50} (1 lot)</div>
                      <div>Avg: ₹{pos.avgPrice.toFixed(1)} | LTP: ₹{pos.ltp.toFixed(1)}</div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`font-bold text-xs ${
                        pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pos.pnl >= 0 ? '+' : ''}
                      ₹{pos.pnl.toFixed(1)}
                    </span>
                    {removePosition && (
                      <button
                        onClick={() => removePosition(pos.id)}
                        className="text-[9px] px-2 py-0.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold rounded border border-rose-500/25 active:scale-95 transition-all"
                      >
                        EXIT LEG
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
