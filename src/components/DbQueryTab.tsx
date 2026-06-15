/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Database, FileSpreadsheet, HardDrive, Terminal, Search, Info, HelpCircle } from 'lucide-react';
import { DbTableInfo, DbQueryResult } from '../types';

interface DbQueryTabProps {
  tables: DbTableInfo[];
  queryResult: DbQueryResult;
  executeQuery: (sql: string) => void;
  exportCsv: (sql: string) => void;
  isQuerying: boolean;
}

export default function DbQueryTab({
  tables = [],
  queryResult,
  executeQuery,
  exportCsv,
  isQuerying,
}: DbQueryTabProps) {
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM ticks ORDER BY ts_ms DESC LIMIT 20');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Sample quick script presets
  const presets = [
    {
      title: 'Analyze Options History',
      sql: 'SELECT strike, option_type, oi, volume, ltp FROM options_snapshots ORDER BY timestamp DESC, strike ASC LIMIT 50',
    },
    {
      title: 'Verify HFT Tick Frequency',
      sql: 'SELECT instrumentKey, COUNT(*) as trade_count FROM ticks GROUP BY instrumentKey',
    },
    {
      title: 'Inspect Put-Call Ratio Trend',
      sql: 'SELECT timestamp, pcr_oi, spot_price FROM pcr_history ORDER BY timestamp DESC LIMIT 20',
    },
    {
      title: 'Examine High-Volume Ticks',
      sql: 'SELECT * FROM ticks WHERE price > 22000 ORDER BY price DESC LIMIT 30',
    },
  ];

  // Dynamic filter for results
  const headers =
    queryResult.results && queryResult.results.length > 0 ? Object.keys(queryResult.results[0]) : [];

  const filteredResults = queryResult.results
    ? queryResult.results.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchFilter.toLowerCase())
        )
      )
    : [];

  return (
    <div className="space-y-1.5">
      {/* Dynamic Tables catalog list */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-1.5">
        {tables.length === 0 ? (
          <div className="p-2 bg-[#0d1323] border border-slate-800 rounded-lg col-span-4 flex items-center justify-center text-xs text-slate-500 font-mono">
            Scanning local DuckDB database catalog tables...
          </div>
        ) : (
          tables.map((table) => (
            <div
              key={table.name}
              className="p-2 bg-[#0d1323] border border-slate-800 hover:border-slate-700 transition-colors rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="text-xs font-mono font-bold text-white block">
                    "{table.name}"
                  </span>
                  <span className="text-[9.5px] text-slate-500 font-mono block leading-none">
                    Schema: {table.schema.map((s) => s.name).slice(0, 3).join(', ')}...
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {table.row_count.toLocaleString()} rows
              </span>
            </div>
          ))
        )}
      </div>

      {/* SQL Editing and script executions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5">
        {/* SQL Console Console Panel */}
        <div className="lg:col-span-8 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-3 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
              <Terminal className="w-4 h-4 text-sky-400" />
              DUCKDB ANALYTICAL WORKSPACE
            </h3>

            <div className="flex space-x-1.5">
              <button
                onClick={() => exportCsv(sqlQuery)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold font-mono rounded shadow transition-all active:scale-95 flex items-center gap-1.5"
                title="Download query logs as CSV file"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                EXPORT CSV
              </button>
              <button
                onClick={() => executeQuery(sqlQuery)}
                disabled={isQuerying}
                className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold font-mono rounded shadow transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Play className={`w-3.5 h-3.5 ${isQuerying ? 'animate-pulse' : ''}`} />
                {isQuerying ? 'EXECUTING...' : 'RUN SCRIPT'}
              </button>
            </div>
          </div>

          {/* Preset Buttons row */}
          <div className="flex flex-wrap gap-1.5 mb-3 flex-shrink-0">
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setSqlQuery(p.sql)}
                className="px-2.5 py-1 rounded bg-[#0b0f19] hover:bg-[#111827] border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white transition-all text-left"
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* Multi-line editor box */}
          <div className="flex-grow p-1 bg-[#050912] border border-slate-900 rounded font-mono text-xs flex">
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full h-full bg-transparent text-emerald-400 p-2 border-0 outline-none resize-none font-mono text-sm leading-relaxed tracking-wide placeholder-slate-700 focus:ring-0"
              placeholder="SELECT * FROM ticks LIMIT 10..."
              id="txt-sql-query"
            />
          </div>
        </div>

        {/* Database Quick Reference */}
        <div className="lg:col-span-4 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col h-[380px]">
          <div className="border-b border-slate-800 pb-1.5 mb-2 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
              <Info className="w-4 h-4 text-[#a855f7]" />
              SCHEMA DICTIONARY REFERENCE
            </h3>
          </div>

          <div className="flex-grow overflow-y-auto pr-1 text-xs custom-scroll">
            <div className="p-2 bg-[#0d1527] border border-slate-800 rounded font-mono space-y-3">
              <div>
                <span className="text-[10px] font-bold text-sky-400 block uppercase">TABLE: "ticks"</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 mb-1">Raw HFT tick executions</span>
                <ul className="text-[9px] text-slate-500 pl-3 list-disc space-y-0.5">
                  <li><strong className="text-slate-300">ts_ms</strong>: BIGINT (unix millisecond timestamp)</li>
                  <li><strong className="text-slate-300">instrumentKey</strong>: VARCHAR (e.g. NSE:NIFTY)</li>
                  <li><strong className="text-slate-300">price</strong>: DOUBLE (tick transaction rate)</li>
                  <li><strong className="text-slate-300">volume</strong>: DOUBLE (size executed)</li>
                </ul>
              </div>

              <div>
                <span className="text-[10px] font-bold text-emerald-400 block uppercase">TABLE: "options_snapshots"</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 mb-1">Greeks enriched snapshots</span>
                <ul className="text-[9px] text-slate-500 pl-3 list-disc space-y-0.5">
                  <li><strong className="text-slate-300">timestamp</strong>: TIMESTAMP (snapshot clock)</li>
                  <li><strong className="text-slate-300">underlying</strong>: VARCHAR (NIFTY)</li>
                  <li><strong className="text-slate-300">strike</strong>: INTEGER (contract strike price)</li>
                  <li><strong className="text-slate-300">option_type</strong>: VARCHAR (call/put)</li>
                  <li><strong className="text-slate-300">oi / oi_change</strong>: INTEGER (interest level)</li>
                  <li><strong className="text-slate-300">iv / delta</strong>: DOUBLE (Greeks metric)</li>
                </ul>
              </div>

              <div>
                <span className="text-[10px] font-bold text-amber-500 block uppercase">TABLE: "pcr_history"</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 mb-1">Composite PCR trend logging</span>
                <ul className="text-[9px] text-slate-500 pl-3 list-disc space-y-0.5">
                  <li><strong className="text-slate-300">timestamp</strong>: TIMESTAMP (time of log)</li>
                  <li><strong className="text-slate-300">pcr_oi</strong>: DOUBLE (composite Put Call Ratio)</li>
                  <li><strong className="text-slate-300">pcr_vol</strong>: DOUBLE (composite volumes ratio)</li>
                  <li><strong className="text-slate-300">spot_price</strong>: DOUBLE (spot index value)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Query Results Grid Panel */}
      <div className="bg-[#080d1a] border border-[#1e293b] rounded-lg p-3 flex flex-col min-h-[220px] max-h-[380px] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 mb-2 gap-2 flex-shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
            <Search className="w-4 h-4 text-indigo-400" />
            QUERY OUTPUT RESULT GRID
          </span>

          <div className="flex items-center space-x-1.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Find in grid..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-7 pr-2.5 py-1 text-xs bg-[#0b0f19] border border-slate-850 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-[160px]"
              />
              <Search className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1.5" />
            </div>

            <span className="text-[10px] font-mono text-slate-500">
              Matched: {filteredResults.length} / {queryResult.results?.length || 0} rows
            </span>
          </div>
        </div>

        {/* Results grid table */}
        <div className="flex-grow overflow-x-auto text-xs font-mono custom-scroll">
          {queryResult.error ? (
            <div className="flex items-center space-x-2 p-3 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
              <HelpCircle className="w-5 h-5 flex-shrink-0" />
              <span>DuckDB Error: {queryResult.error}</span>
            </div>
          ) : queryResult.results?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Write or choose a preset script and click "RUN SCRIPT" above.
            </div>
          ) : (
            <table className="w-full text-left border-collapse select-text">
              <thead>
                <tr className="bg-[#0d1323] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                  {headers.map((col) => (
                    <th key={col} className="p-2 font-black border-r border-[#141d2f]/50">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredResults.slice(0, 50).map((row, r_idx) => (
                  <tr key={r_idx} className="hover:bg-slate-800/20 text-slate-300">
                    {headers.map((col) => {
                      const val = row[col];
                      return (
                        <td key={col} className="p-2 border-r border-slate-900/60 font-medium">
                          {typeof val === 'number'
                            ? Number.isInteger(val)
                              ? val.toLocaleString()
                              : val.toFixed(2)
                            : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
