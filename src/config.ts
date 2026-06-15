/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProDesk Terminal - Unified Environment & API Connection Configuration
 * 
 * This file coordinates client-side endpoints used to stream real-time index tick feeds, Option Greeks, 
 * historical data snapshots, and SQL execution payloads.
 */

// 1. Resolve Back-End REST API Server URI.
// When deploying to production with a unified full-stack architecture, it defaults to the window origin.
// In dynamic distributed development systems (e.g. FastAPI / Socket.IO running on local, remote VPS, or other containers),
// it leverages Vite's environmental replacement engine 'import.meta.env'.
export const API_SERVER_URL = 
  (import.meta as any).env.VITE_API_SERVER_URL || 
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : 'http://localhost:8000');

// 2. Resolve WebSocket/Socket.IO Server Gateway.
// Separate Socket gateway mapping (often matches the REST base URL but uses ws/wss protocol or same host gateway)
export const SOCKET_SERVER_URL = 
  (import.meta as any).env.VITE_SOCKET_SERVER_URL || 
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : 'http://localhost:8000');

// 3. Broker Connection / Sandstone Auth Details
export const BROKER_CREDENTIALS = {
  CLIENT_ID: (import.meta as any).env.VITE_BROKER_CLIENT_ID || 'DEMO_CLIENT_ID',
  REDIRECT_URI: (import.meta as any).env.VITE_BROKER_REDIRECT_URI || 'http://localhost:3000/auth/callback',
};

// 4. Fallback default configurations
export const DEFAULT_TICKER_SYMBOL = 'NSE:NIFTY';
export const DEFAULT_TICK_SIZE = 0.05;
