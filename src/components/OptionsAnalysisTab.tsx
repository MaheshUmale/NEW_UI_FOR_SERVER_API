/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, TrendingUp, Compass, ArrowUpDown, ChevronDown, BarChart2, Activity, Zap, Check } from 'lucide-react';
import { OptionContract, OptionChainPayload } from '../types';

interface OptionsAnalysisTabProps {
  niftyLtp: number;
  chainPayload: OptionChainPayload | null;
  selectedCeStrike: string;
  selectedPeStrike: string;
  setSelectedCeStrike: (strike: string) => void;
  setSelectedPeStrike: (strike: string) => void;
  oiBuildups: { strike: number; option_type: 'call' | 'put'; oi_change: number; signal: string }[];
  pcrHistory: { timestamp: string; pcr_oi: number; pcr_vol: number; underlying_price: number }[];
  triggerBackfill: () => void;
  isBackfilling: boolean;
}

export default function OptionsAnalysisTab({
  niftyLtp,
  chainPayload,
  selectedCeStrike,
  selectedPeStrike,
  setSelectedCeStrike,
  setSelectedPeStrike,
  oiBuildups = [],
  pcrHistory = [],
  triggerBackfill,
  isBackfilling,
}: OptionsAnalysisTabProps) {
  const [greekFilter, setGreekFilter] = useState<'all' | 'greeks_only' | 'volume_only'>('all');

  // Spot price
  const spotPrice = chainPayload ? chainPayload.spot_price : niftyLtp;
  const atmBaseStrike = Math.round(spotPrice / 50) * 50;

  // Filter option chain to closest strikes (ATM +/- 5 strikes)
  const sortedStrikes = chainPayload
    ? Array.from(new Set(chainPayload.chain.map((c) => c.strike))).sort((a, b) => a - b)
    : [];

  const centerIndex = sortedStrikes.reduce((closestIdx, strike, idx) => {
    const currentDiff = Math.abs(strike - atmBaseStrike);
    const closestDiff = Math.abs(sortedStrikes[closestIdx] - atmBaseStrike);
    return currentDiff < closestDiff ? idx : closestIdx;
  }, 0);

  // Keep strikes around ATM
  const visibleStrikes =
    sortedStrikes.length > 0
      ? sortedStrikes.slice(Math.max(0, centerIndex - 5), Math.min(sortedStrikes.length, centerIndex + 6))
      : [];

  // Group option chain by strike for side-by-side rendering
  const strikeGroupedMap = visibleStrikes.map((strike) => {
    const ceContract = chainPayload?.chain.find((c) => c.strike === strike && c.option_type === 'call');
    const peContract = chainPayload?.chain.find((c) => c.strike === strike && c.option_type === 'put');
    return {
      strike,
      isATM: strike === atmBaseStrike,
      ce: ceContract,
      pe: peContract,
    };
  });

  // Fetch current PCR
  const latestPcr = pcrHistory.length > 0 ? pcrHistory[pcrHistory.length - 1] : { pcr_oi: 0.92, pcr_vol: 1.02 };

  // Setup maximum height for SVG bars
  const maxOiValue = chainPayload
    ? Math.max(...chainPayload.chain.map((c) => c.oi)) || 1
    : 1000000;

  return (
    <div className="space-y-2">
      {/* SECTION 1: PCR CONFLUENCE METRIC HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5">
        <div className="p-2 bg-[#0d1323] border border-slate-800 rounded-lg">
          <span className="text-[9px] font-mono text-slate-500 uppercase block leading-none">SPOT VS ATM BASE</span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span className="text-sm font-mono font-bold text-white">₹{spotPrice.toFixed(2)}</span>
            <span className="text-[10px] text-sky-400 font-mono">ATM: {atmBaseStrike}</span>
          </div>
          <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">
            Distance:{' '}
            <span className="font-mono text-slate-200">
              {Math.abs(spotPrice - atmBaseStrike).toFixed(1)} pts
            </span>
          </span>
        </div>

        <div className="p-2 bg-[#0d1323] border border-slate-800 rounded-lg">
          <span className="text-[9px] font-mono text-slate-500 uppercase block leading-none">PUT-CALL RATIO (PCR)</span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span
              className={`text-sm font-mono font-bold ${
                latestPcr.pcr_oi >= 1.0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {latestPcr.pcr_oi.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">OI Weighted</span>
          </div>
          <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">
            PCR Vol:{' '}
            <span className="font-mono text-slate-200">{(latestPcr.pcr_vol || 1.05).toFixed(2)}</span>
          </span>
        </div>

        <div className="p-2 bg-[#0d1323] border border-slate-800 rounded-lg">
          <span className="text-[9px] font-mono text-slate-500 uppercase block leading-none">IMPLIED VOLATILITY (IV)</span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span className="text-sm font-mono font-bold text-sky-400">14.82%</span>
            <span className="text-[10px] text-slate-400 font-mono">ATM Median</span>
          </div>
          <span className="text-[9px] text-slate-400 block mt-0.5 leading-none">
            Rank IP:{' '}
            <span className="font-mono text-emerald-400 font-semibold">42% (Bull Call friendly)</span>
          </span>
        </div>

        <div className="p-2 bg-[#0d1323] border border-slate-800 rounded-lg flex flex-col justify-between">
          <span className="text-[9px] font-mono text-slate-500 uppercase block leading-none">BACKFILL METADATA</span>
          <button
            onClick={triggerBackfill}
            disabled={isBackfilling}
            className={`w-full py-1 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95 border ${
              isBackfilling
                ? 'bg-[#1e293b]/50 border-[#1e293b] text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/15 hover:border-indigo-500/35'
            }`}
          >
            <Zap className="w-3 h-3" />
            {isBackfilling ? 'BACKFILLING...' : 'BACKFILL OPTIONS HIST'}
          </button>
        </div>
      </div>

      {/* Grid Layout: Enriched Option Chain + Secondary Widgets */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* LEFT COLUMN: SIDE-BY-SIDE OPTIONS MATRIX (ATM +/- 5 strikes) */}
        <div className="xl:col-span-8 bg-[#080d1a] border border-[#1e293b] rounded-lg p-3 flex flex-col overflow-x-auto">
          {/* Header toolbar */}
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
              <Compass className="w-4 h-4 text-emerald-400" />
              NIFTY OPTION CHAIN INTRA MATRIX
            </h3>

            {/* Matrix Columns Filters */}
            <div className="flex items-center space-x-1 border border-slate-800 rounded bg-[#0b0f19] p-0.5">
              {[
                { id: 'all', title: 'FULL DECK' },
                { id: 'greeks_only', title: 'GREEKS' },
                { id: 'volume_only', title: 'VOL / OI' },
              ].map((filt) => (
                <button
                  key={filt.id}
                  onClick={() => setGreekFilter(filt.id as any)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all ${
                    greekFilter === filt.id
                      ? 'bg-emerald-600 text-white font-bold shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filt.title}
                </button>
              ))}
            </div>
          </div>

          {/* Matrix table */}
          <div className="w-full text-[11px] font-mono">
            {/* Headers titles row */}
            <div className="grid grid-cols-12 border-b border-slate-700 bg-[#0d1627] text-slate-400 font-bold py-1.5 text-center items-center">
              {/* Call properties */}
              <div className="col-span-1 border-r border-[#141d2f]">IV</div>
              <div className="col-span-1 border-r border-[#141d2f]">Delta</div>
              <div className="col-span-1 border-r border-[#141d2f]">Theta</div>
              <div className="col-span-1 border-r border-[#141d2f]">OI (Chg)</div>
              <div className="col-span-1.5 border-r border-[#141d2f]">CE LTP</div>

              {/* Center Strike */}
              <div className="col-span-2 text-white font-black bg-slate-900 border-x border-[#1e293b] py-0.5">
                STRIKE PRICE
              </div>

              {/* Put properties */}
              <div className="col-span-1.5 border-r border-[#141d2f]">PE LTP</div>
              <div className="col-span-1 border-r border-[#141d2f]">OI (Chg)</div>
              <div className="col-span-1 border-r border-[#141d2f]">Theta</div>
              <div className="col-span-1 border-r border-[#141d2f]">Delta</div>
              <div className="col-span-1">IV</div>
            </div>

            {/* Option chain elements */}
            {strikeGroupedMap.length === 0 ? (
              <div className="flex items-center justify-center py-24 text-slate-500 font-bold">
                Refreshing options chain contracts database...
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {strikeGroupedMap.map((row) => {
                  const ceLtpVal = row.ce ? row.ce.ltp : 120.0;
                  const peLtpVal = row.pe ? row.pe.ltp : 105.0;

                  const isCeSelected = selectedCeStrike.includes(String(row.strike));
                  const isPeSelected = selectedPeStrike.includes(String(row.strike));

                  const isCeItm = row.strike < spotPrice;
                  const isPeItm = row.strike > spotPrice;

                  return (
                    <div
                      key={row.strike}
                      className={`grid grid-cols-12 py-1 text-center items-center font-mono hover:bg-slate-800/45 transition-colors ${
                        row.isATM ? 'bg-sky-950/20 border-y border-sky-400/20' : ''
                      }`}
                    >
                      {/* CALL GREEKS / VOLS */}
                      <div className="col-span-1 text-slate-500">
                        {row.ce ? `${(row.ce.iv * 100).toFixed(1)}%` : '14.5%'}
                      </div>
                      <div className="col-span-1 text-teal-400 font-bold">
                        {row.ce ? row.ce.delta.toFixed(2) : '0.50'}
                      </div>
                      <div className="col-span-1 text-rose-500">
                        {row.ce ? row.ce.theta.toFixed(1) : '-8.5'}
                      </div>
                      <div className="col-span-1 text-slate-400 pr-1 flex flex-col text-[10px] text-right">
                        <span>{row.ce ? (row.ce.oi / 1000).toFixed(0) : '25.0'}k</span>
                        <span
                          className={
                            row.ce && row.ce.oi_change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {row.ce && row.ce.oi_change >= 0 ? '+' : ''}
                          {row.ce ? (row.ce.oi_change / 1000).toFixed(0) : '2.0'}k
                        </span>
                      </div>

                      {/* CE LTP & BIND BUTTON */}
                      <div className="col-span-1.5 border-r border-[#141d2f]/40">
                        <button
                          onClick={() =>
                            row.ce
                              ? setSelectedCeStrike(`NIFTY24JUN${row.strike}CE`)
                              : setSelectedCeStrike(`NIFTY24JUN${row.strike}CE`)
                          }
                          className={`w-full py-1 text-[11px] rounded transition-all active:scale-95 font-bold ${
                            isCeSelected
                              ? 'bg-emerald-600 text-white shadow-md'
                              : isCeItm
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                              : 'bg-[#1e293b]/30 hover:bg-slate-700/50 text-slate-300'
                          }`}
                        >
                          ₹{ceLtpVal.toFixed(1)}
                        </button>
                      </div>

                      {/* STRIKE PRICE (Center Column) */}
                      <div
                        className={`col-span-2 font-black py-1.5 border-x border-[#1e293b]/70 flex flex-col justify-center ${
                          row.isATM
                            ? 'bg-sky-500/20 text-sky-300'
                            : isCeItm
                            ? 'bg-amber-950/15 text-amber-200'
                            : 'bg-emerald-950/10 text-slate-300'
                        }`}
                      >
                        <span className="text-sm font-extrabold">{row.strike}</span>
                        <span className="text-[9px] font-bold tracking-tight uppercase text-slate-500">
                          {row.isATM ? 'ATM NODE' : isCeItm ? 'ITM (CE)' : 'OTM (CE)'}
                        </span>
                      </div>

                      {/* PUT LTP & BIND BUTTON */}
                      <div className="col-span-1.5 border-r border-[#141d2f]/40">
                        <button
                          onClick={() =>
                            row.pe
                              ? setSelectedPeStrike(`NIFTY24JUN${row.strike}PE`)
                              : setSelectedPeStrike(`NIFTY24JUN${row.strike}PE`)
                          }
                          className={`w-full py-1 text-[11px] rounded transition-all active:scale-95 font-bold ${
                            isPeSelected
                              ? 'bg-emerald-600 text-white shadow-md'
                              : isPeItm
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                              : 'bg-[#1e293b]/30 hover:bg-slate-700/50 text-slate-300'
                          }`}
                        >
                          ₹{peLtpVal.toFixed(1)}
                        </button>
                      </div>

                      {/* PUT GREEKS / VOLS */}
                      <div className="col-span-1 text-slate-400 pl-1 flex flex-col text-[10px] text-left">
                        <span>{row.pe ? (row.pe.oi / 1000).toFixed(0) : '22.0'}k</span>
                        <span
                          className={
                            row.pe && row.pe.oi_change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {row.pe && row.pe.oi_change >= 0 ? '+' : ''}
                          {row.pe ? (row.pe.oi_change / 1000).toFixed(0) : '1.5'}k
                        </span>
                      </div>
                      <div className="col-span-1 text-rose-505">
                        {row.pe ? row.pe.theta.toFixed(1) : '-8.1'}
                      </div>
                      <div className="col-span-1 text-rose-400 font-bold">
                        {row.pe ? row.pe.delta.toFixed(2) : '-0.50'}
                      </div>
                      <div className="col-span-1 text-slate-500">
                        {row.pe ? `${(row.pe.iv * 100).toFixed(1)}%` : '15.1%'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE OI GRAPHS & BUILDUPS */}
        <div className="xl:col-span-4 space-y-3">
          {/* Widget 1: OI Distribution Bar Chart (SVG Rendered) */}
          <div className="bg-[#080d1a] border border-[#1e293b] rounded-lg p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1">
              <BarChart2 className="w-4 h-4 text-sky-400" />
              OI DISTRIBUTION BY STRIKE
            </h4>

            {/* SVG custom bar graph */}
            <div className="relative h-[160px] w-full bg-[#0b0f19] border border-slate-900 rounded p-2">
              <div className="h-full w-full flex items-end justify-between px-2 gap-1.5">
                {visibleStrikes.map((strike) => {
                  const strikeCe = chainPayload?.chain.find(
                    (c) => c.strike === strike && c.option_type === 'call'
                  );
                  const strikePe = chainPayload?.chain.find(
                    (c) => c.strike === strike && c.option_type === 'put'
                  );

                  const ceValue = strikeCe ? strikeCe.oi : 150000;
                  const peValue = strikePe ? strikePe.oi : 130000;

                  const ceHeight = `${(ceValue / maxOiValue) * 85}%`;
                  const peHeight = `${(peValue / maxOiValue) * 85}%`;

                  return (
                    <div key={strike} className="flex-grow flex flex-col items-center h-full justify-end">
                      {/* Bars side-by-side grouped */}
                      <div className="w-full flex items-end justify-center gap-0.5 h-full relative">
                        {/* CE Bar (Orange-Red) */}
                        <div
                          style={{ height: ceHeight }}
                          className="w-1.5 sm:w-2 bg-[#f43f5e] rounded-t-sm transition-all"
                          title={`Strike ${strike} Call OI: ${ceValue.toLocaleString()}`}
                        />
                        {/* PE Bar (Green) */}
                        <div
                          style={{ height: peHeight }}
                          className="w-1.5 sm:w-2 bg-[#10b981] rounded-t-sm transition-all"
                          title={`Strike ${strike} Put OI: ${peValue.toLocaleString()}`}
                        />
                      </div>
                      {/* Label strike simplified */}
                      <span className="text-[8px] font-mono font-bold text-slate-500 mt-1">
                        {strike % 100 === 0 ? strike : `'${String(strike).substring(3, 5)}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legends overlay */}
              <div className="absolute top-2 right-2 flex items-center space-x-3 text-[9px] font-mono bg-slate-955/80 p-1 rounded font-bold">
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded bg-rose-500" /> CE OI
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded bg-emerald-500" /> PE OI
                </span>
              </div>
            </div>
          </div>

          {/* Widget 2: OI BUILDUP PULSE HEATMAP LOGS */}
          <div className="bg-[#080d1a] border border-[#1e293b] rounded-lg p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1">
              <Activity className="w-4 h-4 text-amber-500" />
              OI BUILDUP INTRA-DAY PULSE
            </h4>

            {oiBuildups.length === 0 ? (
              <div className="p-3 bg-[#0b0f19] border border-slate-900 rounded text-center text-xs text-slate-500">
                Evaluating build-up directionality from order queues...
              </div>
            ) : (
              <div className="space-y-1.5 overflow-y-auto max-h-[190px] pr-1 custom-scroll">
                {oiBuildups.slice(0, 10).map((b, idx) => {
                  const isBullish =
                    b.signal === 'long_buildup' || b.signal === 'short_covering';

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs font-mono font-bold border flex justify-between items-center ${
                        isBullish
                          ? 'bg-emerald-950/15 border-emerald-500/10 text-emerald-300'
                          : 'bg-rose-950/15 border-rose-500/10 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-900 px-1 py-0.5 rounded text-white border border-slate-800">
                          {b.strike}
                        </span>
                        <span className="uppercase text-[10px] font-black">
                          {b.option_type}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="uppercase leading-none text-[10px] block font-black">
                          {b.signal.replace('_', ' ')}
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">
                          Change: +{(b.oi_change / 1000).toFixed(1)}k OI
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
