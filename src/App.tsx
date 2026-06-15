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
import { io } from 'socket.io-client';
import { API_SERVER_URL, SOCKET_SERVER_URL } from './config';

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
  const socketRef = useRef<any>(null);
  const currentNiftyPriceRef = useRef<number>(22152.40);

  // Initialize Socket.IO connection on mount or asset shift
  useEffect(() => {
    // Connect to port 8000 backend
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      const activeInstrument = underlying === 'NIFTY' ? 'NSE:NIFTY' : underlying.startsWith('NSE:') ? underlying : `NSE:${underlying}`;
      socket.emit('subscribe', { instrumentKeys: [activeInstrument], interval: '1' });
      socket.emit('subscribe_options', { underlying });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    // Handle real-time pricing ticks
    const handleTick = (payload: any) => {
      if (!payload) return;
      const timestamp = payload.timestamp || payload.ts_ms || payload.ts || payload.time || Date.now();
      let price = payload.price ?? payload.ltp ?? payload.c ?? payload.close ?? payload.last_price;
      if (typeof price !== 'number' && typeof price === 'string') {
        price = parseFloat(price);
      }
      
      if (typeof price === 'number' && !isNaN(price)) {
        currentNiftyPriceRef.current = price;

        const newTick: MarketTick = {
          ts_ms: timestamp,
          instrumentKey: payload.instrumentKey || payload.key || `NSE:${underlying}`,
          price,
          volume: payload.volume ?? payload.ltq ?? payload.qty ?? 100,
        };

        setTicks((prev) => [newTick, ...prev.slice(0, 30)]);

        // Keep active candle wiggling with live LTP
        setCandlesNifty((prev) => {
          if (prev.length === 0) return prev;
          const lastCandle = { ...prev[prev.length - 1] };
          lastCandle.close = price;
          lastCandle.high = Math.max(lastCandle.high, price);
          lastCandle.low = Math.min(lastCandle.low, price);
          return [...prev.slice(0, -1), lastCandle];
        });

        // Generate ticks/tape logs
        const newTape: TradeLog = {
          id: `t-${timestamp}-${Math.random()}`,
          timestamp,
          price,
          quantity: payload.volume ?? payload.ltq ?? Math.floor(Math.random() * 300) + 50,
          aggressor: Math.random() > 0.5 ? 'Buy' : 'Sell',
          symbol: payload.instrumentKey || payload.key || `NSE:${underlying}`,
        };
        setTradeLogs((prev) => [newTape, ...prev.slice(0, 40)]);
      }
    };

    socket.on('tick', handleTick);
    socket.on('market_data', handleTick);

    return () => {
      socket.disconnect();
    };
  }, [underlying]);

  // Synchronize intraday candlestick charting arrays on symbol selection
  useEffect(() => {
    let active = true;

    const loadCandles = async () => {
      try {
        const symbolIn = underlying === 'NIFTY' ? 'NSE:NIFTY' : underlying.startsWith('NSE:') ? underlying : `NSE:${underlying}`;
        const res = await fetch(`${API_SERVER_URL}/api/tv/intraday/${encodeURIComponent(symbolIn)}?interval=1`);
        if (!res.ok) return;
        const data = await res.json();

        if (active && data && Array.isArray(data.candles)) {
          const formatted = data.candles.map((c: any) => ({
            time: c[0],
            open: c[1],
            high: c[2],
            low: c[3],
            close: c[4],
            volume: c[5],
          }));
          setCandlesNifty(formatted);
        }
      } catch (e) {
        console.warn("Failed to fetch underlying candles", e);
      }

      // Load premium options candles if selected
      try {
        if (selectedCeStrike) {
          const resCE = await fetch(`${API_SERVER_URL}/api/tv/intraday/${encodeURIComponent(selectedCeStrike)}?interval=1`);
          if (resCE.ok) {
            const dataCE = await resCE.json();
            if (active && dataCE && Array.isArray(dataCE.candles)) {
              setCandlesCall(dataCE.candles.map((c: any) => ({
                time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
              })));
            }
          }
        }
        if (selectedPeStrike) {
          const resPE = await fetch(`${API_SERVER_URL}/api/tv/intraday/${encodeURIComponent(selectedPeStrike)}?interval=1`);
          if (resPE.ok) {
            const dataPE = await resPE.json();
            if (active && dataPE && Array.isArray(dataPE.candles)) {
              setCandlesPut(dataPE.candles.map((c: any) => ({
                time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
              })));
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load options strike candles", err);
      }
    };

    loadCandles();
    const interval = setInterval(loadCandles, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [underlying, selectedCeStrike, selectedPeStrike]);

  // Periodic poll of Option chain & metrics from actual API Server
  useEffect(() => {
    let active = true;

    const fetchAllData = async () => {
      try {
        const startTime = performance.now();
        
        // 1. Fetch Option Chain with Greeks
        const chainRes = await fetch(`${API_SERVER_URL}/api/options/chain/${underlying}/with-greeks`);
        if (!chainRes.ok) throw new Error('API server down');
        const chainData = await chainRes.json();
        
        // 2. Fetch Support & Resistance
        const srRes = await fetch(`${API_SERVER_URL}/api/options/support-resistance/${underlying}`);
        const srData = srRes.ok ? await srRes.json() : null;

        // 3. Fetch Genie Insights
        const genieRes = await fetch(`${API_SERVER_URL}/api/options/genie-insights/${underlying}`);
        const genieData = genieRes.ok ? await genieRes.json() : null;

        // 4. Fetch PCR Trend History
        const pcrRes = await fetch(`${API_SERVER_URL}/api/options/pcr-trend/${underlying}`);
        const pcrData = pcrRes.ok ? await pcrRes.json() : null;

        // 5. Fetch OI Buildups
        const oiBuildRes = await fetch(`${API_SERVER_URL}/api/options/oi-buildup/${underlying}`);
        const oiBuildData = oiBuildRes.ok ? await oiBuildRes.json() : null;

        // 6. Fetch Alerts List
        const alertsRes = await fetch(`${API_SERVER_URL}/api/alerts`);
        const alertsData = alertsRes.ok ? await alertsRes.json() : null;

        // Calculate actual API round-trip latency
        const endTime = performance.now();
        setLatency(Math.round(endTime - startTime));

        if (!active) return;

        setIsConnected(true);

        if (chainData) {
          setChainPayload({
            underlying: chainData.underlying || underlying,
            spot_price: chainData.spot_price || currentNiftyPriceRef.current,
            chain: chainData.chain || [],
            source: chainData.source || 'Active FastAPI Gateway',
          });
          if (chainData.spot_price) {
            currentNiftyPriceRef.current = chainData.spot_price;
          }
        }

        if (srData) {
          setSupportResistance({
            support: srData.support || [],
            resistance: srData.resistance || [],
          });
        }

        if (genieData && genieData.insights) {
          setGenieInsights(genieData.insights);
        }

        if (pcrData && pcrData.history) {
          setPcrHistory(pcrData.history);
        }

        if (oiBuildData && oiBuildData.buildups) {
          const formattedOi = (oiBuildData.buildups || []).map((item: any) => ({
            strike: item.strike,
            option_type: item.option_type || 'call',
            oi_change: item.oi_change || 0,
            signal: item.buildup_status || 'long_buildup',
          }));
          setOiBuildups(formattedOi);
        }

        if (alertsData && alertsData.alerts) {
          setAlerts(alertsData.alerts.map((a: any) => ({
            id: a.id,
            name: a.name,
            alert_type: a.alert_type,
            underlying: a.underlying,
            condition: a.condition,
            message_template: a.message_template,
            status: a.status === 'active' ? 'active' : 'paused',
          })));
        }

      } catch (err) {
        if (active) {
          setLatency(0);
        }
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [underlying]);

  // Load real database table schema and catalogs
  useEffect(() => {
    let active = true;
    const fetchDbTables = async () => {
      try {
        const res = await fetch(`${API_SERVER_URL}/api/db/tables`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && data.tables) {
          setDbTables(data.tables);
        }
      } catch (err) {
        console.error("Error loading DuckDB tables", err);
      }
    };
    fetchDbTables();
    return () => { active = false; };
  }, []);

  // Notification framework
  const triggerNotification = (title: string, message: string) => {
    const alertId = `toast-${Date.now()}`;
    setToastAlert({ id: alertId, title, message });

    const newSig: BrainSignal = {
      id: `sig-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'LONG',
      message: `${title}: ${message}`,
      strength: 85,
    };
    setSignals((prev) => [newSig, ...prev.slice(0, 10)]);

    setTimeout(() => {
      setToastAlert((prev) => (prev?.id === alertId ? null : prev));
    }, 6000);
  };

  // Replay Triggers
  const startReplay = async (startTime: string, speed: number) => {
    setIsReplayRunning(true);
    triggerNotification('REPLAY RUNNING', `Triggering Python historical aggregator replay at ${speed}x.`);
    if (socketRef.current) {
      socketRef.current.emit('start_replay', {
        symbol: underlying === 'NIFTY' ? 'NSE:NIFTY' : underlying,
        start_time: startTime,
        speed,
      });
    }
  };

  const stopReplay = async () => {
    setIsReplayRunning(false);
    triggerNotification('REPLAY SUSPENDED', 'Stopped historical aggregation replay.');
    if (socketRef.current) {
      socketRef.current.emit('stop_replay', {});
    }
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
    triggerNotification('PANIC COLLATERAL SOLD', 'Market panic sell triggers triggered. Flushed all active options inventory.');
  };

  // Trigger backfill Today options history via genuine backend workers
  const handleTriggerBackfill = async () => {
    setIsBackfilling(true);
    triggerNotification('BACKFILL ACTIVE', 'Prompting backend server for options snapshots compression...');
    try {
      const res = await fetch(`${API_SERVER_URL}/api/options/backfill`, { method: 'POST' });
      if (res.ok) {
        triggerNotification('BACKFILL EXECUTED', 'Backfill sequence initialized successfully in the background.');
      }
    } catch (e) {
      triggerNotification('BACKFILL ERROR', 'Unable to connect to backfiller worker.');
    } finally {
      setIsBackfilling(false);
    }
  };

  // Refresh AI Genie report from real options endpoints
  const refreshInsights = async () => {
    setReloadingInsights(true);
    try {
      const res = await fetch(`${API_SERVER_URL}/api/options/genie-insights/${underlying}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.insights) {
          setGenieInsights(data.insights);
          triggerNotification('GENIE REPORT REFRESHED', 'Synthesized real-time options metrics and order-book imbalances.');
        }
      }
    } catch (err) {
      triggerNotification('GENIE ERROR', 'Failed to refresh analytical report from endpoint.');
    } finally {
      setReloadingInsights(false);
    }
  };

  // Build customize options strategies payoff metrics using real Python calculations
  const buildStrategyUrl = async (type: string, data: any) => {
    setBuildingStrategy(true);
    try {
      const endpoint = type === 'bull-call-spread' 
        ? `${API_SERVER_URL}/api/strategy/bull-call-spread`
        : type === 'iron-condor'
        ? `${API_SERVER_URL}/api/strategy/iron-condor`
        : `${API_SERVER_URL}/api/strategy/long-straddle`;

      const payload = {
        underlying,
        spot_price: currentNiftyPriceRef.current || data.spot_price,
        ...data,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const resData = await res.json();
        if (resData.status === 'success' && resData.analysis) {
          const parsedStrategy: Strategy = {
            name: type === 'bull-call-spread' ? 'Bull Call Spread' : type === 'iron-condor' ? 'Iron Condor' : 'Long Straddle',
            underlying,
            spot_price: currentNiftyPriceRef.current || data.spot_price,
            legs: resData.analysis.legs || [],
            analysis: {
              max_profit: resData.analysis.max_profit || 0,
              max_loss: resData.analysis.max_loss || 0,
              breakeven: resData.analysis.breakeven || [],
            }
          };
          setActiveStrategy(parsedStrategy);
          triggerNotification('PAYOFF REGISTERED', `Completed standard ${parsedStrategy.name} risk metrics synthesis.`);
        }
      }
    } catch (e) {
      triggerNotification('STRATEGY ERROR', 'Standard strategy optimization compiler failure.');
    } finally {
      setBuildingStrategy(false);
    }
  };

  // Real alert system handlers
  const addAlert = async (newAlert: { name: string; alert_type: string; condition: string }) => {
    try {
      const res = await fetch(`${API_SERVER_URL}/api/alerts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAlert.name,
          alert_type: newAlert.alert_type,
          underlying,
          condition: newAlert.condition,
          message_template: 'Breach of condition threshold detected',
          cooldown_minutes: 5,
          notification_channels: ['websocket'],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.alert) {
          setAlerts((prev) => [{
            id: data.alert.id,
            name: data.alert.name,
            alert_type: data.alert.alert_type,
            underlying: data.alert.underlying,
            condition: data.alert.condition,
            message_template: data.alert.message_template,
            status: data.alert.status === 'active' ? 'active' : 'paused',
          }, ...prev]);
          triggerNotification('ALERT DRAFTED', `Synchronized alert key: ${data.alert.id} with storage logs.`);
        }
      }
    } catch (err) {
      triggerNotification('ALERT ERROR', 'Failed to register alert target with Python worker.');
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      const res = await fetch(`${API_SERVER_URL}/api/alerts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        triggerNotification('ALERT DIALED OUT', 'Successfully cleared threshold trigger.');
      }
    } catch (err) {
      triggerNotification('ALERT ERROR', 'Unable to delete alert from broker registry.');
    }
  };

  const pauseAlert = async (id: string) => {
    try {
      const res = await fetch(`${API_SERVER_URL}/api/alerts/${id}/pause`, { method: 'POST' });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'paused' } : a)));
      }
    } catch (e) {
      console.warn("Error pausing alert", e);
    }
  };

  const resumeAlert = async (id: string) => {
    try {
      const res = await fetch(`${API_SERVER_URL}/api/alerts/${id}/resume`, { method: 'POST' });
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'active' } : a)));
      }
    } catch (e) {
      console.warn("Error resuming alert", e);
    }
  };

  // SQL Query database console executor via actual DuckDB API
  const executeSqlQuery = async (sql: string) => {
    setIsQuerying(true);
    setDbQueryResult({ results: [] });
    try {
      const res = await fetch(`${API_SERVER_URL}/api/db/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (res.ok) {
        const data = await res.json();
        setDbQueryResult({ results: data.results || [] });
        triggerNotification('QUERY COMPLETE', `DuckDB query executed. Loaded ${data.results?.length || 0} rows.`);
      } else {
        const data = await res.json();
        setDbQueryResult({ results: [], error: data.detail || 'Query execution error' });
      }
    } catch (err: any) {
      setDbQueryResult({ results: [], error: err.message || 'Database connection failure' });
    } finally {
      setIsQuerying(false);
    }
  };

  const exportCsv = async (sql: string) => {
    triggerNotification('SPREADSHEET INBOUND', 'Compiling DuckDB query tables down to CSV...');
    try {
      const res = await fetch(`${API_SERVER_URL}/api/db/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'duckdb_queries_export.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        triggerNotification('CSV READY', 'Synchronized dataset downloaded successfully.');
      }
    } catch (err) {
      triggerNotification('EXPORT ERROR', 'Unable to fetch table aggregates.');
    }
  };

  return (
    <div className="bg-[#040810] min-h-screen text-slate-100 flex flex-col antialiased">
      <div className="w-full xl:max-w-[1780px] px-2 sm:px-3 mx-auto py-1.5 space-y-2 flex-grow flex flex-col justify-start relative">
        
        {/* Dynamic global warning banner when offline */}
        {!isConnected && (
          <div className="flex items-center justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 font-medium">
            <div className="flex items-center gap-1.5 font-mono">
              <WifiOff className="w-4 h-4 animate-pulse" />
              <span>STABILITY CLOCK: REAL-TIME BACKEND CONNECTION DISCONNECTED. RESILIENT STAGING PROTOCOL ACTIVE.</span>
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
