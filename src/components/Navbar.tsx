/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Pause, RefreshCw, Layers, Sliders, Radio, HardDrive, Wifi, ShieldAlert, Cpu } from 'lucide-react';
import { TradingMode } from '../types';

interface NavbarProps {
  mode: TradingMode;
  setMode: (m: TradingMode) => void;
  underlying: string;
  setUnderlying: (u: string) => void;
  latency: number;
  isConnected: boolean;
  startReplay: (startTime: string, speed: number) => void;
  stopReplay: () => void;
  isReplayRunning: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({
  mode,
  setMode,
  underlying,
  setUnderlying,
  latency,
  isConnected,
  startReplay,
  stopReplay,
  isReplayRunning,
  activeTab,
  setActiveTab,
}: NavbarProps) {
  const [replayStart, setReplayStart] = useState<string>('2026-06-14T09:15:00+05:30');
  const [replaySpeed, setReplaySpeed] = useState<number>(1);

  const handleStartReplayClick = () => {
    startReplay(replayStart, replaySpeed);
  };

  return (
    <div className="space-y-1.5">
      {/* Primary Header Header */}
      <header className="flex flex-col lg:flex-row items-center justify-between px-3 py-1.5 bg-[#080d1a] border border-[#1e293b] rounded-lg gap-2">
        {/* Visual Launcher Brand (Strictly literal labels) */}
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-xs font-extrabold text-slate-100 uppercase tracking-tight leading-none flex items-center gap-1">
              PRODESK
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                OPTIONS
              </span>
            </h1>
            <span className="text-[9px] text-slate-500 font-mono block">NSE NIFTY INTRA-DAY DESK</span>
          </div>
        </div>

        {/* Dynamic Desktop Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-center p-0.5 border border-slate-800 rounded bg-[#0b0f19] gap-0.5">
          {[
            { id: 'home', title: 'HOME TRADING' },
            { id: 'options', title: 'OPTIONS INTRA' },
            { id: 'scalper', title: 'HFT SCALPER' },
            { id: 'orderflow', title: 'ORDER FLOW' },
            { id: 'charts', title: 'CHARTS MULTI' },
            { id: 'db', title: 'DUCKDB CLIENT' },
            { id: 'strategy', title: 'ALERTS & LEGS' },
          ].map((tab) => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`px-2.5 py-0.5 rounded text-[10px] font-sans font-bold transition-all ${
                 activeTab === tab.id
                   ? 'bg-blue-600 text-white'
                   : 'text-slate-400 hover:text-white hover:bg-slate-850/50'
               }`}
             >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Global Control Widgets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Index Selector */}
          <div className="flex items-center space-x-0.5 border border-slate-800 rounded bg-[#0b0f19] p-0.5 text-xs">
            {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map((idx) => (
              <button
                key={idx}
                onClick={() => setUnderlying(idx)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                  underlying === idx
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {idx}
              </button>
            ))}
          </div>

          {/* Mode Selector */}
          <div className="flex items-center space-x-0.5 border border-slate-800 rounded bg-[#0b0f19] p-0.5 text-xs">
            {(['LIVE', 'REPLAY', 'BACKTEST'] as TradingMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                  mode === m
                    ? m === 'LIVE'
                      ? 'bg-emerald-600 text-white'
                      : m === 'REPLAY'
                      ? 'bg-purple-600 text-white'
                      : 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Server status indicator wrapper */}
          <div className="flex items-center space-x-1 px-2 py-0.5 bg-[#0b0f19] border border-slate-850 rounded text-xs font-mono">
            <Wifi className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span className="text-[9.5px] font-bold text-slate-400">
              {isConnected ? `${latency}ms` : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* Synchronized Replay Controls (Only active when Operating in REPLAY Mode) */}
      {mode === 'REPLAY' && (
        <div className="py-1 px-2.5 bg-[#0d1323] border border-purple-900/35 rounded-lg flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] leading-none">
          <div className="flex items-center space-x-2">
            <Radio className="w-3.5 h-3.5 text-purple-450" />
            <span className="font-mono font-bold text-slate-300">TICK REPLAY PAYBACK UNIT:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Start point selector */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] text-slate-500 font-mono">CLOCK ISO</span>
              <input
                type="text"
                value={replayStart}
                onChange={(e) => setReplayStart(e.target.value)}
                className="px-2 py-0.5 bg-slate-900 border border-purple-800/40 rounded text-slate-200 outline-none focus:border-purple-500 font-mono text-[10px] w-[180px]"
              />
            </div>

            {/* Speed selection */}
            <div className="flex items-center space-x-1.5 border border-purple-900/40 rounded bg-slate-900 p-0.5">
              {[1, 2, 5, 10].map((sp) => (
                <button
                  key={sp}
                  onClick={() => setReplaySpeed(sp)}
                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono ${
                    replaySpeed === sp
                      ? 'bg-purple-600 text-white font-bold'
                      : 'text-slate-405 hover:text-white'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>

            {/* Play/Stop Trigger */}
            {isReplayRunning ? (
              <button
                onClick={stopReplay}
                className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono rounded shadow flex items-center gap-1 text-[10px]"
              >
                <Pause className="w-2.5 h-2.5" />
                STOP
              </button>
            ) : (
              <button
                onClick={handleStartReplayClick}
                className="px-2.5 py-0.5 bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono rounded shadow flex items-center gap-1 text-[10px]"
              >
                <Play className="w-2.5 h-2.5" />
                START
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
