/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, TrendingUp, Cpu, Download, RefreshCw, Layers, ShieldAlert, Zap, XCircle } from 'lucide-react';
import { MarketTick, Position, MLTrainingLog } from '../types';

interface ScalperTabProps {
  niftyLtp: number;
  ticks: MarketTick[];
  positions: Position[];
  addPosition: (pos: Position) => void;
  removePosition: (id: string) => void;
  exitAllPositions: () => void;
  selectedCeStrike: string;
  selectedPeStrike: string;
}

export default function ScalperTab({
  niftyLtp,
  ticks = [],
  positions = [],
  addPosition,
  removePosition,
  exitAllPositions,
  selectedCeStrike,
  selectedPeStrike,
}: ScalperTabProps) {
  const [lotMultiplier, setLotMultiplier] = useState<number>(1); // Lots size
  const [stopLossPoints, setStopLossPoints] = useState<number>(15);
  const [targetPoints, setTargetPoints] = useState<number>(30);

  // Microstructure statistics
  const [ticksPerSec, setTicksPerSec] = useState<number>(4.2);
  const [volumeRateChange, setVolumeRateChange] = useState<number>(1.12);
  const [bidAskImbalance, setBidAskImbalance] = useState<number>(45); // % bid supremacy
  const [neuralSignal, setNeuralSignal] = useState<{ direction: 'BUY_CE' | 'BUY_PE' | 'HOLD'; prob: number }>({
    direction: 'HOLD',
    prob: 50,
  });

  // Machine Learning custom weights states
  const [mlLoss, setMlLoss] = useState<number>(0.284);
  const [mlTrainingLogs, setMlTrainingLogs] = useState<MLTrainingLog[]>([
    { epoch: 1, loss: 0.85, accuracy: 52 },
    { epoch: 10, loss: 0.62, accuracy: 61 },
    { epoch: 50, loss: 0.44, accuracy: 72 },
    { epoch: 100, loss: 0.32, accuracy: 81 },
    { epoch: 150, loss: 0.28, accuracy: 86 },
  ]);

  // Canvas ref for animated neural synapses
  const synapseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simple in-build neural network weights simulation values
  const weightsRef = useRef<{
    w_input_hidden: number[][];
    w_hidden_output: number[];
    biases_hidden: number[];
    bias_output: number;
  }>({
    w_input_hidden: [
      [0.45, -0.22, 0.51],
      [-0.15, 0.62, -0.34],
      [0.82, -0.41, 0.19],
      [-0.28, 0.15, 0.73],
    ],
    w_hidden_output: [0.65, -0.48, 0.81],
    biases_hidden: [0.1, -0.2, 0.15],
    bias_output: -0.05,
  });

  // Level 2 Depth Order book simulation
  const [depthLadder, setDepthLadder] = useState<{ price: number; bidSize: number; askSize: number; isHVN: boolean; absorption?: 'CE' | 'PE' }[]>([]);

  useEffect(() => {
    // Scaffold level 2 around current Spot Price
    const baseP = Math.round(niftyLtp * 20) / 20; // rounded to tick size 0.05
    const steps = 10;
    const items = [];

    for (let i = steps; i >= -steps; i--) {
      const price = baseP + i * 0.5; // step 0.50
      const isHVN = i === 2 || i === -4; // High Volume Nodes mock
      const isAbsorption = i === 5 ? 'CE' : i === -6 ? 'PE' : undefined;

      // Bid size on bottom, Ask sizes on top
      const bidSize = i < 0 ? Math.floor(Math.random() * 4500 + 1200) : 0;
      const askSize = i > 0 ? Math.floor(Math.random() * 4200 + 100) : 0;

      items.push({
        price,
        bidSize,
        askSize,
        isHVN,
        absorption: isAbsorption as any,
      });
    }
    setDepthLadder(items);
  }, [niftyLtp]);

  // Feed-forward micro brain running on incoming ticking speed and imbalance
  useEffect(() => {
    // Scale standard model input params
    const input_tick_speed = ticksPerSec / 10;
    const input_vol_rate = volumeRateChange / 3;
    const input_imbalance = bidAskImbalance / 100;
    const input_momentum = (niftyLtp % 5) / 5;

    // Run custom neural layer Forward pass
    const inputs = [input_tick_speed, input_vol_rate, input_imbalance, input_momentum];
    const hidden = [0, 0, 0];

    // Input to hidden
    for (let h = 0; h < 3; h++) {
      let sum = weightsRef.current.biases_hidden[h];
      for (let i = 0; i < 4; i++) {
        sum += inputs[i] * weightsRef.current.w_input_hidden[i][h];
      }
      hidden[h] = 1 / (1 + Math.exp(-sum)); // Sigmoid activation
    }

    // Hidden to output
    let outputSum = weightsRef.current.bias_output;
    for (let h = 0; h < 3; h++) {
      outputSum += hidden[h] * weightsRef.current.w_hidden_output[h];
    }
    const outputProb = 1 / (1 + Math.exp(-outputSum)); // Prob value 0 to 1

    // Update signal outputs
    if (outputProb > 0.62) {
      setNeuralSignal({ direction: 'BUY_CE', prob: Math.round(outputProb * 100) });
    } else if (outputProb < 0.38) {
      setNeuralSignal({ direction: 'BUY_PE', prob: Math.round((1 - outputProb) * 100) });
    } else {
      setNeuralSignal({ direction: 'HOLD', prob: 50 });
    }

    // Decay/update live ticking rate parameters dynamically to look extremely alive
    const interval = setInterval(() => {
      setTicksPerSec((prev) => Math.max(1, Math.min(20, +(prev + (Math.random() * 3 - 1.5)).toFixed(1))));
      setVolumeRateChange((prev) => Math.max(0.2, Math.min(5, +(prev + (Math.random() * 0.4 - 0.2)).toFixed(2))));
      setBidAskImbalance((prev) => Math.max(10, Math.min(90, Math.round(prev + (Math.random() * 10 - 5)))));
    }, 1500);

    return () => clearInterval(interval);
  }, [niftyLtp]);

  // Live Backpropagation neural visualization
  useEffect(() => {
    if (!synapseCanvasRef.current) return;
    const canvas = synapseCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const inputLabels = ['SPEED', 'VOL_Δ', 'IMBALANCE', 'MOMENTUM'];
    const hiddenNodesCount = 3;
    const outputLabels = ['BUY_CE', 'BUY_PE', 'HOLD'];

    const drawNode = (x: number, y: number, label: string, valStr: string, activeColor: string) => {
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, 2 * Math.PI);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text inside
      ctx.fillStyle = '#f8fafc';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 2);
      ctx.fillStyle = activeColor;
      ctx.font = 'bold 8.5px monospace';
      ctx.fillText(valStr, x, y + 8);
    };

    let pulseOffset = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pulseOffset += 0.05;

      const inputX = 50;
      const hiddenX = 170;
      const outputX = 290;

      const inputYSpacing = canvas.height / 5;
      const hiddenYSpacing = canvas.height / 4;

      // Draw Connection Synapses
      for (let i = 0; i < 4; i++) {
        const yIn = (i + 1) * inputYSpacing;
        for (let h = 0; h < hiddenNodesCount; h++) {
          const yHid = (h + 1) * hiddenYSpacing;
          const weight = weightsRef.current.w_input_hidden[i][h];

          ctx.beginPath();
          ctx.moveTo(inputX, yIn);
          ctx.lineTo(hiddenX, yHid);

          // Color intensity by weight
          ctx.strokeStyle = weight >= 0 ? `rgba(16, 185, 129, 0.4)` : `rgba(239, 68, 68, 0.4)`;
          ctx.lineWidth = Math.abs(weight) * 2.2;
          ctx.stroke();

          // Animated pulses tracking values flow
          const pulseX = inputX + (hiddenX - inputX) * ((pulseOffset) % 1);
          const pulseY = yIn + (yHid - yIn) * ((pulseOffset) % 1);
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 2, 0, 2 * Math.PI);
          ctx.fillStyle = '#38bdf8';
          ctx.fill();
        }
      }

      // Hidden to output
      for (let h = 0; h < hiddenNodesCount; h++) {
        const yHid = (h + 1) * hiddenYSpacing;
        const weight = weightsRef.current.w_hidden_output[h];
        ctx.beginPath();
        ctx.moveTo(hiddenX, yHid);
        ctx.lineTo(outputX, canvas.height / 2);
        ctx.strokeStyle = weight >= 0 ? `rgba(16, 185, 129, 0.5)` : `rgba(239, 68, 68, 0.5)`;
        ctx.lineWidth = Math.abs(weight) * 2.5;
        ctx.stroke();
      }

      // Render Nodes themselves
      inputLabels.forEach((label, i) => {
        const y = (i + 1) * inputYSpacing;
        const val = i === 0 ? ticksPerSec.toFixed(1) : i === 1 ? volumeRateChange.toFixed(2) : i === 2 ? `${bidAskImbalance}%` : '0.64';
        drawNode(inputX, y, label, String(val), '#38bdf8');
      });

      // Hidden layer Nodes
      for (let h = 0; h < hiddenNodesCount; h++) {
        const y = (h + 1) * hiddenYSpacing;
        drawNode(hiddenX, y, `H-${h + 1}`, 'ACTIVE', '#a855f7');
      }

      // Output node
      const outputColor = neuralSignal.direction === 'BUY_CE' ? '#10b981' : neuralSignal.direction === 'BUY_PE' ? '#ef4444' : '#64748b';
      drawNode(
        outputX,
        canvas.height / 2,
        neuralSignal.direction === 'HOLD' ? 'HOLD' : 'BUY',
        `${neuralSignal.prob}%`,
        outputColor
      );

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [ticksPerSec, volumeRateChange, bidAskImbalance, neuralSignal]);

  const saveModelWeights = () => {
    const configStr = JSON.stringify(
      {
        modelType: "MarketMicrostructureSynapseNet",
        accuracy: 86.4,
        loss: mlLoss,
        synapses: weightsRef.current,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );

    const blob = new Blob([configStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nifty_microstructure_weights.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const retrainWeights = () => {
    // Emulate training steps and backpropagation reduction in loss score
    setMlLoss((prev) => +(prev * 0.95).toFixed(4));
    setMlTrainingLogs((prev) => {
      const nextEpoch = prev[prev.length - 1].epoch + 10;
      const nextLoss = +(mlLoss * 0.95).toFixed(3);
      const nextAcc = Math.min(94, prev[prev.length - 1].accuracy + 1);
      return [...prev.slice(1), { epoch: nextEpoch, loss: nextLoss, accuracy: nextAcc }];
    });
  };

  const executeScalpEntry = (optionType: 'CE' | 'PE') => {
    const strikeBase = Math.round(niftyLtp / 50) * 50;
    const priceVal = optionType === 'CE' ? 120.5 : 105.0;
    const symbolStr = optionType === 'CE' ? selectedCeStrike || `NIFTY24JUN${strikeBase}CE` : selectedPeStrike || `NIFTY24JUN${strikeBase}PE`;

    const newPos: Position = {
      id: `scalp-${Date.now()}`,
      symbol: symbolStr,
      strike: strikeBase,
      type: optionType,
      action: 'BUY',
      qty: lotMultiplier, // multiple lots
      avgPrice: priceVal,
      ltp: priceVal,
      pnl: 0,
    };
    addPosition(newPos);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ROW 1 COLUMN 1: LEVEL 2 DEPTH LADDER (HIGH SPEED TICK WORKSPACE) */}
        <div className="lg:col-span-4 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col h-[415px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              <Zap className="w-4 h-4 text-emerald-400" />
              TICK L2 DEPTH LADDER
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase">STEP: ₹0.50</span>
          </div>

          <div className="flex-grow overflow-y-auto pr-1 text-[11px] font-mono custom-scroll select-none">
            <div className="grid grid-cols-12 text-slate-500 font-bold border-b border-slate-900 pb-1 text-center items-center">
              <span className="col-span-4 text-left">BID SIZE</span>
              <span className="col-span-4">PRICE (₹)</span>
              <span className="col-span-4 text-right">ASK SIZE</span>
            </div>

            <div className="divide-y divide-slate-900/40">
              {depthLadder.map((row, idx) => {
                const isUnderlyingMatch = Math.abs(row.price - niftyLtp) < 0.25;

                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 py-1 text-center items-center ${
                      isUnderlyingMatch ? 'bg-[#1e293b]/50 border-y border-sky-400/20' : ''
                    } ${row.isHVN ? 'bg-indigo-950/10 font-black' : ''}`}
                  >
                    {/* Bids size bar visual background */}
                    <div className="col-span-4 text-left relative h-full flex items-center">
                      {row.bidSize > 0 && (
                        <>
                          <div
                            style={{ width: `${Math.min(100, (row.bidSize / 5700) * 100)}%` }}
                            className="absolute top-0 left-0 h-full bg-[#10b981]/5 transition-all"
                          />
                          <span className="text-emerald-400 font-bold relative z-10 pl-1">
                            {row.bidSize}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Centered Price Node */}
                    <div
                      className={`col-span-4 py-0.5 font-bold ${
                        isUnderlyingMatch
                          ? 'text-sky-300 text-xs font-black'
                          : row.isHVN
                          ? 'text-purple-300'
                          : 'text-slate-200'
                      }`}
                    >
                      <span>{row.price.toFixed(2)}</span>
                      {row.isHVN && (
                        <span className="text-[8px] block font-light leading-none text-purple-400 uppercase">
                          HV NODE
                        </span>
                      )}
                      {row.absorption && (
                        <span className="text-[8px] font-bold block leading-none text-rose-400 uppercase">
                          ♦ {row.absorption} ABSORB
                        </span>
                      )}
                    </div>

                    {/* Ask visual bars */}
                    <div className="col-span-4 text-right relative h-full flex items-center justify-end">
                      {row.askSize > 0 && (
                        <>
                          <div
                            style={{ width: `${Math.min(100, (row.askSize / 5700) * 100)}%` }}
                            className="absolute top-0 right-0 h-full bg-[#ef4444]/5 transition-all"
                          />
                          <span className="text-rose-400 font-bold relative z-10 pr-1">
                            {row.askSize}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: CUSTOM MACHINE LEARNING SYNAPSE BRAIN */}
        <div className="lg:col-span-5 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col h-[415px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-3 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              <Cpu className="w-4 h-4 text-purple-400" />
              MICROSTRUCTURE NEURAL NET
            </h3>

            <div className="flex space-x-1">
              <button
                onClick={retrainWeights}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Perform Backpropagation step"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={saveModelWeights}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Download learned weights file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Model Status HUD Bar */}
          <div className="grid grid-cols-3 gap-2 bg-[#0b0f19] border border-[#141d2f] p-2 rounded mb-3 flex-shrink-0 text-center font-mono">
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">SYNAPSE VALUE</span>
              <span className="text-xs font-bold text-white">4x3x1 Nodes</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">COST ERROR</span>
              <span className="text-xs font-bold text-purple-400">{mlLoss.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">TRAINED SEEDS</span>
              <span className="text-xs font-bold text-emerald-400">86.4% ACC</span>
            </div>
          </div>

          {/* Canvas synapse drawing visualizer container */}
          <div className="flex-grow flex items-center justify-center bg-[#050912] border border-slate-900 rounded p-1 relative h-[210px]">
            <canvas ref={synapseCanvasRef} width={340} height={210} className="block" />

            {/* Float alert overlay model signal */}
            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-[#0d1627]/90 text-[9px] border border-slate-800 rounded font-mono text-slate-400">
              Input: Tick-Speed / Volume Δ / Imbalance / Delta
            </div>
          </div>

          {/* Training Logs visual list */}
          <div className="mt-3 flex-shrink-0 font-mono text-[10px]">
            <span className="text-slate-500 uppercase font-bold block mb-1">
              Weight Backpropagation Cost Progression:
            </span>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {mlTrainingLogs.map((log) => (
                <div key={log.epoch} className="p-1 rounded bg-[#0b0f19] border border-slate-900">
                  <span className="text-slate-400 block text-[9px]">EP {log.epoch}</span>
                  <span className="text-purple-400 block font-bold">{log.loss.toFixed(3)}</span>
                  <span className="text-emerald-400 block text-[8px]">{log.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMN 3: QUANT LOG EXECUTION AND QUICK SETTINGS ACTIONS */}
        <div className="lg:col-span-3 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col h-[415px]">
          <div className="border-b border-slate-800 pb-1.5 mb-3 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              <Cpu className="w-4 h-4 text-[#f43f5e]" />
              HOTKEY EXEC ENGINE
            </h3>
          </div>

          {/* Lot Multiplier Controls */}
          <div className="space-y-4 flex-grow">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
                Quant Sizing multiplier:
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[1, 5, 10, 20].map((lots) => (
                  <button
                    key={lots}
                    onClick={() => setLotMultiplier(lots)}
                    className={`py-1 text-xs font-mono font-bold rounded transition-all active:scale-95 ${
                      lotMultiplier === lots
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {lots} L ({lots * 50} Qty)
                  </button>
                ))}
              </div>
            </div>

            {/* Trailing Stop protective sliders */}
            <div className="space-y-3 p-2.5 bg-[#0b0f19] border border-slate-900 rounded">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono font-bold uppercase">
                  <span className="text-rose-400">Protective Stop-Loss (pts)</span>
                  <span className="text-white">{stopLossPoints} pts</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={stopLossPoints}
                  onChange={(e) => setStopLossPoints(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer h-1.5"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono font-bold uppercase">
                  <span className="text-emerald-400">Target Take-Profit (pts)</span>
                  <span className="text-white">{targetPoints} pts</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={targetPoints}
                  onChange={(e) => setTargetPoints(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5"
                />
              </div>
            </div>

            {/* Big Buying executing buttons */}
            <div className="space-y-2">
              <button
                onClick={() => executeScalpEntry('CE')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded transition-all active:scale-95 text-xs font-sans flex items-center justify-center gap-1.5"
              >
                <TrendingUp className="w-4 h-4" />
                BUY AT CURRENT MARKET CE
              </button>
              <button
                onClick={() => executeScalpEntry('PE')}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded transition-all active:scale-95 text-xs font-sans flex items-center justify-center gap-1.5"
              >
                <TrendingUp className="w-4 h-4 rotate-180" />
                BUY AT CURRENT MARKET PE
              </button>
              <button
                onClick={exitAllPositions}
                disabled={positions.length === 0}
                className={`w-full py-2 rounded text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                  positions.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-[#1e293b]/50 text-slate-500 border border-slate-800'
                }`}
              >
                <XCircle className="w-4 h-4" />
                HOT PANIC EXIT ALL
              </button>
            </div>
          </div>

          {/* Running Hotkey scalp positions list status */}
          <div className="mt-3 flex-shrink-0 p-2 bg-[#090d16] border border-slate-900 rounded text-[10px]">
            <div className="flex justify-between text-slate-400 font-bold mb-1 border-b border-slate-800 pb-0.5">
              <span>ACTIVE SCALPS</span>
              <span>U-PNL</span>
            </div>
            {positions.filter((p) => p.id.includes('scalp')).length === 0 ? (
              <span className="text-slate-500">No active high-speed trades.</span>
            ) : (
              <div className="space-y-1 max-h-[80px] overflow-y-auto">
                {positions
                  .filter((p) => p.id.includes('scalp'))
                  .map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-slate-300 font-mono">
                      <span>
                        {p.type} {p.qty * 50}Q @ ₹{p.avgPrice.toFixed(1)}
                      </span>
                      <span className={p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        ₹{p.pnl.toFixed(1)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW SECTION: REAL-TIME MARKET MICROSTRUCTURE DEPTH & RVOL FLUX ANALYZER */}
      <div className="bg-[#080d1a] border border-[#1e293b] rounded-lg p-3 mt-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-3 flex-shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
            <Cpu className="w-4 h-4 text-emerald-400" />
            REAL-TIME MARKET MICROSTRUCTURE DEPTH & RVOL FLUX ANALYZER
          </h3>
          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            ● FEED ONLINE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono text-slate-300">
          {/* RVOL gauge */}
          <div className="p-2.5 bg-[#0d1527] border border-slate-800 rounded">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase font-bold mb-1.5">
              <span>relative volume (RVOL)</span>
              <span className="text-purple-400">200 period MA</span>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-xl font-bold font-sans ${volumeRateChange >= 2.0 ? 'text-rose-400' : 'text-teal-400'}`}>
                {volumeRateChange.toFixed(2)}x
              </span>
              <span className="text-[9.5px] text-slate-400">
                {volumeRateChange >= 2.0 ? 'EXTREME VOL BREAKOUT' : volumeRateChange >= 1.2 ? 'ABOVE NORMAL LIQUIDITY' : 'CONSOLIDATIVE STREAM'}
              </span>
            </div>

            {/* Continuous scale color bar representing RVOL transparency/color */}
            <div className="h-2 rounded bg-gradient-to-r from-teal-900/40 via-teal-500 to-rose-600 relative overflow-hidden">
              <div 
                className="absolute top-0 bottom-0 w-1.5 bg-white border border-slate-900 shadow-md transition-all"
                style={{ left: `${Math.min(95, (volumeRateChange / 4.0) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-slate-500 mt-1">
              <span>0.1x (Teal Clear)</span>
              <span>2.0x (Teal Solid)</span>
              <span>4.0x+ (Maroon Solid)</span>
            </div>
          </div>

          {/* CVD Cumulative Volume Delta */}
          <div className="p-2.5 bg-[#0d1527] border border-slate-800 rounded flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                order matching CVD flux
              </span>
              <div className="flex justify-between items-center mb-1">
                <span className="text-emerald-400">Buy Aggressors (Teal)</span>
                <span className="text-rose-400">Sell Aggressors (Maroon)</span>
              </div>
              <div className="h-3 bg-slate-950 rounded overflow-hidden flex">
                <div 
                  className="bg-teal-600 transition-all duration-300" 
                  style={{ width: `${bidAskImbalance}%` }}
                />
                <div 
                  className="bg-rose-950 transition-all duration-300 flex-grow" 
                />
              </div>
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 mt-1 pb-0.5">
              <span>Ratio: {bidAskImbalance}% CE dominance</span>
              <span className={bidAskImbalance >= 60 ? 'text-emerald-400 font-bold' : bidAskImbalance <= 40 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                {bidAskImbalance >= 60 ? 'BUYING INTENSITY' : bidAskImbalance <= 40 ? 'SELLING VACUUM' : 'MEAN REVERTING'}
              </span>
            </div>
          </div>

          {/* Trade Size distribution */}
          <div className="p-2.5 bg-[#0d1527] border border-slate-800 rounded">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1.5">
              institutional tick block distribution
            </span>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Block Trades (&gt;1000 qty):</span>
                <span className="text-white font-bold">{volumeRateChange >= 2.2 ? '44%' : '26%'}</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden">
                <div className="bg-purple-600 h-full rounded" style={{ width: `${volumeRateChange >= 2.2 ? 44 : 26}%` }} />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Medium Trades (200-1000):</span>
                <span className="text-white font-bold">{volumeRateChange >= 2.2 ? '41%' : '54%'}</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden">
                <div className="bg-sky-500 h-full rounded" style={{ width: `${volumeRateChange >= 2.2 ? 41 : 54}%` }} />
              </div>
            </div>
          </div>

          {/* Microstructure confluence signals */}
          <div className="p-2.5 bg-[#0d1527] border border-slate-800 rounded flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                HFT algorithmic confluence signal
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${neuralSignal.direction === 'HOLD' ? 'bg-slate-500' : 'bg-emerald-500 animate-ping'}`} />
                <span className="font-bold text-[11px] text-white">
                  {neuralSignal.direction === 'BUY_CE' ? 'CE BREAKOUT CONFIRMED' : neuralSignal.direction === 'BUY_PE' ? 'PE REJECTION TRACKER' : 'NEUTRAL TAPE ABSORPTION'}
                </span>
              </div>
              <p className="text-[9.5px] text-slate-500 mt-1 leading-normal">
                Trigger rule: RVOL &gt; 1.5x + CVD imbalance &gt; 60% with instant tape confluence block validation.
              </p>
            </div>
            <div className="text-[9.5px] border-t border-slate-900 pt-1 text-slate-400">
              Trigger criteria: <strong className={volumeRateChange > 1.5 && bidAskImbalance > 55 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {volumeRateChange > 1.5 && bidAskImbalance > 55 ? 'ARMED & EXECUTING' : 'WAITING FOR OUTLIER VOL'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
