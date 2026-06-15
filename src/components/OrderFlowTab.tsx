/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, ZoomIn, ZoomOut, RotateCcw, Info, Sliders, Zap, CircleAlert, Waves } from 'lucide-react';
import { MarketTick, TradeLog } from '../types';

interface OrderFlowTabProps {
  niftyLtp: number;
  ticks: MarketTick[];
  tradeLogs: TradeLog[];
}

interface DepthQuote {
  bidP: number;
  bidQ: number;
  askP: number;
  askQ: number;
}

interface DepthSnapshot {
  ts: number;
  quotes: DepthQuote[];
}

interface InteractiveTrade {
  id: string;
  ltp: number;
  ltq: number;
  timestamp: number;
  aggressor: 'Buy' | 'Sell' | 'Neutral';
  symbol: string;
}

interface CompiledOHLC {
  timestamp: number; // aligned start interval
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: InteractiveTrade[];
  absorption?: 'Bullish' | 'Bearish' | 'None';
}

interface VacuumEvent {
  timestamp: number;
  type: 'Bullish' | 'Bearish';
  price: number;
}

export default function OrderFlowTab({ niftyLtp, ticks, tradeLogs }: OrderFlowTabProps) {
  // Config state
  const [dataSource, setDataSource] = useState<'WORKSPACE' | 'SIMULATOR'>('SIMULATOR');
  const [candleIntervalSec, setCandleIntervalSec] = useState<number>(5);
  const [zoomFactor, setZoomFactor] = useState<number>(1.25);
  
  // Audio or alert indicators state
  const [lastEvent, setLastEvent] = useState<{ type: string; price: number; time: string } | null>(null);

  // States managed inside the component
  const [localTrades, setLocalTrades] = useState<InteractiveTrade[]>([]);
  const [localVacuums, setLocalVacuums] = useState<VacuumEvent[]>([]);

  // Canvas details
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Constants
  const TICK_SIZE = 0.05;
  const VP_WIDTH = 80;
  const PRICE_SCALE_WIDTH = 60;
  const MARGIN = { top: 20, right: PRICE_SCALE_WIDTH, bottom: 30, left: VP_WIDTH };
  const BASE_VISIBLE_BARS = 30;

  // Live state refs
  const tradeHistoryRef = useRef<InteractiveTrade[]>([]);
  const depthHistoryRef = useRef<DepthSnapshot[]>([]);
  const ohlcBarsRef = useRef<CompiledOHLC[]>([]);
  const vacuumTrackerRef = useRef<VacuumEvent[]>([]);

  // Simulation timing refs
  const loopActiveRef = useRef<boolean>(true);
  const tickGeneratorTimerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Viewport navigation parameters
  const [centerTimeMs, setCenterTimeMs] = useState<number>(Date.now());
  const [visibleTimeWindowMs, setVisibleTimeWindowMs] = useState<number>(30 * 5000);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);

  const centerTimeMsRef = useRef<number>(Date.now());
  const visibleTimeWindowMsRef = useRef<number>(30 * 5000);
  const autoFollowRef = useRef<boolean>(true);

  // Sync state refs to avoid stale values in closures/animation frame
  useEffect(() => {
    centerTimeMsRef.current = centerTimeMs;
  }, [centerTimeMs]);

  useEffect(() => {
    visibleTimeWindowMsRef.current = visibleTimeWindowMs;
  }, [visibleTimeWindowMs]);

  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  // Dimension states
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 480 });

  // Update candle interval
  useEffect(() => {
    setVisibleTimeWindowMs(BASE_VISIBLE_BARS * (candleIntervalSec * 1000));
  }, [candleIntervalSec]);

  // Handle ResizeObserver
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasDimensions({
          width: Math.max(width, 300),
          height: Math.max(height, 350),
        });
      }
    });

    resizeObserver.observe(canvasContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Sync WORKSPACE inputs when they arrive from App.tsx
  useEffect(() => {
    if (dataSource !== 'WORKSPACE') return;

    if (ticks.length === 0) return;

    // Map workspace ticks & trades
    const latestTick = ticks[0];
    const timestamp = latestTick.ts_ms || Date.now();
    const ltp = latestTick.price;
    const qty = latestTick.volume || Math.floor(Math.random() * 400) + 100;

    // Synthesize aggressor side
    const aggressor = Math.random() > 0.5 ? 'Buy' : 'Sell';

    const cleanTrade: InteractiveTrade = {
      id: `ws-${timestamp}-${Math.random()}`,
      ltp,
      ltq: qty,
      timestamp,
      aggressor: aggressor as 'Buy' | 'Sell',
      symbol: latestTick.instrumentKey || 'NSE:NIFTY',
    };

    // Feed to the processing pipeline
    injectNewTradeAndDepth(cleanTrade, timestamp);

  }, [ticks, dataSource]);


  // Helper: Aggregates trade lists into OHLC buckets
  const aggregateOHLC = (trade: InteractiveTrade, candleDurationMs: number) => {
    const rawTime = trade.timestamp;
    const alignedStart = Math.floor(rawTime / candleDurationMs) * candleDurationMs;

    let bar = ohlcBarsRef.current.find((b) => b.timestamp === alignedStart);

    if (!bar) {
      bar = {
        timestamp: alignedStart,
        open: trade.ltp,
        high: trade.ltp,
        low: trade.ltp,
        close: trade.ltp,
        volume: trade.ltq,
        trades: [trade],
      };
      ohlcBarsRef.current.push(bar);
    } else {
      bar.high = Math.max(bar.high, trade.ltp);
      bar.low = Math.min(bar.low, trade.ltp);
      bar.close = trade.ltp;
      bar.volume += trade.ltq;
      bar.trades.push(trade);
    }

    // Trigger absorption analysis on the bar
    const barState = analyzeAbsorption(bar);
    bar.absorption = barState;

    if (barState !== 'None' && barState) {
      const timeStr = new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastEvent({
        type: `Absorption (${barState})`,
        price: bar.close,
        time: timeStr,
      });
    }

    // Sort to keep ordered
    ohlcBarsRef.current.sort((a, b) => a.timestamp - b.timestamp);
  };

  // Absorption Analysis: Checking wick congestion vs total volume
  const analyzeAbsorption = (bar: CompiledOHLC): 'Bullish' | 'Bearish' | 'None' => {
    if (bar.trades.length < 5) return 'None';

    const range = bar.high - bar.low;
    if (range < TICK_SIZE) return 'None';

    const upperZoneLimit = bar.high - range * 0.25;
    const lowerZoneLimit = bar.low + range * 0.25;

    let upperVol = 0;
    let lowerVol = 0;
    let upperBuyVol = 0;
    let lowerSellVol = 0;

    bar.trades.forEach((t) => {
      if (t.ltp >= upperZoneLimit) {
        upperVol += t.ltq;
        if (t.aggressor === 'Buy') upperBuyVol += t.ltq;
      }
      if (t.ltp <= lowerZoneLimit) {
        lowerVol += t.ltq;
        if (t.aggressor === 'Sell') lowerSellVol += t.ltq;
      }
    });

    const totalVol = bar.volume;
    const minVolThresh = totalVol * 0.25; // 25% of total bar volume must trade in the zone

    // Coward rejection: Sellers pushed heavily but buyers absorbed it, closing high
    const lowerWick = Math.min(bar.open, bar.close) - bar.low;
    if (lowerVol > minVolThresh && lowerSellVol / lowerVol > 0.58 && lowerWick > TICK_SIZE * 3) {
      return 'Bullish';
    }

    // Bull failure: Buyers pushed heavily at highs, but sellers absorbed, closing low
    const upperWick = bar.high - Math.max(bar.open, bar.close);
    if (upperVol > minVolThresh && upperBuyVol / upperVol > 0.58 && upperWick > TICK_SIZE * 3) {
      return 'Bearish';
    }

    return 'None';
  };

  // Vacuum Detection Engine (Liquidity gaps)
  const detectVacuum = (timestamp: number, currentQuotes: DepthQuote[], latestTrade: InteractiveTrade) => {
    const historyLen = 10;
    if (depthHistoryRef.current.length < historyLen) return;

    const oldSnapshot = depthHistoryRef.current[historyLen - 1];
    if (!oldSnapshot || oldSnapshot.quotes.length === 0 || currentQuotes.length === 0) return;

    const oldBidQ = oldSnapshot.quotes[0]?.bidQ || 0;
    const oldAskQ = oldSnapshot.quotes[0]?.askQ || 0;

    const currentBidQ = currentQuotes[0]?.bidQ || 0;
    const currentAskQ = currentQuotes[0]?.askQ || 0;

    // Check 90% reduction of depth
    const bidDrop = oldBidQ > 0 ? (oldBidQ - currentBidQ) / oldBidQ : 0;
    const askDrop = oldAskQ > 0 ? (oldAskQ - currentAskQ) / oldAskQ : 0;

    let vacuumDetected: 'Bullish' | 'Bearish' | null = null;

    if (askDrop >= 0.9 && oldAskQ >= 2000 && latestTrade.aggressor === 'Buy') {
      vacuumDetected = 'Bullish';
    } else if (bidDrop >= 0.9 && oldBidQ >= 2000 && latestTrade.aggressor === 'Sell') {
      vacuumDetected = 'Bearish';
    }

    if (vacuumDetected) {
      const isDuplicate = vacuumTrackerRef.current.some(
        (ev) => Math.abs(ev.timestamp - timestamp) < 1500 && ev.type === vacuumDetected
      );

      if (!isDuplicate) {
        const ev: VacuumEvent = {
          timestamp,
          type: vacuumDetected,
          price: latestTrade.ltp,
        };
        vacuumTrackerRef.current.push(ev);
        
        const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastEvent({
          type: `Vacuum Block (${vacuumDetected})`,
          price: latestTrade.ltp,
          time: timeStr,
        });

        // Trigger safe state hooks to show logs on the React panel
        setLocalVacuums((prev) => [ev, ...prev.slice(0, 15)]);
      }
    }
  };

  // Main Pipeline processing single tick ingestion
  const injectNewTradeAndDepth = (trade: InteractiveTrade, ts: number) => {
    // Save to trade cache ref
    tradeHistoryRef.current.push(trade);
    if (tradeHistoryRef.current.length > 3000) tradeHistoryRef.current.shift();

    // Generate simulated matching Depth quotes
    const spread = TICK_SIZE * (Math.random() > 0.85 ? 2 : 1);
    const bestBid = parseFloat((trade.ltp - spread / 2).toFixed(2));
    const bestAsk = parseFloat((trade.ltp + spread / 2).toFixed(2));

    const quotes: DepthQuote[] = [];
    const depthLevels = 5;

    for (let i = 0; i < depthLevels; i++) {
      const bidP = parseFloat((bestBid - i * TICK_SIZE).toFixed(2));
      const askP = parseFloat((bestAsk + i * TICK_SIZE).toFixed(2));

      // Calculate base size mapping
      let baseQ = Math.floor(2500 * Math.exp(-i / 1.8));
      
      // Inject random wiggles on depth sizes
      let bidQ = Math.floor(baseQ * (0.75 + Math.random() * 0.5));
      let askQ = Math.floor(baseQ * (0.75 + Math.random() * 0.5));

      // Occasional vacuum simulation parameters inside depth quotes (if in Simulator Mode)
      if (dataSource === 'SIMULATOR' && Math.random() > 0.93 && i === 0) {
        if (Math.random() > 0.5) {
          askQ = Math.floor(askQ * 0.05); // Slash ask liquidity
        } else {
          bidQ = Math.floor(bidQ * 0.05); // Slash bid liquidity
        }
      }

      quotes.push({ bidP, bidQ, askP, askQ });
    }

    const depthSnapshot: DepthSnapshot = { ts, quotes };
    depthHistoryRef.current.unshift(depthSnapshot);

    if (depthHistoryRef.current.length > 2000) depthHistoryRef.current.pop();

    // Process Candlesticks
    aggregateOHLC(trade, candleIntervalSec * 1000);

    // Detect Vacuum anomalies
    detectVacuum(ts, quotes, trade);

    // Keep state lists updated for the tape logs rendering panel
    setLocalTrades((prev) => [trade, ...prev.slice(0, 50)]);

    // Follow automatically
    if (autoFollowRef.current) {
      setCenterTimeMs(ts);
    }
  };


  // Simulate dynamic high-speed market tick stream (SIMULATOR mode)
  useEffect(() => {
    if (dataSource !== 'SIMULATOR') {
      if (tickGeneratorTimerRef.current) {
        clearInterval(tickGeneratorTimerRef.current);
        tickGeneratorTimerRef.current = null;
      }
      return;
    }

    let currentSimPrice = niftyLtp > 20000 ? niftyLtp : 22150.40;

    tickGeneratorTimerRef.current = setInterval(() => {
      const ts = Date.now();
      const change = (Math.random() * 2 - 1) * TICK_SIZE;
      currentSimPrice = parseFloat((currentSimPrice + change).toFixed(2));

      const qty = Math.floor(Math.random() * 600) + 50;
      const aggressor = Math.random() > 0.46 ? 'Buy' : 'Sell';

      const complexTrade: InteractiveTrade = {
        id: `sim-${ts}-${Math.random()}`,
        ltp: currentSimPrice,
        ltq: qty,
        timestamp: ts,
        aggressor: aggressor as 'Buy' | 'Sell',
        symbol: 'NIFTY:SIM',
      };

      // Ingest
      injectNewTradeAndDepth(complexTrade, ts);

    }, 250); // fast 4 ticks per second

    return () => {
      if (tickGeneratorTimerRef.current) {
        clearInterval(tickGeneratorTimerRef.current);
      }
    };
  }, [dataSource, handyLtpSource(niftyLtp)]);


  // Help sync nifty spot price changes in simulator smoothly
  function handyLtpSource(ltp: number) {
    // Return approximate level of spot to prevent restarting loop on every tiny wiggle
    return Math.round(ltp / 5) * 5;
  }

  // Double Check canvas context and start Rendering tick cycles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    loopActiveRef.current = true;

    const innerAnimateLoop = () => {
      if (!loopActiveRef.current) return;

      renderCanvas(ctx, canvasDimensions.width, canvasDimensions.height);
      animationFrameRef.current = requestAnimationFrame(innerAnimateLoop);
    };

    innerAnimateLoop();

    return () => {
      loopActiveRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasDimensions, centerTimeMs, visibleTimeWindowMs, dataSource, candleIntervalSec]);


  // Clear state when switching modes
  const handleResetData = () => {
    tradeHistoryRef.current = [];
    depthHistoryRef.current = [];
    ohlcBarsRef.current = [];
    vacuumTrackerRef.current = [];
    setLocalTrades([]);
    setLocalVacuums([]);
    setCenterTimeMs(Date.now());
    setAutoFollow(true);
    setLastEvent(null);
  };


  // Zoom scaling utilities
  const handleZoom = (factor: number) => {
    setAutoFollow(false);
    setVisibleTimeWindowMs((prev) => {
      const next = prev * factor;
      return Math.max(15000, Math.min(1800000, next)); // capped between 15s and 30m
    });
  };

  const handleResetView = () => {
    setCenterTimeMs(Date.now());
    setVisibleTimeWindowMs(BASE_VISIBLE_BARS * (candleIntervalSec * 1000));
    setAutoFollow(true);
  };


  // Canvas Coordinates Translators
  function scaleY(price: number, minPrice: number, maxPrice: number, height: number): number {
    const chartHeight = height - MARGIN.top - MARGIN.bottom;
    const priceRange = maxPrice - minPrice;
    if (priceRange === 0) return height / 2;
    const norm = (price - minPrice) / priceRange;
    return height - MARGIN.bottom - norm * chartHeight;
  }

  function scaleX(ts: number, minTime: number, maxTime: number, width: number): number {
    const drawableWidth = width - MARGIN.right;
    const timeRange = maxTime - minTime;
    if (timeRange === 0) return MARGIN.left;
    const norm = (ts - minTime) / timeRange;
    return MARGIN.left + norm * (drawableWidth - MARGIN.left);
  }


  // Mouse Grab/Pan & Zoom actions support
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    setAutoFollow(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - dragStartXRef.current;
    dragStartXRef.current = e.clientX;

    const canvasWidth = canvasDimensions.width;
    const drawableWidth = canvasWidth - MARGIN.right - MARGIN.left;
    const timePerPixel = visibleTimeWindowMs / drawableWidth;
    const timeDelta = deltaX * timePerPixel * -1;

    setCenterTimeMs((prev) => prev + timeDelta);
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setAutoFollow(false);
    if (e.deltaY < 0) {
      handleZoom(1 / zoomFactor);
    } else {
      handleZoom(zoomFactor);
    }
  };


  // Extents Calculator: scan visible timeframe to scale vertical bounds nicely
  const getVisibleBounds = (minTime: number, maxTime: number) => {
    const historicalTrades = tradeHistoryRef.current;
    
    // Default fallback base
    const defaultSpot = niftyLtp > 0 ? niftyLtp : 22150.0;
    const allPrices: number[] = [];

    // Gather trade prices in visible frame
    const visibleTrs = historicalTrades.filter((t) => t.timestamp >= minTime && t.timestamp <= maxTime);
    visibleTrs.forEach((t) => allPrices.push(t.ltp));

    // Gather depth levels mapped
    const visibleDepths = depthHistoryRef.current.filter((d) => d.ts >= minTime && d.ts <= maxTime);
    visibleDepths.forEach((snap) => {
      snap.quotes.forEach((level) => {
        allPrices.push(level.bidP);
        allPrices.push(level.askP);
      });
    });

    if (allPrices.length === 0) {
      return {
        minPrice: defaultSpot - 1.5,
        maxPrice: defaultSpot + 1.5,
      };
    }

    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const buffer = Math.max(0.2, (maxP - minP) * 0.1);

    return {
      minPrice: minP - buffer,
      maxPrice: maxP + buffer,
    };
  };


  // Main Canvas Painter
  const renderCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    const halfWindow = visibleTimeWindowMsRef.current / 2;
    const minTime = centerTimeMsRef.current - halfWindow;
    const maxTime = centerTimeMsRef.current + halfWindow;

    const { minPrice, maxPrice } = getVisibleBounds(minTime, maxTime);

    const scaleY_fn = (p: number) => scaleY(p, minPrice, maxPrice, height);
    const scaleX_fn = (t: number) => scaleX(t, minTime, maxTime, width);

    // 1. Draw Volume Profile Panel (Left margin)
    drawVolumeProfile(ctx, scaleY_fn, minPrice, maxPrice, minTime, maxTime, height);

    // 2. Draw Horizontal Price Grids & Vertical Time Grids
    drawBackgroundGrids(ctx, scaleY_fn, scaleX_fn, minPrice, maxPrice, minTime, maxTime, width, height);

    // 3. Draw Depth L2 Heatmap (Bids Greenish, Asks Reddish)
    drawDepthHeatmap(ctx, scaleX_fn, scaleY_fn, minTime, maxTime, width, height);

    // 4. Draw Aggregate Candlesticks
    drawCandlesticks(ctx, scaleX_fn, scaleY_fn, minTime, maxTime, width, height);

    // 5. Draw Individual Tape Trade Dots
    drawTradeVolumeDots(ctx, scaleX_fn, scaleY_fn, minTime, maxTime, minPrice, maxPrice, width, height);

    // 6. Draw Vacuum depletion badges (Triangles)
    drawVacuumBadges(ctx, scaleX_fn, scaleY_fn, minTime, maxTime, width, height);

    // 7. Right Hand scale pricing labels
    drawRightPriceLabels(ctx, scaleY_fn, minPrice, maxPrice, width, height);

    // 8. Draw active Spot Price Indicator line
    if (tradeHistoryRef.current.length > 0) {
      const activeLTP = tradeHistoryRef.current[tradeHistoryRef.current.length - 1].ltp;
      const yLTP = scaleY_fn(activeLTP);
      drawActiveLtpIndicator(ctx, yLTP, activeLTP, width);
    }
  };


  // Draw Horizon Volume Profile
  const drawVolumeProfile = (
    ctx: CanvasRenderingContext2D,
    scaleY_fn: (p: number) => number,
    minPrice: number,
    maxPrice: number,
    minTime: number,
    maxTime: number,
    height: number
  ) => {
    const bucketSize = 0.5; // step size for profiling
    const volByPrice: Record<string, number> = {};
    let maxTotalVol = 0;

    // Filter trades in view
    const visibleTrs = tradeHistoryRef.current.filter((t) => t.timestamp >= minTime && t.timestamp <= maxTime);
    
    visibleTrs.forEach((t) => {
      const bucketPrice = Math.round(t.ltp / bucketSize) * bucketSize;
      const key = bucketPrice.toFixed(2);
      volByPrice[key] = (volByPrice[key] || 0) + t.ltq;
      maxTotalVol = Math.max(maxTotalVol, volByPrice[key]);
    });

    const profLeftLimit = 5;
    const profRightLimit = VP_WIDTH - 5;
    const profWidth = profRightLimit - profLeftLimit;

    // Find Point of Control (POC)
    let pocKey = '';
    let pocVal = -1;
    for (const key in volByPrice) {
      if (volByPrice[key] > pocVal) {
        pocVal = volByPrice[key];
        pocKey = key;
      }
    }

    ctx.save();
    for (const key in volByPrice) {
      const pr = parseFloat(key);
      const vol = volByPrice[key];
      const yTop = scaleY_fn(pr + bucketSize / 2);
      const yBottom = scaleY_fn(pr - bucketSize / 2);
      const barH = Math.max(1, yBottom - yTop);

      const ratio = vol / (maxTotalVol || 1);
      const currWidth = ratio * profWidth;
      const xStart = profRightLimit - currWidth;

      ctx.fillStyle = key === pocKey ? '#facc15' : '#4b5563'; // POC gold, others slate
      ctx.globalAlpha = 0.6;
      ctx.fillRect(xStart, yTop, currWidth, barH);
    }
    ctx.restore();

    // Line dividing profile from main view
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(VP_WIDTH, MARGIN.top);
    ctx.lineTo(VP_WIDTH, height - MARGIN.bottom);
    ctx.stroke();
  };


  // Background Grid markings
  const drawBackgroundGrids = (
    ctx: CanvasRenderingContext2D,
    scaleY_fn: (p: number) => number,
    scaleX_fn: (t: number) => number,
    minPrice: number,
    maxPrice: number,
    minTime: number,
    maxTime: number,
    width: number,
    height: number
  ) => {
    ctx.save();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 0.5;

    const drawableWidth = width - MARGIN.right;

    // 1. Horizontal price levels
    const priceDiff = maxPrice - minPrice;
    let step = 0.5;
    if (priceDiff < 1) step = 0.1;
    else if (priceDiff > 15) step = 2;
    else if (priceDiff > 40) step = 5;

    let pr = Math.ceil(minPrice / step) * step;
    while (pr < maxPrice) {
      const yLoc = scaleY_fn(pr);
      if (yLoc > MARGIN.top && yLoc < height - MARGIN.bottom) {
        ctx.beginPath();
        ctx.moveTo(VP_WIDTH, yLoc);
        ctx.lineTo(drawableWidth, yLoc);
        ctx.stroke();
      }
      pr += step;
    }

    // 2. Vertical time intervals
    const cellCount = 5;
    const timeStep = (maxTime - minTime) / cellCount;
    ctx.fillStyle = '#64748b';
    ctx.font = '8.5px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i <= cellCount; i++) {
      const rawT = minTime + i * timeStep;
      const xLoc = scaleX_fn(rawT);

      if (xLoc > VP_WIDTH && xLoc < drawableWidth) {
        ctx.beginPath();
        ctx.moveTo(xLoc, MARGIN.top);
        ctx.lineTo(xLoc, height - MARGIN.bottom);
        ctx.stroke();

        const label = new Date(rawT).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
        ctx.fillText(label, xLoc, height - MARGIN.bottom + 12);
      }
    }
    ctx.restore();
  };


  // Depth L2 Level Heatmaps (Opacity based size representation)
  const drawDepthHeatmap = (
    ctx: CanvasRenderingContext2D,
    scaleX_fn: (t: number) => number,
    scaleY_fn: (p: number) => number,
    minTime: number,
    maxTime: number,
    width: number,
    height: number
  ) => {
    const historicalSnaps = depthHistoryRef.current;
    const visibleSnaps = historicalSnaps.filter((d) => d.ts >= minTime && d.ts <= maxTime);

    ctx.save();
    for (let i = 0; i < visibleSnaps.length; i++) {
      const snap = visibleSnaps[i];
      const nextSnapTime = i + 1 < visibleSnaps.length ? visibleSnaps[i + 1].ts : snap.ts - 1000;

      const xBeg = scaleX_fn(nextSnapTime);
      const xEnd = scaleX_fn(snap.ts);
      const cellW = Math.max(1, xEnd - xBeg);

      const decayFactor = 1 - i / (visibleSnaps.length || 1) * 0.7; // Fade older snapshots

      snap.quotes.forEach((level) => {
        // Bids: green glow
        const bidY = scaleY_fn(level.bidP);
        const bidRatio = Math.min(1, level.bidQ / 1600);
        if (bidRatio > 0.05 && bidY > MARGIN.top && bidY < height - MARGIN.bottom) {
          ctx.fillStyle = '#10b981'; // Green
          ctx.globalAlpha = 0.08 * bidRatio * decayFactor;
          ctx.fillRect(xBeg, bidY - 2.5, cellW, 5);
        }

        // Asks: red glow
        const askY = scaleY_fn(level.askP);
        const askRatio = Math.min(1, level.askQ / 1600);
        if (askRatio > 0.05 && askY > MARGIN.top && askY < height - MARGIN.bottom) {
          ctx.fillStyle = '#f43f5e'; // Deep Red
          ctx.globalAlpha = 0.08 * askRatio * decayFactor;
          ctx.fillRect(xBeg, askY - 2.5, cellW, 5);
        }
      });
    }
    ctx.restore();
  };


  // Aggregate candlestick outlines
  const drawCandlesticks = (
    ctx: CanvasRenderingContext2D,
    scaleX_fn: (t: number) => number,
    scaleY_fn: (p: number) => number,
    minTime: number,
    maxTime: number,
    width: number,
    height: number
  ) => {
    const bars = ohlcBarsRef.current;
    const currentDurMs = candleIntervalSec * 1000;

    // Filter bars in screen space
    const visibleBars = bars.filter((b) => b.timestamp >= minTime - currentDurMs && b.timestamp <= maxTime + currentDurMs);
    const cellSpanWidth = (width - MARGIN.right - MARGIN.left) / (visibleTimeWindowMsRef.current / currentDurMs);
    const barWidth = Math.max(3, cellSpanWidth * 0.7);

    ctx.save();
    visibleBars.forEach((b) => {
      // Draw middle timestamp point on candle axis
      const xVal = scaleX_fn(b.timestamp + currentDurMs / 2);

      // Wick High to Low
      const yHigh = scaleY_fn(b.high);
      const yLow = scaleY_fn(b.low);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xVal, yHigh);
      ctx.lineTo(xVal, yLow);
      ctx.stroke();

      // Open/Close block body
      const yOpen = scaleY_fn(b.open);
      const yClose = scaleY_fn(b.close);
      const bodyTop = Math.min(yOpen, yClose);
      const bodyH = Math.max(1.5, Math.abs(yOpen - yClose));

      const isBullish = b.close >= b.open;
      ctx.fillStyle = isBullish ? '#064e3b' : '#7f1d1d'; // dark styled fills
      ctx.strokeStyle = isBullish ? '#10b981' : '#ef4444'; // brighter outlines
      ctx.lineWidth = 1.2;

      ctx.fillRect(xVal - barWidth / 2, bodyTop, barWidth, bodyH);
      ctx.strokeRect(xVal - barWidth / 2, bodyTop, barWidth, bodyH);

      // Render Rejection Absorption diamond tags
      if (b.absorption && b.absorption !== 'None') {
        const diaSize = 7;
        ctx.beginPath();
        if (b.absorption === 'Bullish') {
          // Pointed at lower wick low
          ctx.fillStyle = '#60a5fa'; // Blue Diamond
          ctx.moveTo(xVal, yLow + diaSize);
          ctx.lineTo(xVal + diaSize / 2, yLow + diaSize / 2);
          ctx.lineTo(xVal, yLow);
          ctx.lineTo(xVal - diaSize / 2, yLow + diaSize / 2);
        } else {
          // Pointed at upper wick high
          ctx.fillStyle = '#fbbf24'; // Yellow Diamond
          ctx.moveTo(xVal, yHigh - diaSize);
          ctx.lineTo(xVal + diaSize / 2, yHigh - diaSize / 2);
          ctx.lineTo(xVal, yHigh);
          ctx.lineTo(xVal - diaSize / 2, yHigh - diaSize / 2);
        }
        ctx.closePath();
        ctx.fill();
      }
    });
    ctx.restore();
  };


  // Draw Trade Volume Dots popped
  const drawTradeVolumeDots = (
    ctx: CanvasRenderingContext2D,
    scaleX_fn: (t: number) => number,
    scaleY_fn: (p: number) => number,
    minTime: number,
    maxTime: number,
    minPrice: number,
    maxPrice: number,
    width: number,
    height: number
  ) => {
    const trades = tradeHistoryRef.current;
    const visibleTrs = trades.filter((t) => t.timestamp >= minTime && t.timestamp <= maxTime);

    ctx.save();
    visibleTrs.forEach((t) => {
      const x = scaleX_fn(t.timestamp);
      const y = scaleY_fn(t.ltp);

      if (x < VP_WIDTH || x > width - MARGIN.right || y < MARGIN.top || y > height - MARGIN.bottom) {
        return;
      }

      // Radius size dependent on quantity volume sizes
      const sizeRatio = Math.min(1, t.ltq / 1200);
      const radius = 2 + sizeRatio * 9;

      let color = '#fbbf24'; // Neutral
      if (t.aggressor === 'Buy') color = '#10b981'; // Green Buy aggressor
      if (t.aggressor === 'Sell') color = '#f43f5e'; // Red Sell aggressor

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.14 + sizeRatio * 0.7; // Large volume has deeper colors
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Outer ring for large blocks
      if (t.ltq >= 500) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
      }
    });
    ctx.restore();
  };


  // Draw Vacuum anomalies triangles
  const drawVacuumBadges = (
    ctx: CanvasRenderingContext2D,
    scaleX_fn: (t: number) => number,
    scaleY_fn: (p: number) => number,
    minTime: number,
    maxTime: number,
    width: number,
    height: number
  ) => {
    const vacuums = vacuumTrackerRef.current;
    const visibleVacs = vacuums.filter((v) => v.timestamp >= minTime && v.timestamp <= maxTime);
    const size = 9;

    ctx.save();
    visibleVacs.forEach((v) => {
      const xVal = scaleX_fn(v.timestamp);
      const yVal = scaleY_fn(v.price);

      if (xVal < VP_WIDTH || xVal > width - MARGIN.right || yVal < MARGIN.top || yVal > height - MARGIN.bottom) {
        return;
      }

      ctx.beginPath();
      if (v.type === 'Bullish') {
        ctx.strokeStyle = '#3b82f6'; // Blue triangle pointing up
        ctx.fillStyle = '#010816';
        ctx.lineWidth = 1.5;
        ctx.moveTo(xVal, yVal - size);
        ctx.lineTo(xVal + size, yVal + size);
        ctx.lineTo(xVal - size, yVal + size);
      } else {
        ctx.strokeStyle = '#f43f5e'; // Red triangle pointing down
        ctx.fillStyle = '#010816';
        ctx.lineWidth = 1.5;
        ctx.moveTo(xVal, yVal + size);
        ctx.lineTo(xVal + size, yVal - size);
        ctx.lineTo(xVal - size, yVal - size);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  };


  // Draw Right Hand Price Grid axis text labels
  const drawPriceScaleLabelRaw = (
    ctx: CanvasRenderingContext2D,
    priceStr: string,
    y: number,
    width: number
  ) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '8.5px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(priceStr, width - MARGIN.right + 6, y + 3);
  };

  const drawRightPriceLabels = (
    ctx: CanvasRenderingContext2D,
    scaleY_fn: (p: number) => number,
    minPrice: number,
    maxPrice: number,
    width: number,
    height: number
  ) => {
    ctx.save();
    // Grid scale boundary line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - MARGIN.right, MARGIN.top);
    ctx.lineTo(width - MARGIN.right, height - MARGIN.bottom);
    ctx.stroke();

    const priceDiff = maxPrice - minPrice;
    let step = 0.5;
    if (priceDiff < 1) step = 0.1;
    else if (priceDiff > 15) step = 2;
    else if (priceDiff > 40) step = 5;

    let pr = Math.ceil(minPrice / step) * step;
    while (pr < maxPrice) {
      const yLoc = scaleY_fn(pr);
      if (yLoc > MARGIN.top && yLoc < height - MARGIN.bottom) {
        drawPriceScaleLabelRaw(ctx, pr.toFixed(2), yLoc, width);
      }
      pr += step;
    }
    ctx.restore();
  };


  // Active Spot label line indicator
  const drawActiveLtpIndicator = (
    ctx: CanvasRenderingContext2D,
    yVal: number,
    activeLtp: number,
    width: number
  ) => {
    if (yVal < MARGIN.top || yVal > canvasDimensions.height - MARGIN.bottom) return;

    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(VP_WIDTH, yVal);
    ctx.lineTo(width - MARGIN.right, yVal);
    ctx.stroke();

    // Fill label background on the scale block
    ctx.setLineDash([]);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(width - MARGIN.right + 2, yVal - 7, MARGIN.right - 4, 14);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(activeLtp.toFixed(1), width - MARGIN.right + MARGIN.right / 2, yVal + 3);
    ctx.restore();
  };


  // UI component rendering
  return (
    <div id="order-flow-desk" className="space-y-2 flex flex-col h-full animate-none">
      
      {/* Interactive Controls Bar Header */}
      <div className="flex flex-col md:flex-row items-center justify-between p-2.5 bg-[#080d1a] border border-[#1e293b] rounded-lg gap-2 flex-shrink-0">
        
        {/* Title elements */}
        <div className="flex items-center space-x-2">
          <Waves className="w-4 h-4 text-emerald-450 animate-pulse text-emerald-400" />
          <div className="flex flex-col">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Order Flow Analytics Terminal
            </h2>
            <span className="text-[9px] text-slate-400 font-mono">
              Microstructure Liquidities • Footprint rejections • Passive Heatmap Layer
            </span>
          </div>
        </div>

        {/* Configurations inputs controllers */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          
          {/* Feed Data Source option toggler */}
          <div className="flex items-center space-x-0.5 border border-slate-800 rounded bg-[#0b0f19] p-0.5">
            <button
              onClick={() => { setDataSource('WORKSPACE'); handleResetData(); }}
              className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold transition-all ${
                dataSource === 'WORKSPACE'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              WORKSPACE LIVE FEED
            </button>
            <button
              onClick={() => { setDataSource('SIMULATOR'); handleResetData(); }}
              className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold transition-all ${
                dataSource === 'SIMULATOR'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              HFT SIMULATOR MODE
            </button>
          </div>

          {/* Candle Duration Selector */}
          <div className="flex items-center space-x-1.5 bg-[#0b0f19] border border-slate-800 px-2 py-1 rounded text-[10.5px]">
            <span className="text-slate-500 font-mono font-bold text-[9px] uppercase">CANDLE INTERVAL:</span>
            <input
              type="number"
              min={1}
              max={15}
              value={candleIntervalSec}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val > 0) setCandleIntervalSec(val);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.2 text-[10px] w-12 text-center text-teal-300 font-bold focus:outline-none focus:border-teal-500"
            />
            <span className="text-slate-500 font-mono text-[9.5px]">s</span>
          </div>

          {/* Scale Actions button arrays */}
          <div className="flex items-center space-x-1 border border-slate-800 bg-[#0b0f19] p-0.5 rounded">
            <button
              onClick={() => handleZoom(1 / zoomFactor)}
              title="Zoom In"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(zoomFactor)}
              title="Zoom Out"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              title="Reset Zoom to center"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetData}
              title="Flush data cache memory"
              className="px-2 py-0.5 text-[9px] font-mono font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 border border-rose-900/30 rounded"
            >
              FLUSH
            </button>
          </div>

          {/* Autofollow status marker pin */}
          <button
            onClick={() => setAutoFollow(!autoFollow)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-colors ${
              autoFollow
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            {autoFollow ? '⬤ AUTO-LOCK ON' : '◯ AUTO-LOCK OFF'}
          </button>
        </div>
      </div>

      {/* Grid containing 1. Canvas, 2. Tape logs, 3. Event stats */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 h-[500px] min-h-[400px] flex-grow select-none">
        
        {/* Canvas visualizer block (Span 9 of 12) */}
        <div className="xl:col-span-9 bg-[#050914] border border-[#141d2f]/70 rounded-lg flex flex-col overflow-hidden relative group">
          <div className="absolute top-1.5 left-2 z-10 select-none pointer-events-none flex items-center space-x-2">
            <span className="text-[9px] bg-indigo-900/40 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold">
              SPOT INDEX: NIFTY ({dataSource === 'WORKSPACE' ? 'WORKSPACE REAL' : 'HFT SIMULATOR'})
            </span>
            <span className="text-[8.5px] text-slate-500 font-mono">
              [Pan view by clicking & dragging inside grid • Scrollwheel zooms]
            </span>
          </div>

          <div
            ref={canvasContainerRef}
            className="w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onWheel={handleWheel}
          >
            <canvas
              ref={canvasRef}
              width={canvasDimensions.width}
              height={canvasDimensions.height}
              className="block"
            />
          </div>

          {/* Live tracking stats values */}
          <div className="absolute bottom-2.5 left-2.5 bg-slate-950/80 border border-slate-800/80 p-2 rounded text-[10px] font-mono text-slate-300 pointer-events-none flex gap-4 max-w-sm">
            <div>
              <span className="text-slate-500 font-bold">WICK CONGESTION / REJECTS:</span>
              <div className="flex gap-2.5 mt-0.5">
                <span className="text-teal-400">CE (Bullish) Rejections</span>
                <span className="text-amber-450 text-yellow-400">PE (Bearish) Rejections</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time T&S Tape & diagnostic stats logs (Span 3 of 12) */}
        <div className="xl:col-span-3 flex flex-col gap-2 h-full overflow-hidden">
          
          {/* Latest anomaly alert bar */}
          <div className="p-2 bg-[#0a0f1d] border border-blue-900/30 rounded-lg flex flex-col space-y-1 relative flex-shrink-0">
            <div className="flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span className="text-[9.5px] font-bold text-blue-400 font-mono tracking-tight uppercase">
                Anomalies Detector Radar
              </span>
            </div>
            {lastEvent ? (
              <div className="flex flex-col text-[10px] font-mono leading-tight">
                <div className="flex justify-between font-bold text-slate-200">
                  <span className="text-blue-300">{lastEvent.type}</span>
                  <span className="text-slate-400">{lastEvent.time}</span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  Asset Premium level marked: <span className="font-bold text-white">₹{lastEvent.price.toFixed(1)}</span>
                </div>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono">
                No rejections/liquidity spikes identified in current cycle.
              </span>
            )}
          </div>

          {/* Tape Stream container */}
          <div className="bg-[#040811] border border-[#141d2f]/70 rounded-lg p-2 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-850 pb-1.5 mb-1.5 flex-shrink-0">
              <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1">
                ⬤ TICK TRANS-ACTION FEED
              </span>
              <span className="text-[8px] bg-slate-900 px-1 py-0.2 rounded text-slate-500 font-mono font-semibold">
                Capped: 50
              </span>
            </div>

            {/* Tape table header */}
            <div className="grid grid-cols-12 text-[8px] text-slate-500 font-mono font-bold pb-1 uppercase tracking-tight flex-shrink-0 px-1">
              <span className="col-span-4">TIME</span>
              <span className="col-span-3 text-right">PRICE (₹)</span>
              <span className="col-span-3 text-right">SIZE</span>
              <span className="col-span-2 text-right">SIDE</span>
            </div>

            {/* Scrolling logs container */}
            <div className="flex-grow overflow-y-auto custom-scroll space-y-0.5 px-0.5">
              {localTrades.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-4">
                  <span className="text-slate-600 font-mono text-[10.5px]">
                    Waiting for market data trades to cycle...
                  </span>
                </div>
              ) : (
                localTrades.map((t) => {
                  const isBuy = t.aggressor === 'Buy';
                  const isSell = t.aggressor === 'Sell';
                  const sideText = isBuy ? 'B' : isSell ? 'S' : 'N';
                  const color = isBuy
                    ? 'text-emerald-400 font-medium'
                    : isSell
                    ? 'text-rose-400 font-medium'
                    : 'text-amber-450';
                  
                  return (
                    <div
                      key={t.id}
                      className="grid grid-cols-12 text-[9.5px] font-mono py-0.5 border-b border-slate-900/40 hover:bg-slate-900/30 px-1"
                    >
                      <span className="col-span-4 text-slate-500 font-light">
                        {new Date(t.timestamp).toLocaleTimeString([], { hour12: false })}
                      </span>
                      <span className="col-span-3 text-right text-slate-200">
                        {t.ltp.toFixed(2)}
                      </span>
                      <span className="col-span-3 text-right text-slate-300">
                        {t.ltq.toLocaleString()}
                      </span>
                      <span className={`col-span-2 text-right ${isBuy ? 'text-emerald-500 font-extrabold' : isSell ? 'text-rose-500 font-extrabold' : 'text-slate-500'}`}>
                        {sideText}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Details Info bar helper (strictly literal labels) */}
      <div className="p-2.5 bg-[#080d1a]/50 border border-slate-850 rounded-lg flex items-start gap-2 text-[10px] leading-relaxed font-sans text-slate-400 flex-shrink-0">
        <CircleAlert className="w-4 h-4 text-slate-450 text-slate-500 mt-0.5 flex-shrink-0" />
        <div>
          <span className="text-slate-300 font-bold">HOW ORDER FLOW INDICATORS ARE COMPILED:</span>
          <p>
            Thefootprint engine analyzes high-speed intraday liquidity ticks. <strong className="text-yellow-400 font-medium">Absorption rejections (Diamonds)</strong> indicate areas where aggressive buying (or selling) volume was clustered in high ratios within wicks but failed to breakout, signalling pivot barriers. <strong className="text-blue-400 font-medium">Liquidity Vacuums (Triangles)</strong> represent rapid depletion of immediate limit depth quotes matching aggressive fills, triggering rapid acceleration momentum because the asset is vacuumed through empty zones.
          </p>
        </div>
      </div>
    </div>
  );
}
