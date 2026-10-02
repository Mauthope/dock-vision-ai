'use client';

import React from 'react';
import { useDock } from '../context/DockContext';
import { Clock, CheckCircle2, AlertTriangle, Truck, Zap } from 'lucide-react';
import { formatDuration } from '../utils/boxGeometry';
import { SublimeCard } from '@/components/ui/sublime-card';

export const KPISummary: React.FC = () => {
  const {
    boxes,
    cameras,
    activeCameraId,
    selectedBoxId,
    selectBoxAndCamera,
    stats,
    settings,
  } = useDock();

  const avgMinutes = (stats.averageStaySeconds / 60).toFixed(1).replace('.', ',');
  const targetMinutes = settings.targetStayMinutes;
  const isAboveTarget = (stats.averageStaySeconds / 60) > targetMinutes;

  return (
    <div className="w-full">
      <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-slate-200 dark:border-cyan-500/20 shadow-2xl flex flex-col gap-4">
        {/* Métricas Principais com SublimeCard (Estilo Qualidade & Bahia) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
          <SublimeCard
            title="Tempo Medio / Boxe"
            value={`${avgMinutes} min`}
            secondaryText={`Meta industrial: ${targetMinutes} min (${formatDuration(stats.averageStaySeconds)})`}
            icon={Clock}
            variant="cyan"
            trend={{
              value: isAboveTarget ? 'Acima da Meta' : 'Dentro da Meta',
              isPositive: !isAboveTarget,
            }}
          />

          <SublimeCard
            title="Atendimentos Hoje"
            value={`${stats.totalRecords} veiculos`}
            secondaryText={`Ocupacao media estimada: ${stats.occupancyRate.toFixed(0)}%`}
            icon={CheckCircle2}
            variant="emerald"
            trend={{
              value: `${stats.totalRecords} concluidos`,
              isPositive: true,
            }}
          />

          <SublimeCard
            title="Docas em Operacao"
            value={`${stats.currentlyOccupied} de ${boxes.length}`}
            secondaryText={`Vagas livres no patio: ${Math.max(0, boxes.length - stats.currentlyOccupied)}`}
            icon={Truck}
            variant="violet"
          />

          <SublimeCard
            title="Estadia Maxima"
            value={stats.longestStaySeconds > 0 ? formatDuration(stats.longestStaySeconds) : '-'}
            secondaryText={
              stats.longestStaySeconds > 0
                ? `Tempo pico: ${(stats.longestStaySeconds / 60).toFixed(0)} min`
                : 'Sem registros no turno'
            }
            icon={AlertTriangle}
            variant="cyan"
          />
        </div>

        {/* Linha dos Boxes Ativos com Cronometros em Tempo Real */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-1">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1 font-heading">
            <Zap className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
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
                type="button"
                onClick={() => selectBoxAndCamera(box.id)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-500 text-slate-900 dark:text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                    : isOcc
                    ? 'bg-rose-500/15 border-rose-500/60 text-rose-700 dark:text-rose-200 shadow-md shadow-rose-500/10 hover:border-rose-400'
                    : isApp
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-200 hover:border-amber-400'
                    : 'bg-white/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
                title={`Ir para camera "${cam?.name || box.cameraId}" e monitorar ${box.name}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: box.color }}
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">{box.name}</span>

                <span
                  className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                    isCurrentCam
                      ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/20 border border-cyan-500/40'
                      : 'text-slate-500 bg-slate-100 dark:bg-slate-900'
                  }`}
                >
                  {cam ? cam.name.replace(/\(.*\)/, '').trim() : box.cameraId}
                </span>

                {isOcc ? (
                  <div className="flex items-center gap-1 font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-md border border-rose-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-0.5" />
                    <span>{formatDuration(durationSec)}</span>
                  </div>
                ) : isApp ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                    Aproximacao
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    Livre {box.lastSession ? `(${formatDuration(box.lastSession.durationSeconds)})` : ''}
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
