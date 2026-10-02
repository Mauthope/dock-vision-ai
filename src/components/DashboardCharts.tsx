'use client';

import React from 'react';
import { useDock } from '../context/DockContext';
import { formatDuration } from '../utils/boxGeometry';
import { BarChart3, TrendingUp, Clock, Award, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const DashboardCharts: React.FC = () => {
  const { boxes, stats, settings } = useDock();

  // Dados calculados para gráfico em barra visual limpo e SVG puro
  const boxData = Object.entries(stats.byBox).map(([boxId, data]) => {
    const box = boxes.find(b => b.id === boxId);
    const avgMin = +(data.avgDurationSeconds / 60).toFixed(1);
    return {
      id: boxId,
      name: data.name,
      count: data.count,
      avgMin,
      color: box?.color || '#06b6d4',
      isOverTarget: avgMin > settings.targetStayMinutes,
    };
  });

  const maxAvgMin = Math.max(settings.targetStayMinutes * 1.5, ...boxData.map(b => b.avgMin), 10);

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Gráfico 1: Tempo Médio de Permanência por Boxe vs Meta */}
      <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Tempo Médio de Permanência por Doca</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Comparativo de tempo real contra a meta operacional ({settings.targetStayMinutes} min)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded bg-cyan-500 inline-block" /> Dentro da meta
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded bg-rose-500 inline-block" /> Acima da meta
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-4 h-0.5 border-t border-dashed border-amber-500 inline-block" /> Linha de meta
            </span>
          </div>
        </div>

        {/* Barras Horizontais Reativas com SVG / Tailwind */}
        <div className="flex flex-col gap-4 pt-2">
          {boxData.map(item => {
            const barWidthPercent = Math.min(100, (item.avgMin / maxAvgMin) * 100);
            const targetLinePercent = Math.min(100, (settings.targetStayMinutes / maxAvgMin) * 100);

            return (
              <div key={item.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">({item.count} atendimentos)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${item.isOverTarget ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-700 dark:text-cyan-400'}`}>
                      {item.avgMin.toFixed(1).replace('.', ',')} min
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ({formatDuration(Math.round(item.avgMin * 60))})
                    </span>
                  </div>
                </div>

                {/* Trilho da Barra com Marcador de Meta */}
                <div className="relative h-6 bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/80 flex items-center p-0.5">
                  {/* Linha da Meta */}
                  <div
                    className="absolute top-0 bottom-0 z-10 border-r-2 border-dashed border-amber-500 pointer-events-none"
                    style={{ left: `${targetLinePercent}%` }}
                    title={`Meta: ${settings.targetStayMinutes} min`}
                  />

                  {/* Barra de Progresso */}
                  <div
                    className={`h-full rounded-lg transition-all duration-700 ease-out flex items-center justify-end px-2 text-[10px] font-bold font-mono text-slate-950 ${
                      item.isOverTarget
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : 'bg-gradient-to-r from-teal-500 to-cyan-400'
                    }`}
                    style={{ width: `${Math.max(4, barWidthPercent)}%` }}
                  >
                    {barWidthPercent > 18 && `${item.avgMin}m`}
                  </div>
                </div>
              </div>
            );
          })}

          {boxData.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-500">
              Nenhum dado registrado ainda. Complete operações de carga ou descarga para visualizar as métricas.
            </div>
          )}
        </div>
      </div>

      {/* Grid de Resumo e Análise Operacional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card: Eficiência das Docas */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Indicadores de Eficiência de Pátio</span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-400">Atendimento mais rápido</span>
              <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {stats.fastestStaySeconds > 0 ? formatDuration(stats.fastestStaySeconds) : '-'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-400">Tempo médio geral</span>
              <span className="text-sm font-mono font-bold text-cyan-700 dark:text-cyan-400">
                {stats.averageStaySeconds > 0 ? formatDuration(stats.averageStaySeconds) : '-'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-400">Taxa de ocupação de vagas</span>
              <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">
                {stats.occupancyRate.toFixed(1).replace('.', ',')}%
              </span>
            </div>
          </div>
        </div>

        {/* Card: Diretrizes de Cronoanálise */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Diretrizes Lean de Cronoanálise</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Monitorar a permanência na doca permite identificar gargalos na conferência de carga, separação de paletes e emissão de notas fiscais, eliminando o tempo ocioso e reduzindo custos com estadias.
          </p>

          <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 text-xs text-cyan-800 dark:text-cyan-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <span>A detecção baseada em visão computacional garante medições automatizadas e precisas.</span>
          </div>
        </div>

      </div>

    </div>
  );
};
