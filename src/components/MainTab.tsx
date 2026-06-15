/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, TrendingUp, AlertTriangle, PlayCircle, Layers, Sliders, CheckCircle, Activity, Sparkles, XCircle, BadgeAlert, Pause, Trash2, CheckCircle2, Pin, PinOff, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Candle, MarketTick, TradeLog, Position, BrainSignal, Alert } from '../types';
import TradingChart from './TradingChart';

interface MainTabProps {
  candlesNifty: Candle[];
  candlesCall: Candle[];
  candlesPut: Candle[];
  ticks: MarketTick[];
  tradeLogs: TradeLog[];
  positions: Position[];
  signals: BrainSignal[];
  addPosition: (pos: Position) => void;
  removePosition: (id: string) => void;
  exitAllPositions: () => void;
  genieInsights: string[];
  reloadingInsights: boolean;
  refreshInsights: () => void;
  oiDataNifty: { strike: number; call_oi: number; put_oi: number; call_oi_change: number; put_oi_change: number }[];
  supportResistance: { support: { strike: number; oi: number }[]; resistance: { strike: number; oi: number }[] };
  selectedCeStrike: string;
  selectedPeStrike: string;
  alerts: Alert[];
  pauseAlert: (id: string) => void;
  resumeAlert: (id: string) => void;
  deleteAlert: (id: string) => void;
}

export default function MainTab({
  candlesNifty,
  candlesCall,
  candlesPut,
  ticks = [],
  tradeLogs = [],
  positions = [],
  signals = [],
  addPosition,
  removePosition,
  exitAllPositions,
  genieInsights,
  reloadingInsights,
  refreshInsights,
  oiDataNifty,
  supportResistance,
  selectedCeStrike,
  selectedPeStrike,
  alerts = [],
  pauseAlert,
  resumeAlert,
  deleteAlert,
}: MainTabProps) {
  const [timeframeNifty, setTimeframeNifty] = useState<string>('1m');
  const [timeframeCall, setTimeframeCall] = useState<string>('1m');
  const [timeframePut, setTimeframePut] = useState<string>('1m');

  const [activeTabLogs, setActiveTabLogs] = useState<'brain' | 'trades'>('brain');

  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState<boolean | null>(null);

  // Auto-visibility rules: Stay open if pinned, OR if active positions exist (unless explicitly collapsed).
  // Otherwise, default to collapsed to keep the chart maximized.
  const isBottomVisible = isPinned || (positions.length > 0 && isManuallyCollapsed !== true) || isManuallyCollapsed === false;

  // Chart height expands dramatically to utilize the screen real estate when collapsed
  const chartHeight = isBottomVisible ? 210 : 570;

  // Multi-timeframe volatility markers mock overlay
  const niftyLTP = candlesNifty.length > 0 ? candlesNifty[candlesNifty.length - 1].close : 22150;
  const callLTP = candlesCall.length > 0 ? candlesCall[candlesCall.length - 1].close : 120.5;
  const putLTP = candlesPut.length > 0 ? candlesPut[candlesPut.length - 1].close : 105.0;

  // Option Buyer Risk Analytics
  const totalMarginUsed = positions.reduce((acc, p) => acc + p.avgPrice * p.qty * 50, 0); // 50 is NIFTY lot scaling
  const totalUnrealizedPnL = positions.reduce((acc, p) => acc + p.pnl, 0);

  // Instant ATM buy triggers for Home tab option buyer desk
  const triggerQuickBuy = (optionType: 'CE' | 'PE') => {
    const strikeBase = Math.round(niftyLTP / 50) * 50;
    const ltpVal = optionType === 'CE' ? callLTP : putLTP;
    const symbolStr = optionType === 'CE' ? selectedCeStrike || `NIFTY24JUN${strikeBase}CE` : selectedPeStrike || `NIFTY24JUN${strikeBase}PE`;

    const newPos: Position = {
      id: `pos-${Date.now()}`,
      symbol: symbolStr,
      strike: strikeBase,
      type: optionType,
      action: 'BUY',
      qty: 1, // 1 Lot
      avgPrice: ltpVal,
      ltp: ltpVal,
      pnl: 0,
    };
    addPosition(newPos);
  };

  return (
    <div className="space-y-1.5">
      {/* SECTION 1: SIDE-BY-SIDE SYNCHRONIZED CHARTS WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
        {/* Spot Chart */}
        <div className="lg:col-span-1 space-y-0.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-0.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              NIFTY SPOT
            </h3>
            <span className="text-[11px] text-sky-400 font-mono font-bold">₹{niftyLTP.toFixed(2)}</span>
          </div>
          <TradingChart
            symbol="NSE:NIFTY"
            candles={candlesNifty}
            oiData={oiDataNifty}
            supportResistance={supportResistance}
            timeframe={timeframeNifty}
            setTimeframe={setTimeframeNifty}
            height={chartHeight}
          />
        </div>

        {/* CE Option Chart */}
        <div className="lg:col-span-1 space-y-0.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-0.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              CE PREMIUM
            </h3>
            <span className="text-[10.5px] text-emerald-400 font-mono font-bold truncate max-w-[150px]">
              {selectedCeStrike || 'ATM Call'} @ ₹{callLTP.toFixed(2)}
            </span>
          </div>
          <TradingChart
            symbol={selectedCeStrike || "NIFTY_CE_ATM"}
            candles={candlesCall}
            timeframe={timeframeCall}
            setTimeframe={setTimeframeCall}
            ticks={ticks.filter((t) => t.instrumentKey.includes('CE'))}
            height={chartHeight}
          />
        </div>

        {/* PE Option Chart */}
        <div className="lg:col-span-1 space-y-0.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-0.5">
            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              PE PREMIUM
            </h3>
            <span className="text-[10.5px] text-rose-400 font-mono font-bold truncate max-w-[150px]">
              {selectedPeStrike || 'ATM Put'} @ ₹{putLTP.toFixed(2)}
            </span>
          </div>
          <TradingChart
            symbol={selectedPeStrike || "NIFTY_PE_ATM"}
            candles={candlesPut}
            timeframe={timeframePut}
            setTimeframe={setTimeframePut}
            ticks={ticks.filter((t) => t.instrumentKey.includes('PE'))}
            height={chartHeight}
          />
        </div>
      </div>

      {/* Sleek, Low-Profile Collapsible Terminal Dock Handle */}
      <div 
        onClick={() => setIsManuallyCollapsed(isBottomVisible ? true : false)}
        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all duration-200 mt-2 ${
          isBottomVisible
            ? 'bg-[#0d1323] border-[#1e293b] hover:border-slate-700'
            : 'bg-[#080d1a] border-dashed border-indigo-500/35 hover:border-indigo-400 hover:bg-[#0c1224]'
        }`}
      >
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 font-bold tracking-wider font-mono">
            <span className={`w-2 h-2 rounded-full ${isBottomVisible ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
            <span className={isBottomVisible ? 'text-slate-200' : 'text-indigo-400'}>
              TRADING DESK TERMINAL
            </span>
          </div>
          <div className="hidden sm:flex items-center space-x-2 font-mono text-[11px] text-slate-400">
            <span>•</span>
            <span>
              Positions:{' '}
              {positions.length > 0 ? (
                <span className={`font-bold ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {positions.length} ACTIVE (₹{totalUnrealizedPnL >= 0 ? '+' : ''}{totalUnrealizedPnL.toFixed(2)})
                </span>
              ) : (
                <span className="font-semibold text-slate-500">None</span>
              )}
            </span>
            <span>•</span>
            <span>
              Triggers: <span className="font-bold text-amber-500">{alerts.length} Active</span>
            </span>
            {!isBottomVisible && (
              <>
                <span>•</span>
                <span className="text-[10.5px] italic text-indigo-400 flex items-center gap-1">
                  Click bar to expand terminal controls
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action controllers on Right */}
        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
          {/* PIN Toggle */}
          <button
            onClick={() => setIsPinned(!isPinned)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10.5px] font-mono font-bold transition-all active:scale-95 border ${
              isPinned
                ? 'bg-blue-600/25 border-blue-500/80 text-blue-400 hover:bg-blue-600/35'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={isPinned ? 'Pin active: Panel will stay open' : 'Pin panel to keep it open'}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
            {isPinned ? 'PINNED' : 'PIN CONSOLE'}
          </button>

          {/* Toggle Panel button */}
          <button
            onClick={() => setIsManuallyCollapsed(isBottomVisible ? true : false)}
            className="p-1 rounded bg-slate-900 border border-slate-800 hover:text-white text-slate-400 transition-all"
            title={isBottomVisible ? 'Collapse Panel' : 'Expand Panel'}
          >
            {isBottomVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isBottomVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
            className="space-y-2.5 pt-1"
          >
            {/* QUICK INTRADAY OPTION BUYER ACTIONS RAIL */}
      <div className="flex flex-wrap items-center justify-between p-2 bg-[#0d1323] border border-[#1e293b] rounded-lg gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-semibold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            BUYER DESK:
          </span>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-[11px] text-slate-300">
            ATM Spot Strike:{' '}
            <span className="font-bold font-mono text-white">
              {Math.round(niftyLTP / 50) * 50}
            </span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => triggerQuickBuy('CE')}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded shadow transition-all active:scale-95 flex items-center gap-1"
            id="btn-quick-ce-buy"
          >
            <TrendingUp className="w-3 h-3" />
            BUY ATM CALL
          </button>
          <button
            onClick={() => triggerQuickBuy('PE')}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono rounded shadow transition-all active:scale-95 flex items-center gap-1"
            id="btn-quick-pe-buy"
          >
            <TrendingUp className="w-3 h-3 rotate-185" />
            BUY ATM PUT
          </button>
          <button
            onClick={exitAllPositions}
            disabled={positions.length === 0}
            className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
              positions.length > 0
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
            }`}
            id="btn-quick-panic-exit"
          >
            <XCircle className="w-3.5 h-3.5" />
            PANIC EXIT ALL
          </button>
        </div>
      </div>

      {/* SECTION 2: SIGNAL logs, LIVE EXECUTED TAPE, RISK MANAGEMENT & PNL BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* Left Area: Brain Signals vs Tape Logs */}
        <div className="lg:col-span-7 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2 flex flex-col h-[180px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 flex-shrink-0">
            <div className="flex items-center space-x-1 border border-slate-800 rounded bg-[#0b0f19] p-0.5">
              <button
                onClick={() => setActiveTabLogs('brain')}
                className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                  activeTabLogs === 'brain'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BRAIN SIGNAL LOGS
              </button>
              <button
                onClick={() => setActiveTabLogs('trades')}
                className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                  activeTabLogs === 'trades'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                LIVE TAPE STREAM
              </button>
            </div>

            {activeTabLogs === 'brain' && (
              <button
                onClick={refreshInsights}
                disabled={reloadingInsights}
                className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded border border-sky-500/15"
                title="Fetch Smart Genie insights from Option Chain metadata"
              >
                <Sparkles className={`w-3.5 h-3.5 ${reloadingInsights ? 'animate-spin' : ''}`} />
                {reloadingInsights ? 'RELOAD...' : 'AI GENIE'}
              </button>
            )}
          </div>

          {/* Tab 1: Live Psychology Alerts & AI Genie */}
          {activeTabLogs === 'brain' ? (
            <div className="flex-grow overflow-y-auto space-y-2 pr-1 custom-scroll">
              {/* Floating AI Genie Box */}
              {genieInsights.length > 0 && (
                <div className="p-2.5 bg-gradient-to-r from-blue-950/40 to-sky-950/40 border border-sky-800/40 rounded text-[11px] text-sky-200">
                  <div className="flex items-center gap-1.5 font-bold mb-1 text-sky-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI GENIE OPTION SENTIMENT REPORT
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    {genieInsights.map((ins, i) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Signals feed */}
              <div className="space-y-1.5">
                {signals.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                    Awaiting psychological confluence indicators from tape flow...
                  </div>
                ) : (
                  signals.map((sig) => (
                    <div
                      key={sig.id}
                      className={`p-2 rounded border text-xs flex justify-between gap-3 ${
                        sig.type.includes('ABSORPTION_CE') || sig.type === 'LONG'
                          ? 'bg-emerald-950/20 border-emerald-500/15 text-emerald-300'
                          : sig.type.includes('VACUUM_CE') || sig.type === 'SHORT'
                          ? 'bg-rose-950/20 border-rose-500/15 text-rose-300'
                          : 'bg-[#0f172a] border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <Activity className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold leading-tight">{sig.message}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{sig.time}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] py-0.5 px-1.5 rounded bg-slate-900 border border-slate-700/50 flex-shrink-0 h-fit">
                        CONF: {sig.strength}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Tab 2: High Speed Time & Sales Ticker */
            <div className="flex-grow overflow-y-auto space-y-1 pr-1 custom-scroll font-mono text-[11px]">
              <div className="grid grid-cols-12 text-slate-500 font-bold border-b border-slate-800/35 pb-1 flex-shrink-0 text-center">
                <span className="col-span-3 text-left">TIME</span>
                <span className="col-span-3 text-left">SYMBOL</span>
                <span className="col-span-3 text-right">PRICE (₹)</span>
                <span className="col-span-2 text-right">QTY</span>
                <span className="col-span-1 text-center">T</span>
              </div>
              {tradeLogs.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                  Waiting for tick data streams...
                </div>
              ) : (
                tradeLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`grid grid-cols-12 py-1 border-b border-slate-900/40 text-center items-center ${
                      log.aggressor === 'Buy'
                        ? 'text-emerald-400 bg-emerald-500/[0.02]'
                        : log.aggressor === 'Sell'
                        ? 'text-rose-400 bg-rose-500/[0.02]'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="col-span-3 text-slate-500 text-left">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span className="col-span-3 font-semibold text-left truncate">{log.symbol}</span>
                    <span className="col-span-3 font-bold text-right">{log.price.toFixed(2)}</span>
                    <span className="col-span-2 text-right">{log.quantity}</span>
                    <span
                      className={`col-span-1 font-bold ${
                        log.aggressor === 'Buy' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {log.aggressor === 'Buy' ? 'B' : log.aggressor === 'Sell' ? 'S' : 'N'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Area: Armed alert rules */}
        <div className="lg:col-span-5 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2 flex flex-col h-[180px]">
          <div className="border-b border-slate-800 pb-2 mb-2 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
              <BadgeAlert className="w-4 h-4 text-[#f43f5e]" />
              ACTIVE INTRA-DAY TRIGGER MONITOR
            </h3>
          </div>

          <div className="flex-grow overflow-y-auto pr-1 text-xs custom-scroll font-mono">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-center">
                <BadgeAlert className="w-6 h-6 text-slate-600 mb-1" />
                <span className="text-xs font-semibold text-slate-400">No armed option triggers active.</span>
                <span className="text-[10px] text-slate-600 mt-1">Define multi-leg spot alerts in ALERTS & LEGS tab.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-1.5 bg-[#0d1527] border border-slate-800 rounded-lg hover:border-slate-700 transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            al.status === 'active'
                              ? 'bg-emerald-500'
                              : al.status === 'paused'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span className="font-bold text-white text-[10.5px] truncate">{al.name}</span>
                      </div>
                      <span className="text-[9px] text-purple-400 block font-bold leading-none uppercase">
                        Rule: {al.condition}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {al.status === 'active' ? (
                        <button
                          onClick={() => pauseAlert(al.id)}
                          className="p-1 rounded bg-[#1e293b] hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-[10px]"
                          title="Pause alert"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => resumeAlert(al.id)}
                          className="p-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-white transition-all text-[10px]"
                          title="Resume alert"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => deleteAlert(al.id)}
                        className="p-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold hover:text-white transition-all text-[10px]"
                        title="Delete trigger rules"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
