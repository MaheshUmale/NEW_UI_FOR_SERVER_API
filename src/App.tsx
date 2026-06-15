/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import MainTab from './components/MainTab';
import OptionsAnalysisTab from './components/OptionsAnalysisTab';
import ScalperTab from './components/ScalperTab';
import DbQueryTab from './components/DbQueryTab';
import StrategyAlertsTab from './components/StrategyAlertsTab';
import ChartsTab from './components/ChartsTab';
import OrderFlowTab from './components/OrderFlowTab';
import { Candle, OptionChainPayload, OptionContract, MarketTick, TradeLog, Position, BrainSignal, Alert, Strategy, DbTableInfo, DbQueryResult, TradingMode } from './types';
import { Sparkles, Bell, WifiOff, RefreshCw, X, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [mode, setMode] = useState<TradingMode>('LIVE');
  const [underlying, setUnderlying] = useState<string>('NIFTY');

  // Network & Status states
  const [latency, setLatency] = useState<number>(14);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isReplayRunning, setIsReplayRunning] = useState<boolean>(false);
  const [isBackfilling, setIsBackfilling] = useState<boolean>(false);

  // Core market lists
  const [candlesNifty, setCandlesNifty] = useState<Candle[]>([]);
  const [candlesCall, setCandlesCall] = useState<Candle[]>([]);
  const [candlesPut, setCandlesPut] = useState<Candle[]>([]);

  const [ticks, setTicks] = useState<MarketTick[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [signals, setSignals] = useState<BrainSignal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Selected option chain targets for main desk
  const [selectedCeStrike, setSelectedCeStrike] = useState<string>('NIFTY24JUN22150CE');
  const [selectedPeStrike, setSelectedPeStrike] = useState<string>('NIFTY24JUN22150PE');

  // Option Chain Payload
  const [chainPayload, setChainPayload] = useState<OptionChainPayload | null>(null);
  const [pcrHistory, setPcrHistory] = useState<any[]>([]);
  const [oiBuildups, setOiBuildups] = useState<any[]>([]);
  const [supportResistance, setSupportResistance] = useState<any>({ support: [], resistance: [] });
  const [genieInsights, setGenieInsights] = useState<string[]>([]);
  const [reloadingInsights, setReloadingInsights] = useState<boolean>(false);

  // Strategy Builder & DB query state
  const [activeStrategy, setActiveStrategy] = useState<Strategy | null>(null);
  const [buildingStrategy, setBuildingStrategy] = useState<boolean>(false);
  const [dbTables, setDbTables] = useState<DbTableInfo[]>([]);
  const [dbQueryResult, setDbQueryResult] = useState<DbQueryResult>({ results: [] });
  const [isQuerying, setIsQuerying] = useState<boolean>(false);

  // Push notifications banners
  const [toastAlert, setToastAlert] = useState<{ id: string; message: string; title: string } | null>(null);

  // Refs for loop controls
  const tickTimerRef = useRef<any>(null);
  const currentNiftyPriceRef = useRef<number>(22152.40);

  // Generate mock candles on initialize
  useEffect(() => {
    // Generate 40 initial candles for neat plotting
    const nowSecs = Math.floor(Date.now() / 1000);
    const timeframeSecs = 60; // 1m candles base

    const tempNifty: Candle[] = [];
    const tempCall: Candle[] = [];
    const tempPut: Candle[] = [];

    let baseNifty = 22110.0;
    let baseCall = 125.0;
    let basePut = 100.0;

    for (let i = 40; i >= 1; i--) {
      const time = nowSecs - i * timeframeSecs;

      // Nifty
      const openN = baseNifty + (Math.random() * 20 - 10);
      const closeN = openN + (Math.random() * 16 - 8);
      const highN = Math.max(openN, closeN) + Math.random() * 6;
      const lowN = Math.min(openN, closeN) - Math.random() * 6;
      tempNifty.push({ time, open: openN, high: highN, low: lowN, close: closeN, volume: Math.floor(Math.random() * 12000 + 4000) });
      baseNifty = closeN;

      // Call Premium
      const openC = baseCall + (Math.random() * 8 - 4);
      const closeC = openC + (Math.random() * 6 - 3);
      const highC = Math.max(openC, closeC) + Math.random() * 3;
      const lowC = Math.min(openC, closeC) - Math.random() * 3;
      tempCall.push({ time, open: openC, high: highC, low: lowC, close: closeC, volume: Math.floor(Math.random() * 4000 + 1000) });
      baseCall = closeC;

      // Put Premium
      const openP = basePut + (Math.random() * 8 - 4);
      const closeP = openP + (Math.random() * 6 - 3);
      const highP = Math.max(openP, closeP) + Math.random() * 3;
      const lowP = Math.min(openP, closeP) - Math.random() * 3;
      tempPut.push({ time, open: openP, high: highP, low: lowP, close: closeP, volume: Math.floor(Math.random() * 4000 + 1000) });
      basePut = closeP;
    }

    setCandlesNifty(tempNifty);
    setCandlesCall(tempCall);
    setCandlesPut(tempPut);
    currentNiftyPriceRef.current = baseNifty;

    // Load initial support and resistance levels
    setSupportResistance({
      support: [
        { strike: 21950, oi: 1540000 },
        { strike: 22000, oi: 1980000 },
      ],
      resistance: [
        { strike: 22350, oi: 1420000 },
        { strike: 22400, oi: 2110000 },
      ],
    });

    // Option Chain payload
    generateOptionChainPayload(baseNifty);

    // Initial alert presets
    setAlerts([
      { id: 'al-pcr', name: 'NIFTY PCR Warning Alert', alert_type: 'PCR', underlying: 'NIFTY', condition: 'pcr_oi < 0.8', message_template: 'PCR dropped below critical threshold!', status: 'active' },
      { id: 'al-spot-break', name: 'NIFTY High Breakout Node', alert_type: 'PRICE', underlying: 'NIFTY', condition: 'price > 22250', message_template: 'Spot price crossed 22250 resistance level', status: 'active' },
    ]);

    // DB Tables list
    setDbTables([
      { name: 'ticks', row_count: 1420500, schema: [{ name: 'ts_ms', type: 'BIGINT' }, { name: 'instrumentKey', type: 'VARCHAR' }, { name: 'price', type: 'DOUBLE' }, { name: 'volume', type: 'DOUBLE' }] },
      { name: 'options_snapshots', row_count: 85200, schema: [{ name: 'timestamp', type: 'TIMESTAMP' }, { name: 'underlying', type: 'VARCHAR' }, { name: 'strike', type: 'INTEGER' }, { name: 'option_type', type: 'VARCHAR' }, { name: 'oi', type: 'INTEGER' }, { name: 'ltp', type: 'DOUBLE' }] },
      { name: 'pcr_history', row_count: 520, schema: [{ name: 'timestamp', type: 'TIMESTAMP' }, { name: 'pcr_oi', type: 'DOUBLE' }, { name: 'pcr_vol', type: 'DOUBLE' }, { name: 'spot_price', type: 'DOUBLE' }] },
    ]);

    // Initial insights
    setGenieInsights([
      'NIFTY 22100 Put Option seeing intensive support block with heavy volume accumulation.',
      'PCR (OI) is consolidation flat at 0.94, suggesting tight range boundary trades around ATM.',
      'Highest Call concentration rests at 22400; immediate resistance barrier for breakout traders.'
    ]);
  }, []);

  // Ticks and live wiggling simulation loop
  useEffect(() => {
    tickTimerRef.current = setInterval(() => {
      // Create price step wiggles
      const direction = Math.random() > 0.48 ? 1 : -1;
      const wiggle = +(Math.random() * 4).toFixed(2) * direction;
      const nextNifty = +(currentNiftyPriceRef.current + wiggle).toFixed(2);
      currentNiftyPriceRef.current = nextNifty;

      const niftyLTP = nextNifty;
      // Derive premiums
      const scaleCe = Math.max(5.0, 120.0 + (niftyLTP - 22150) * 0.55 + Math.random() * 1.5);
      const scalePe = Math.max(5.0, 105.0 - (niftyLTP - 22150) * 0.45 + Math.random() * 1.5);

      // Create new Tick entries
      const newTick: MarketTick = {
        ts_ms: Date.now(),
        instrumentKey: 'NSE:NIFTY',
        price: niftyLTP,
        volume: Math.floor(Math.random() * 1500) + 200,
      };

      setTicks((prev) => [newTick, ...prev.slice(0, 30)]);

      // Create TSales Tape logs
      const newTape: TradeLog = {
        id: `t-${Date.now()}`,
        timestamp: Date.now(),
        price: Math.random() > 0.5 ? scaleCe : scalePe,
        quantity: Math.floor(Math.random() * 400) + 50,
        aggressor: Math.random() > 0.5 ? 'Buy' : 'Sell',
        symbol: Math.random() > 0.5 ? selectedCeStrike : selectedPeStrike,
      };
      setTradeLogs((prev) => [newTape, ...prev.slice(0, 40)]);

      // Update active candle series (wiggles affect the last open candle closing value)
      setCandlesNifty((prev) => {
        if (prev.length === 0) return prev;
        const lastCandle = { ...prev[prev.length - 1] };
        lastCandle.close = niftyLTP;
        lastCandle.high = Math.max(lastCandle.high, niftyLTP);
        lastCandle.low = Math.min(lastCandle.low, niftyLTP);
        return [...prev.slice(0, -1), lastCandle];
      });

      setCandlesCall((prev) => {
        if (prev.length === 0) return prev;
        const lastCandle = { ...prev[prev.length - 1] };
        lastCandle.close = scaleCe;
        lastCandle.high = Math.max(lastCandle.high, scaleCe);
        lastCandle.low = Math.min(lastCandle.low, scaleCe);
        return [...prev.slice(0, -1), lastCandle];
      });

      setCandlesPut((prev) => {
        if (prev.length === 0) return prev;
        const lastCandle = { ...prev[prev.length - 1] };
        lastCandle.close = scalePe;
        lastCandle.high = Math.max(lastCandle.high, scalePe);
        lastCandle.low = Math.min(lastCandle.low, scalePe);
        return [...prev.slice(0, -1), lastCandle];
      });

      // Update positions P&L dynamically relative to the new price wiggles
      setPositions((prev) =>
        prev.map((pos) => {
          const ltpVal = pos.type === 'CE' ? scaleCe : scalePe;
          const diff = ltpVal - pos.avgPrice;
          const lotSize = 50;
          const calculatedPnl = diff * pos.qty * lotSize;
          return {
            ...pos,
            ltp: ltpVal,
            pnl: calculatedPnl,
          };
        })
      );

      // Check alert conditions dynamically
      alerts.forEach((alert) => {
        if (alert.status === 'active') {
          if (alert.alert_type === 'PRICE' && niftyLTP > 22250) {
            triggerNotification('BREACH DETECTED!', `NIFTY Spot price ruptured 22250 resistance. Current: ₹${niftyLTP}`);
          } else if (alert.alert_type === 'PCR' && latestPcrVolume() < 0.8) {
            triggerNotification('PCR THRESHOLD', 'Put-Call Volume Ratio is leaning extremely bearish.');
          }
        }
      });
    }, 1200);

    return () => clearInterval(tickTimerRef.current);
  }, [alerts, selectedCeStrike, selectedPeStrike]);

  const latestPcrVolume = () => (chainPayload ? 0.94 : 0.72);

  // Generates option chain nodes around ATM strike in steps of 50
  const generateOptionChainPayload = (basePrice: number) => {
    const atmBase = Math.round(basePrice / 50) * 50;
    const chainItems: OptionContract[] = [];

    for (let i = -8; i <= 8; i++) {
      const strike = atmBase + i * 50;
      const isCE_itm = strike < basePrice;
      const isPE_itm = strike > basePrice;

      // Call Contract
      const ceLtp = Math.max(3.5, 120 - (strike - basePrice) * 0.55);
      chainItems.push({
        strike,
        expiry: '2026-06-25',
        option_type: 'call',
        ltp: ceLtp,
        oi: Math.floor(Math.max(10000, 2400000 - Math.abs(strike - basePrice) * 400)),
        oi_change: Math.floor(Math.random() * 80000 - 15000),
        volume: Math.floor(Math.max(200, 480000 - Math.abs(strike - basePrice) * 100)),
        delta: isCE_itm ? 0.75 : 0.32,
        gamma: 0.002,
        theta: -8.5,
        vega: 12.1,
        iv: 0.145,
        moneyness: isCE_itm ? 'ITM' : strike === atmBase ? 'ATM' : 'OTM',
        distance_from_atm_pct: +(Math.abs(strike - basePrice) / basePrice * 100).toFixed(2),
      });

      // Put Contract
      const peLtp = Math.max(3.5, 105 + (strike - basePrice) * 0.45);
      chainItems.push({
        strike,
        expiry: '2026-06-25',
        option_type: 'put',
        ltp: peLtp,
        oi: Math.floor(Math.max(10000, 2100000 - Math.abs(strike - basePrice) * 400)),
        oi_change: Math.floor(Math.random() * 75000 - 10000),
        volume: Math.floor(Math.max(200, 410000 - Math.abs(strike - basePrice) * 100)),
        delta: isPE_itm ? -0.72 : -0.28,
        gamma: 0.002,
        theta: -8.1,
        vega: 11.2,
        iv: 0.151,
        moneyness: isPE_itm ? 'ITM' : strike === atmBase ? 'ATM' : 'OTM',
        distance_from_atm_pct: +(Math.abs(strike - basePrice) / basePrice * 100).toFixed(2),
      });
    }

    setChainPayload({
      underlying: 'NIFTY',
      spot_price: basePrice,
      chain: chainItems,
      source: 'DuckDB Snapshot Cache',
    });

    // Populate OI buildup patterns
    const buildups = visibleStrikesForOi(atmBase).map((strike) => ({
      strike,
      option_type: Math.random() > 0.5 ? 'call' : 'put',
      oi_change: Math.floor(Math.random() * 45000 + 10000),
      signal: ['long_buildup', 'short_buildup', 'short_covering', 'long_unwinding'][Math.floor(Math.random() * 4)],
    }));
    setOiBuildups(buildups);
  };

  const visibleStrikesForOi = (atm: number) => [atm - 150, atm - 100, atm - 50, atm, atm + 50, atm + 100, atm + 150];

  // Notification framework
  const triggerNotification = (title: string, message: string) => {
    const alertId = `toast-${Date.now()}`;
    setToastAlert({ id: alertId, title, message });

    // Emulate a visual signal block log
    const newSig: BrainSignal = {
      id: `sig-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'LONG',
      message: `${title}: ${message}`,
      strength: 88,
    };
    setSignals((prev) => [newSig, ...prev.slice(0, 10)]);

    // Autoclose after 6 seconds
    setTimeout(() => {
      setToastAlert((prev) => (prev?.id === alertId ? null : prev));
    }, 6000);
  };

  // Replay Triggers
  const startReplay = (startTime: string, speed: number) => {
    setIsReplayRunning(true);
    triggerNotification('REPLAY RUNNING', `Activated NIFTY tick replays from timestamp: ${startTime} at speed ${speed}x.`);
  };

  const stopReplay = () => {
    setIsReplayRunning(false);
    triggerNotification('REPLAY SUSPENDED', 'Successfully halted historical order stream. Bounded back to Live feed.');
  };

  // Option Buyer portfolio actions
  const addPosition = (newPos: Position) => {
    setPositions((prev) => [newPos, ...prev]);
    triggerNotification('TRADE ROUTED', `Successfully filled order. Buy ${newPos.qty * 50} Qty ${newPos.symbol} @ ₹${newPos.avgPrice.toFixed(2)}.`);
  };

  const removePosition = (id: string) => {
    const matched = positions.find((p) => p.id === id);
    setPositions((prev) => prev.filter((p) => p.id !== id));
    if (matched) {
      triggerNotification('TRADE COLLATERAL CLOSED', `Sold ${matched.qty * 50} Qty ${matched.symbol} at final premium rate ₹${matched.ltp.toFixed(2)}. Net Pnl: ₹${matched.pnl.toFixed(1)}`);
    }
  };

  const exitAllPositions = () => {
    setPositions([]);
    triggerNotification('PANIC COLLATERAL SOLD', 'Market panic sell triggers triggered. Flushed all active options inventory to cash.');
  };

  // Trigger backfill Today options history
  const handleTriggerBackfill = () => {
    setIsBackfilling(true);
    triggerNotification('BACKFILL INTENT REGISTERED', 'Triggering backend service workers. Compressing today\'s market ticks into options snapshot history logs.');
    setTimeout(() => {
      setIsBackfilling(false);
      triggerNotification('BACKFILL WORKER COMPLETE', 'DuckDB snapshot tables updated. Cached 1,420 contracts snapshots.');
    }, 3000);
  };

  // Refresh AI Genie report
  const refreshInsights = () => {
    setReloadingInsights(true);
    setTimeout(() => {
      setGenieInsights([
        'AI Sentiment Report: PCR trend has shifted slightly bullish as 22100 put writers add significant leverage.',
        'High execution speed tick volumes detect heavy absorption at 22200 call option level; potential breakout on index cross.',
        'Theta attrition is currently low (~ -8.5/day), indicating optimal premium buying window while volatility index rank holds 42%'
      ]);
      setReloadingInsights(false);
      triggerNotification('GENIE REPORT COMPLETED', 'Synthesized options metrics and order-book imbalances. Insights deck armed.');
    }, 1500);
  };

  // Build customize options strategies payoff metrics
  const buildStrategyUrl = (type: string, data: any) => {
    setBuildingStrategy(true);
    setTimeout(() => {
      const parsedStrategy: Strategy = {
        name: type === 'bull-call-spread' ? 'Bull Call Spread' : type === 'iron-condor' ? 'Iron Condor' : 'Long Straddle',
        underlying: 'NIFTY',
        spot_price: data.spot_price,
        legs: type === 'bull-call-spread' ? [
          { option_type: 'call', strike: data.lower_strike, action: 'buy', quantity: 1, premium: data.lower_premium, expiry: data.expiry },
          { option_type: 'call', strike: data.higher_strike, action: 'sell', quantity: 1, premium: data.higher_premium, expiry: data.expiry }
        ] : [],
        analysis: {
          max_profit: type === 'bull-call-spread' ? (data.higher_strike - data.lower_strike - (data.lower_premium - data.higher_premium)) * 50 : 3500,
          max_loss: type === 'bull-call-spread' ? (data.lower_premium - data.higher_premium) * 50 : 2500,
          breakeven: type === 'bull-call-spread' ? [data.lower_strike + (data.lower_premium - data.higher_premium)] : [21850, 22250]
        }
      };
      setActiveStrategy(parsedStrategy);
      setBuildingStrategy(false);
      triggerNotification('PAYOFF CALCULATED', `Strategy payoff profile compiled. Max risk pegged to ₹${parsedStrategy.analysis?.max_loss}.`);
    }, 1200);
  };

  // Alerts parameters updater
  const addAlert = (newAlert: { name: string; alert_type: string; condition: string }) => {
    const payload: Alert = {
      id: `al-${Date.now()}`,
      name: newAlert.name,
      alert_type: newAlert.alert_type,
      underlying: 'NIFTY',
      condition: newAlert.condition,
      message_template: 'Dynamic trigger crossing identified',
      status: 'active',
    };
    setAlerts((prev) => [payload, ...prev]);
    triggerNotification('ALERT DRAFTED', `Trigger monitor armed for formula: ${payload.condition}`);
  };

  const deleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    triggerNotification('ALERT DISARMED', 'Cleaned alert parameters from system memory.');
  };

  const pauseAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'paused' } : a)));
  };

  const resumeAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'active' } : a)));
  };

  // SQL Query database console executor
  const executeSqlQuery = (sql: string) => {
    setIsQuerying(true);
    setTimeout(() => {
      // Direct mock execution layer to ensure total operational integrity
      let results: any[] = [];
      const lowerSql = sql.toLowerCase();

      try {
        if (lowerSql.includes('pcr')) {
          results = [
            { timestamp: '2026-06-14 09:30', pcr_oi: 0.94, pcr_vol: 1.05, spot_price: 22152.50 },
            { timestamp: '2026-06-14 10:00', pcr_oi: 0.96, pcr_vol: 1.02, spot_price: 22168.10 },
            { timestamp: '2026-06-14 10:30', pcr_oi: 0.92, pcr_vol: 1.06, spot_price: 22144.30 },
          ];
        } else if (lowerSql.includes('options_snapshots')) {
          results = [
            { strike: 22100, option_type: 'call', oi: 1850000, volume: 34000, ltp: 135.20 },
            { strike: 22100, option_type: 'put', oi: 1540000, volume: 22000, ltp: 92.40 },
            { strike: 22200, option_type: 'call', oi: 1980000, volume: 46000, ltp: 88.50 },
            { strike: 22200, option_type: 'put', oi: 1110000, volume: 15000, ltp: 138.40 },
          ];
        } else {
          // default ticks feedback
          results = [
            { ts_ms: Date.now() - 500, instrumentKey: 'NSE:NIFTY', price: currentNiftyPriceRef.current, volume: 450 },
            { ts_ms: Date.now() - 1500, instrumentKey: 'NSE:NIFTY', price: currentNiftyPriceRef.current - 1.2, volume: 820 },
            { ts_ms: Date.now() - 2500, instrumentKey: 'NSE:NIFTY', price: currentNiftyPriceRef.current + 2.1, volume: 110 },
          ];
        }
        setDbQueryResult({ results });
        triggerNotification('QUERY COMPLETE', 'DuckDB query executed. Formatted logs outputted in results.');
      } catch (err: any) {
        setDbQueryResult({ results: [], error: err.message });
      } finally {
        setIsQuerying(false);
      }
    }, 1000);
  };

  const exportCsv = (sql: string) => {
    triggerNotification('SPREADSHEET GENERATED', 'Compiling and packing DuckDB dataset blocks. CSV spreadsheet download started.');
    const headers = 'ts_ms,instrumentKey,price,volume\n';
    const rows = `${Date.now()},NSE:NIFTY,22152.40,540\n${Date.now() - 1000},NSE:NIFTY,22150.30,420`;
    const docCSV = headers + rows;

    const blob = new Blob([docCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'duckdb_market_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#040810] min-h-screen text-slate-100 flex flex-col antialiased">
      <div className="w-full xl:max-w-[1780px] px-2 sm:px-3 mx-auto py-1.5 space-y-2 flex-grow flex flex-col justify-start relative">
        
        {/* Dynamic global warning banner when offline */}
        {!isConnected && (
          <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 font-medium">
            <div className="flex items-center gap-1.5 font-mono">
              <WifiOff className="w-4 h-4 animate-pulse" />
              <span>STABILITY CLOCK: LOCAL DUCKDB CONNECTION DISCONNECTED. RESILIENT STAGING PROTOCOL ACTIVE.</span>
            </div>
            <button onClick={() => setIsConnected(true)} className="flex items-center gap-1 text-[10px] bg-rose-500/25 hover:bg-rose-500/35 px-2 py-0.5 rounded border border-rose-500/30">
              <RefreshCw className="w-3 h-3" /> RECONNECT
            </button>
          </div>
        )}

        {/* Global floating interactive push toast */}
        {toastAlert && (
          <div className="fixed bottom-4 right-4 max-w-sm p-3 bg-slate-950/95 border border-indigo-500/30 rounded-lg shadow-2xl z-[100] animate-[slideIn_0.25s_ease-out] font-mono border-l-4 border-l-indigo-500">
            <div className="flex items-start justify-between gap-3 text-xs leading-relaxed">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 block tracking-tight uppercase mb-0.5">
                  ⚡ {toastAlert.title}
                </span>
                <p className="text-slate-200">{toastAlert.message}</p>
              </div>
              <button onClick={() => setToastAlert(null)} className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic header Nav console */}
        <Navbar
          mode={mode}
          setMode={setMode}
          underlying={underlying}
          setUnderlying={setUnderlying}
          latency={latency}
          isConnected={isConnected}
          startReplay={startReplay}
          stopReplay={stopReplay}
          isReplayRunning={isReplayRunning}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Tab Viewports Router */}
        <main className="flex-grow">
          {activeTab === 'home' && (
            <MainTab
              candlesNifty={candlesNifty}
              candlesCall={candlesCall}
              candlesPut={candlesPut}
              ticks={ticks}
              tradeLogs={tradeLogs}
              positions={positions}
              signals={signals}
              addPosition={addPosition}
              removePosition={removePosition}
              exitAllPositions={exitAllPositions}
              genieInsights={genieInsights}
              reloadingInsights={reloadingInsights}
              refreshInsights={refreshInsights}
              oiDataNifty={chainPayload ? chainPayload.chain.filter((c) => c.option_type === 'call') : []}
              supportResistance={supportResistance}
              selectedCeStrike={selectedCeStrike}
              selectedPeStrike={selectedPeStrike}
              alerts={alerts}
              pauseAlert={pauseAlert}
              resumeAlert={resumeAlert}
              deleteAlert={deleteAlert}
            />
          )}

          {activeTab === 'options' && (
            <OptionsAnalysisTab
              niftyLtp={currentNiftyPriceRef.current}
              chainPayload={chainPayload}
              selectedCeStrike={selectedCeStrike}
              selectedPeStrike={selectedPeStrike}
              setSelectedCeStrike={setSelectedCeStrike}
              setSelectedPeStrike={setSelectedPeStrike}
              oiBuildups={oiBuildups}
              pcrHistory={pcrHistory}
              triggerBackfill={handleTriggerBackfill}
              isBackfilling={isBackfilling}
            />
          )}

          {activeTab === 'scalper' && (
            <ScalperTab
              niftyLtp={currentNiftyPriceRef.current}
              ticks={ticks}
              positions={positions}
              addPosition={addPosition}
              removePosition={removePosition}
              exitAllPositions={exitAllPositions}
              selectedCeStrike={selectedCeStrike}
              selectedPeStrike={selectedPeStrike}
            />
          )}

          {activeTab === 'orderflow' && (
            <OrderFlowTab
              niftyLtp={currentNiftyPriceRef.current}
              ticks={ticks}
              tradeLogs={tradeLogs}
            />
          )}

          {activeTab === 'db' && (
            <DbQueryTab
              tables={dbTables}
              queryResult={dbQueryResult}
              executeQuery={executeSqlQuery}
              exportCsv={exportCsv}
              isQuerying={isQuerying}
            />
          )}

          {activeTab === 'charts' && (
            <ChartsTab
              candlesNifty={candlesNifty}
              candlesCall={candlesCall}
              candlesPut={candlesPut}
              ticks={ticks}
            />
          )}

          {activeTab === 'strategy' && (
            <StrategyAlertsTab
              alerts={alerts}
              addAlert={addAlert}
              deleteAlert={deleteAlert}
              pauseAlert={pauseAlert}
              resumeAlert={resumeAlert}
              buildStrategyUrl={buildStrategyUrl}
              activeStrategy={activeStrategy}
              buildingStrategy={buildingStrategy}
              niftyLtp={currentNiftyPriceRef.current}
              positions={positions}
              removePosition={removePosition}
            />
          )}
        </main>
      </div>

      {/* Styled Footer status indicator (Strictly clean and literal) */}
      <footer className="py-2.5 bg-[#03060c] border-t border-[#141d2f]/50 text-center font-mono text-[9px] text-[#475569] flex-shrink-0 flex items-center justify-center gap-1.5">
        <Cpu className="w-3.5 h-3.5 text-[#334155]" />
        <span>NSE NIFTY INTRA-DAY OPTIONS BUYER TERMINAL</span>
        <div className="h-3 w-px bg-slate-800" />
        <span>REBOUND CLIENT REVENUE SINK V2.4-STABLE</span>
      </footer>
    </div>
  );
}
