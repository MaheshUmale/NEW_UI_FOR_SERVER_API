# ProDesk Terminal: API Server Integration & Maintenance Guide

This document provides a comprehensive blueprint explaining how the robust **FastAPI & Socket.IO backend Python server (ProTrade API Server)** integrates with the frontend **React + Tailwind + TypeScript dashboard (ProDesk Terminal UI)**, as well as clear instructions on where to make changes, add/modify features, and handle routine maintenance.

---

## Part 1: API Server to UI Dashboard Integration

The ProDesk Terminal relies on a dual-protocol full-stack communication layer:
1. **HTTP REST API (FastAPI)**: For non-realtime, request-response actions such as querying databases, uploading strategies, fetching static/historical option chains, and configuration backfills.
2. **WebSockets (Socket.IO)**: For high-speed, low-latency, bidirectional real-time data streaming (underlying Indian indices (Nifty), CE/PE option premiums, active alerts, and algorithmic scalper actions).

The following diagram illustrates how the frontend components bind to the backend routes and socket channels:

```
                  ┌──────────────────────────────────────────────┐
                  │            PRODESK TERMINAL (UI)             │
                  └───────┬───────────────────────────────┬──────┘
                          │ (REST HTTP API)               │ (Socket.IO Events)
                          ▼                               ▼
                 [FastAPI Endpoints]             [ASGI Socket.IO Gateway]
             • GET /api/tv/intraday/{key}     • subscribe (Quotes/Ticks)
             • GET /api/options/chain/{und}   • subscribe_options (Greeks)
             • GET /api/scalper/status        • start_replay / stop_replay
             • POST /api/db/query             • scalper_tick emissions
                          │                               │
                          ▼                               ▼
                  ┌──────────────────────────────────────────────┐
                  │               API SERVER (PY)                │
                  └──────────────────────────────────────────────┘
```

### 1. Unified Real-Time Market Data Stream (Socket.IO)
- **Establishment**: On initial render, the client sets up a single `Socket.IO` instance connected to the server gateway (`http://<server-ip>:<port>`).
- **Data Subscription**: When you switch symbols or open premiums, the dashboard emits:
  - `subscribe` with `instrumentKeys` and `interval` (e.g. `["NSE:NIFTY", "NIFTY24JUN22200CE"]`, `"1m"`).
  - The server places the client session into a matching Socket.IO room and launches throttled emissions.
- **Broadcast Events**: The React client listens to:
  - `tick` / `quote`: Live tick updates for charts & LTP badges.
  - `options_broadcast`: Real-time Greeks, IV updates, and option-chain summaries.
  - `scalper_trade` / `scalper_update`: Algorithmic order execution and microstructure analytics.

### 2. Underlyings & Option Symbols Naming Conventions

To prevent data mismatch when passing contracts across the frontend-backend boundary, the system follows a strict, normalized symbol mapping standard:

| Asset Class / Index | UI / User Face Display Name | Backend REST/Socket Identifier | Upstox / Broker Normalized Key |
| :--- | :--- | :--- | :--- |
| **Nifty 50** | `NIFTY` or `Nifty 50` | `NSE:NIFTY` | `NSE:NIFTY` / `NIFTY` |
| **Nifty Bank** | `BANKNIFTY` or `Bank Nifty` | `NSE:BANKNIFTY` | `NSE:BANKNIFTY` / `BANKNIFTY` |
| **Finnifty** | `FINNIFTY` or `Fin Nifty` | `NSE:FINNIFTY` | `NSE:FINNIFTY` / `FINNIFTY` |

#### Normalization Rules:
1. **Whitespace Elimination**: All spaces are stripped before routing queries to the database or broadcast layers (e.g., `Bank Nifty` -> `BANKNIFTY`).
2. **Case Correction**: All underlying keys are shifted to uppercase (`Nifty` -> `NIFTY`).
3. **Prefix Appending**: TradingView charts require exchange qualifiers (e.g., `NSE:NIFTY`), which are prefixed automatically by the frontend query helper if missing.
4. **Option Contract Formats**: Option tickers represent a continuous string concatenating the *Underlying*, *Expiry Date*, *Strike Price*, and *Type* with NO spaces (e.g., `NIFTY24JUN22200CE` or `BANKNIFTY24DEC48000PE`).

---

### 3. Interactive Chart Search (AJAX Discovery Gateway)

When you click the chart title on any of the `TradingChart` panels to search or load a different ticker, it initiates an **AJAX / Fetch-based dynamic lookup engine** operating as follows:

```
[Chart Title Clicked] ──► [Input Text Field] ──(AJAX Debounced Fetch)──► GET /api/tv/search?text=...
                                                                                  │
   ◄── [Enriched Options + TV Symbols JSON] ◄─── (Augment with options) ◄─────────┘
```

- **Trigger Input**: Users type into the title search input bar (debounced by $250\text{ms}$ to prevent API congestion).
- **Endpoint Request**: The front-end queries:
  `GET /api/tv/search?text={search_query}`
- **Server-Side Aggregation**:
  1. The backend proxies standard TradingView symbols via public APIs to retrieve corresponding equity and index matching rules.
  2. The query is parsed: if indices like `NIFTY`, `BANKNIFTY`, or `FINNIFTY` are detected, the server automatically queries option contracts.
  3. It merges option strikes discovered via `search_options` matching the search string into the final JSON list.
- **Client Render**: The UI spawns a dropdown offering standard stocks alongside derivative option premium legs, so selecting any item updates the respective spot/premium state and subscribes to its real-time socket room.

---

### 4. Tab-Specific Server Integrations

Each tab in the React workspace corresponds to specific server-side capabilities:

#### A. Main Workspace Tab (`/src/components/MainTab.tsx`)
- **Spot & Option Charts**: Feeds on `GET /api/tv/intraday/{instrument_key}?interval={tf}` to fetch high-detail OHLC charts containing pre-computed EMA 9/20 lines, battle zones, and psychology indicators.
- **Micro-Trades & Ticks**: Real-time ticker ticks are received via `on('tick')` and dynamically appended to the canvas `TradingChart` drawing loop, preventing layout refreshes.
- **Armed Alert Rules**: Pulls `GET /api/alerts` to surface currently armed spot rules and filters active alerts.

#### B. Scalper Tab (`/src/components/ScalperTab.tsx`)
- **Microstructure Depth**: Binds with the `GET /api/scalper/status` and live JSON updates from the NSE Confluence Scalper.
- **Active Orders & Execution**: Dispatches requests via `POST /api/scalper/start?underlying={sym}` and `POST /api/scalper/stop` to activate/deactivate the automated scalping loop.

#### C. Options Analysis Tab (`/src/components/OptionsAnalysisTab.tsx`)
- **Option Chain & Greeks Table**: Queries `GET /api/options/chain/{underlying}/with-greeks`. Enriches strike parameters with Black-Scholes indicators, implied volatility (IV) levels, delta/gamma metrics, and Put-Call ratios (PCR).
- **Consolidated Insights**: Fetch automated diagnostics from `GET /api/options/genie-insights/{underlying}` and `GET /api/options/oi-analysis/{underlying}`.
- **Backfilling Operations**: Triggers historical data compilation using `POST /api/options/backfill`.

#### D. Strategy Builder & Alerts Tab (`/src/components/StrategyAlertsTab.tsx`)
- **Offensive Payoff Matrix**: When users draft multileg combinations (e.g. Iron Condors, Bull spreads), the client posts leg parameters to `POST /api/strategy/build` (or specialized `/api/strategy/iron-condor`, `/api/strategy/long-straddle`, `/api/strategy/bull-call-spread` endpoints) which returns risk reward analysis, break-even targets, and coordinate arrays for drawing payoff curves.
- **Alert Creation**: Posts rules to `POST /api/alerts/create` and deletes/modifies using `DELETE /api/alerts/{id}` and `POST /api/alerts/{id}/pause`.

#### E. DB Query Inspector (`/src/components/DbQueryTab.tsx`)
- **DuckDB Catalog**: Calls `GET /api/db/tables` to inspect active logs, ticks, and snapshots table metrics from the background service.
- **Interactive SQL Runner**: Posts raw SQL queries to `POST /api/db/query` and fetches returned rows into a tabular container.
- **Exporting Data**: Dispatches exports to `POST /api/db/export` to download CSV copies.

---

## Part 2: Frontend Code Architecture & Maintenance Guide

For maintenance developers, this section explains the file structure and lists what to modify when altering specific components.

### 1. Folder Structure Overview
All interactive code sits in the `/src/` workspace:
```
/src/
  ├── main.tsx                # Principal React index renderer
  ├── App.tsx                 # Core layout wrapper, active tab manager, and state shell
  ├── types.ts                # TypeScript schemas for Candles, Ticks, Alerts, and Positions
  ├── index.css               # Clean styling config and Tailwind custom theme bindings
  └── components/             # Modular dashboard tabs
        ├── Navbar.tsx        # High-density header, market index tickers, and mode toggle
        ├── TradingChart.tsx  # Dynamic performance-driven canvas charting engine
        ├── MainTab.tsx       # Spot & CE/PE premium twin layout terminal
        ├── ChartsTab.tsx     # Custom 1/2/4 multi-grid chart analyzer layout with dropdown search
        ├── ScalperTab.tsx    # Order-depth bid-ask ladder and confluence signal feed
        ├── OptionsAnalysisTab.tsx # PCR metrics, IV charts, and option chains
        ├── StrategyAlertsTab.tsx  # Interactive Option strategists & multi-leg payoff graph
        └── DbQueryTab.tsx    # Live DuckDB console and raw SQL table browser
```

---

### 2. Maintenance Scenarios & Quick-Lookup

#### Scenario A: You want to update the styling or layout of the workspace
- **Where to look**: `/src/index.css` contains the global CSS, font injections (such as Inter, JetBrains Mono), and general theme definitions.
- **Grid Layouts**: Components are heavily modularized with responsive Tailwind classes (`grid grid-cols-1 lg:grid-cols-12`). Look at `MainTab.tsx` or `ScalperTab.tsx` to alter column ratios.

#### Scenario B: You want to add a new option or spot symbol to the default tickers
- **Where to look**: In `Navbar.tsx`, locate the `presetUnderlyings` list or default symbols collection and update the array with the new underlying identifiers.

#### Scenario C: You need to introduce a new data field in the Socket.IO or REST interfaces
- **Where to look**:
  1. `/src/types.ts`: Update appropriate interfaces (e.g., `MarketTick`, `Candle`, `Position`) to match the new backend keys.
  2. The corresponding frontend component (e.g. `MainTab.tsx` for tracking alerts, or `TradingChart.tsx` for drawing candle parameters) to render the new parameter cleanly.

#### Scenario D: You want to change indicators, colors, or grid outlines on the Trading Charts
- **Where to look**: `/src/components/TradingChart.tsx` handles the HTML5 Canvas drawing cycle inside its main `useEffect` render loop.
  - Line offsets, padding definitions, and chart grid lines (`gridColor`, `textMainColor`) are defined at the top of the hook.
  - Candlestick body properties and trade dot sizes can be configured inside the drawing block loop.
  - To change indicator equations (such as EMA calculations), see the indicator compilation block.

#### Scenario E: You need to adjust the heights/scaling of dashboard cards
- **Where to look**: Tab container heights are hardcoded into standard Tailwind sizes for pristine high-visibility sizing (e.g., `h-[380px]` or `min-h-[380px]`). Update these CSS markers in `ScalperTab.tsx`, `MainTab.tsx`, or `DbQueryTab.tsx` as desired to scale elements. In `MainTab.tsx`, `chartHeight` expands dynamically to `570px` when the Trading Desk terminal is collapsed.

#### Scenario F: You want to update or modify the custom multi-chart layout configs
- **Where to look**: `/src/components/ChartsTab.tsx` handles state for the `CHARTS MULTI` viewpoint. 
  - Layout options (`1`, `2`, or `4` grid boxes) are managed via `layout` state hook.
  - Active symbol inputs and custom candle generation loops reside inside `getSlotCandles()` function.
  - Default recommended search tickers are bound inside `PRESET_SYMBOLS`.

---

### 3. Production Compilation & Quality Verification

To verify that the workspace compiles successfully and respects strict TypeScript rules without issues:
- Run compilation checks: `npm run build`
- Validate formatting and syntax: `npm run lint`

All styling respects high-contrast readability without excessively glowing visual elements to guarantee professional maintenance efficiency and long-term durability.
