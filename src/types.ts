/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  indicators?: {
    ema_9?: number;
    ema_20?: number;
    absorption?: 'Bullish' | 'Bearish' | 'None';
    vacuum?: 'Bullish' | 'Bearish' | 'None';
  };
}

export interface OptionGreek {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

export interface OptionContract {
  strike: number;
  expiry: string;
  option_type: 'call' | 'put';
  ltp: number;
  oi: number;
  oi_change: number;
  volume: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  moneyness?: 'ITM' | 'ATM' | 'OTM';
  distance_from_atm_pct?: number;
}

export interface OptionChainPayload {
  underlying: string;
  spot_price: number;
  chain: OptionContract[];
  source: string;
}

export interface MarketTick {
  ts_ms: number;
  instrumentKey: string;
  price: number;
  volume?: number;
  bidSize?: number;
  askSize?: number;
}

export interface TradeLog {
  id: string;
  timestamp: number;
  price: number;
  quantity: number;
  aggressor: 'Buy' | 'Sell' | 'Neutral';
  symbol: string;
}

export interface Position {
  id: string;
  symbol: string;
  strike: number;
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
}

export interface BrainSignal {
  id: string;
  time: string;
  type: 'LONG' | 'SHORT' | 'NEUTRAL' | 'ACCELERATION' | 'ABSORPTION_CE' | 'ABSORPTION_PE' | 'VACUUM_CE' | 'VACUUM_PE';
  message: string;
  strength: number; // 0 to 100
}

export interface Alert {
  id: string;
  name: string;
  alert_type: string;
  underlying: string;
  condition: string;
  message_template: string;
  status: 'active' | 'paused' | 'triggered';
}

export interface StrategyLeg {
  option_type: 'call' | 'put';
  strike: number;
  action: 'buy' | 'sell';
  quantity: number;
  premium: number;
  expiry: string;
}

export interface Strategy {
  name: string;
  underlying: string;
  spot_price: number;
  legs: StrategyLeg[];
  analysis?: {
    max_profit: number;
    max_loss: number;
    breakeven: number[];
  };
}

export interface DbTableInfo {
  name: string;
  row_count: number;
  schema: { name: string; type: string }[];
}

export interface DbQueryResult {
  results: Record<string, any>[];
  loading?: boolean;
  error?: string;
}

export type TradingMode = 'LIVE' | 'REPLAY' | 'BACKTEST';

export interface Trendline {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  lineWidth: number;
}

export interface MLTrainingLog {
  epoch: number;
  loss: number;
  valLoss?: number;
  accuracy: number;
}
