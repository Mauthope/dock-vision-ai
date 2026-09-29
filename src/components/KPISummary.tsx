'use client';

import React from 'react';
import { useDock } from '../context/DockContext';
import { Clock, CheckCircle2, TrendingUp, AlertTriangle, Truck, Zap } from 'lucide-react';
import { formatDuration } from '../utils/boxGeometry';

export const KPISummary: React.FC = () => {
  const {
    boxes,
    cameras,
    activeCameraId,
    selectedBoxId,
    selectBoxAndCamera,
    stats,
    settings
  } = useDock();

  const avgMinutes = (stats.averageStaySeconds / 60).toFixed(1).replace('.', ',');
  const targetMinutes = settings.targetStayMinutes;
  const isAboveTarget = (stats.averageStaySeconds / 60) > targetMinutes;

  return (
    <div className="w-full">
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/30 flex flex-col gap-4">
        
        {/* Métricas Principais (3 Colunas Estilo Bahia) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
          
          {/* Card 1: Tempo Médio de Permanência */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3.5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 truncate">
                  Tempo Médio / Boxe
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 font-mono ${
                  isAboveTarget ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                }`}>
                  Meta: {targetMinutes}m
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300 font-mono">
                  {avgMinutes}
                </span>
                <span className="text-xs font-bold text-teal-400">min</span>
                <span className="text-xs text-slate-400 font-mono">
                  ({formatDuration(stats.averageStaySeconds)})
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Caminhões Concluídos */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3.5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 truncate">
                  Atendimentos Hoje
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold shrink-0">
                  {stats.totalRecords} concluídos
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 font-mono">
                  {stats.totalRecords}
                </span>
                <span className="text-xs font-bold text-emerald-400/80">veículos</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({stats.occupancyRate.toFixed(0)}% ocupação)
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Docas Ocupadas Agora */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3.5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 truncate">
                  Em Operação Agora
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/50 font-mono font-bold shrink-0">
                  {stats.currentlyOccupied} de {boxes.length}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono">
                  {stats.currentlyOccupied}
                </span>
                <span className="text-xs font-bold text-amber-400/80">boxes ativos</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({boxes.length - stats.currentlyOccupied} livres)
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Maior Tempo em Doca */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3.5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 truncate">
                  Permanência Máxima
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold shrink-0">
                  Recorde
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono">
                  {formatDuration(stats.longestStaySeconds)}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {stats.longestStaySeconds > 0 ? `(${(stats.longestStaySeconds / 60).toFixed(0)} min)` : 'Sem registros'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Linha dos Boxes Ativos com Cronômetros em Tempo Real (Clicável para ir à câmera) */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Boxes:
          </div>

          {boxes.map(box => {
            const isOcc = box.status === 'occupied';
            const isApp = box.status === 'approaching';
            const isSelected = selectedBoxId === box.id;
            const isCurrentCam = box.cameraId === activeCameraId;
            const durationSec = box.currentTruck?.durationSeconds ?? 0;
            const cam = cameras.find(c => c.id === box.cameraId);

            return (
              <button
                key={box.id}
                onClick={() => selectBoxAndCamera(box.id)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500'
                    : isOcc
                    ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/40 hover:border-rose-400'
                    : isApp
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 hover:border-amber-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                title={`Clique para ir à câmera "${cam?.name || box.cameraId}" e visualizar ${box.name}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: box.color }}
                />
                <span className="font-semibold text-slate-200">{box.name}</span>

                <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                  isCurrentCam ? 'text-cyan-300 bg-cyan-950/80 border border-cyan-800/50' : 'text-slate-500 bg-slate-900'
                }`}>
                  {cam ? cam.name.replace(/\(.*\)/, '').trim() : box.cameraId}
                </span>

                {isOcc ? (
                  <div className="flex items-center gap-1 font-mono font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-0.5" />
                    <span>{formatDuration(durationSec)}</span>
                  </div>
                ) : isApp ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                    Aproximação...
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/40">
                    Livre {box.lastSession ? `(Últ: ${formatDuration(box.lastSession.durationSeconds)})` : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};
