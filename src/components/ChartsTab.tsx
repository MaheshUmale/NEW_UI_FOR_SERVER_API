/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Grid, Maximize2, RefreshCw, LayoutGrid, Sliders, Play, Search, Columns, Trello } from 'lucide-react';
import { Candle, MarketTick } from '../types';
import TradingChart from './TradingChart';

interface ChartsTabProps {
  candlesNifty: Candle[];
  candlesCall: Candle[];
  candlesPut: Candle[];
  ticks: MarketTick[];
}

interface SlotConfig {
  symbol: string;
  timeframe: string;
}

const PRESET_SYMBOLS = [
  { value: 'NSE:NIFTY', label: 'NIFTY SPOT INDEX' },
  { value: 'NSE:BANKNIFTY', label: 'BANKNIFTY SPOT INDEX' },
  { value: 'NSE:FINNIFTY', label: 'FINNIFTY SPOT INDEX' },
  { value: 'NIFTY24JUN22150CE', label: 'NIFTY ATM CALL (CE)' },
  { value: 'NIFTY24JUN22150PE', label: 'NIFTY ATM PUT (PE)' },
  { value: 'BANKNIFTY24DEC48000CE', label: 'BANKNIFTY CE PREMIUM' },
  { value: 'BANKNIFTY24DEC48000PE', label: 'BANKNIFTY PE PREMIUM' },
];

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '1h'];

export default function ChartsTab({
  candlesNifty,
  candlesCall,
  candlesPut,
  ticks,
}: ChartsTabProps) {
  const [layout, setLayout] = useState<1 | 2 | 4>(4);
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>([
    { symbol: 'NSE:NIFTY', timeframe: '1m' },
    { symbol: 'NIFTY24JUN22150CE', timeframe: '3m' },
    { symbol: 'NIFTY24JUN22150PE', timeframe: '5m' },
    { symbol: 'NSE:BANKNIFTY', timeframe: '15m' },
  ]);

  // For managing search queries or inputs in slots
  const [searchInputs, setSearchInputs] = useState<string[]>(['', '', '', '']);
  const [showDropdown, setShowDropdown] = useState<number | null>(null);

  const handleUpdateSlot = (index: number, key: keyof SlotConfig, value: string) => {
    setSlotConfigs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  // Dynamically derive or generate specialized candles for any preset or searched instrument
  const getSlotCandles = (config: SlotConfig, index: number): Candle[] => {
    const sym = config.symbol.toUpperCase();
    if (sym === 'NSE:NIFTY' || sym === 'NIFTY') {
      return candlesNifty;
    }
    if (sym.includes('CE') && sym.includes('22150')) {
      return candlesCall;
    }
    if (sym.includes('PE') && sym.includes('22150')) {
      return candlesPut;
    }

    // Generate neat, slightly shifted mock dataset based on NIFTY index to keep in parity
    // but looking distinct as an alternative index or options strike
    const modifier = sym.includes('BANKNIFTY') ? 2.15 : sym.includes('FINNIFTY') ? 0.94 : (index + 1) * 0.4;
    return candlesNifty.map((c) => {
      const scale = sym.includes('BANKNIFTY') ? 2.1 : sym.includes('FINNIFTY') ? 0.9 : 1.0;
      const offset = sym.includes('BANKNIFTY') ? 25900 : sym.includes('FINNIFTY') ? -150 : 0;
      return {
        time: c.time,
        open: +(c.open * scale + offset + modifier).toFixed(1),
        high: +(c.high * scale + offset + modifier + 2).toFixed(1),
        low: +(c.low * scale + offset + modifier - 2).toFixed(1),
        close: +(c.close * scale + offset + modifier).toFixed(1),
        volume: Math.floor(c.volume * 0.8),
      };
    });
  };

  // Dynamic height configuration based on active layout grid
  const getChartHeight = (): number => {
    if (layout === 1) return 550;
    if (layout === 2) return 460;
    return 240; // 2x2 grid fits tightly and perfectly
  };

  return (
    <div className="space-y-1.5 animate-none">
      {/* Upper Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-2 bg-[#080d1a] border border-[#1e293b] rounded-lg gap-2">
        <div className="flex items-center space-x-2">
          <LayoutGrid className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
            MULTI-CHARTS DISPATCH WORKSPACE
          </h2>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.2 rounded border border-indigo-500/20 font-mono font-bold">
            GRID ACTIVE
          </span>
        </div>

        {/* Layout Selectors */}
        <div className="flex items-center space-x-1 border border-slate-800 rounded bg-[#0b0f19] p-0.5">
          <span className="text-[10px] text-slate-500 font-mono px-1.5 uppercase font-bold">
            Layout Grid:
          </span>
          <button
            onClick={() => setLayout(1)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              layout === 1
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Columns className="w-3 h-3 rotate-90" />
            1 CHART
          </button>
          <button
            onClick={() => setLayout(2)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              layout === 2
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Columns className="w-3 h-3" />
            2 CHARTS
          </button>
          <button
            onClick={() => setLayout(4)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
              layout === 4
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trello className="w-3 h-3" />
            4 CHARTS
          </button>
        </div>
      </div>

      {/* Grid Dashboard Workspace */}
      <div
        className={`grid gap-1.5 ${
          layout === 1
            ? 'grid-cols-1'
            : layout === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2' // 4 charts is a 2x2 grid
        }`}
      >
        {Array.from({ length: layout }).map((_, index) => {
          const config = slotConfigs[index] || { symbol: 'NSE:NIFTY', timeframe: '1m' };
          const candles = getSlotCandles(config, index);
          const filteredTicks = ticks.filter((t) => t.instrumentKey === config.symbol);

          return (
            <div
              key={index}
              className="bg-[#080d1a] border border-[#1e293b] rounded-lg p-1.5 flex flex-col space-y-1 relative"
              id={`chart-slot-${index}`}
            >
              {/* Individual Slot Header Configurator */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 flex-shrink-0">
                <div className="flex items-center space-x-1.5 relative w-1/2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                  
                  {/* Inline Symbol Input / Search Trigger */}
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={searchInputs[index] || config.symbol}
                      placeholder="Browse symbol..."
                      onFocus={() => setShowDropdown(index)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchInputs((prev) => {
                          const next = [...prev];
                          next[index] = val;
                          return next;
                        });
                        handleUpdateSlot(index, 'symbol', val.toUpperCase());
                      }}
                      className="bg-[#0b0f19] border border-slate-800 rounded px-1.5 py-0.5 text-[10.5px] font-mono text-slate-200 outline-none focus:border-indigo-500 w-full"
                    />

                    {/* Presets suggestions selection list */}
                    {showDropdown === index && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setShowDropdown(null)}
                        />
                        <div className="absolute top-full left-0 mt-1 w-64 bg-slate-950 border border-slate-800 rounded-md shadow-2xl z-40 max-h-52 overflow-y-auto font-mono text-[10px] text-slate-300">
                          <div className="p-1.5 text-[9px] font-bold text-slate-500 border-b border-slate-900 bg-slate-900/40 uppercase">
                            RECOMMENDED TICKERS
                          </div>
                          {PRESET_SYMBOLS.map((preset) => (
                            <button
                              key={preset.value}
                              onClick={() => {
                                handleUpdateSlot(index, 'symbol', preset.value);
                                setSearchInputs((prev) => {
                                  const next = [...prev];
                                  next[index] = preset.value;
                                  return next;
                                });
                                setShowDropdown(null);
                              }}
                              className="w-full px-2 py-1.5 text-left hover:bg-indigo-600 hover:text-white transition-colors flex flex-col border-b border-slate-900 last:border-0"
                            >
                              <span className="font-bold text-white leading-tight">
                                {preset.value}
                              </span>
                              <span className="text-[8.5px] text-slate-400">
                                {preset.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Individual Timeframe triggers */}
                <div className="flex items-center space-x-0.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleUpdateSlot(index, 'timeframe', tf)}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold transition-all ${
                        config.timeframe === tf
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trading chart instance with custom size */}
              <div className="flex-grow">
                <TradingChart
                  symbol={config.symbol}
                  candles={candles}
                  timeframe={config.timeframe}
                  setTimeframe={(tf) => handleUpdateSlot(index, 'timeframe', tf)}
                  ticks={filteredTicks}
                  height={getChartHeight()}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
