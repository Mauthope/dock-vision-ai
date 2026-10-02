'use client';

import React from 'react';
import {
  Video,
  RefreshCw,
  Square,
  Shapes,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { CameraSourceConfig } from '@/types/dock';

interface DockCanvasToolbarProps {
  cameras: CameraSourceConfig[];
  activeCameraId: string;
  onCameraChange: (id: string) => void;
  isLoadingModel: boolean;
  fps: number;
  drawingMode: boolean;
  drawTool: 'rectangle' | 'polygon';
  drawingPointsCount: number;
  isFullscreen: boolean;
  onStartDrawing: (tool: 'rectangle' | 'polygon') => void;
  onCancelDrawing: () => void;
  onRestartCamera: () => void;
  onToggleFullscreen: () => void;
}

export const DockCanvasToolbar: React.FC<DockCanvasToolbarProps> = ({
  cameras,
  activeCameraId,
  onCameraChange,
  isLoadingModel,
  fps,
  drawingMode,
  drawTool,
  drawingPointsCount,
  isFullscreen,
  onStartDrawing,
  onCancelDrawing,
  onRestartCamera,
  onToggleFullscreen,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/85 dark:bg-slate-950/85 bg-white/90 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md z-10">
      {/* Identificacao da Camera & Status da IA */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-inner">
          <Video className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
          <select
            value={activeCameraId}
            onChange={e => onCameraChange(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold text-xs border-none focus:outline-none cursor-pointer pr-1"
            title="Trocar Camera Ativa"
          >
            {cameras.map(cam => (
              <option key={cam.id} value={cam.id} className="bg-slate-900 text-white">
                {cam.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-mono">
          {isLoadingModel ? (
            <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Carregando IA...
            </span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="text-slate-700 dark:text-slate-300 font-bold">{fps} FPS</span>
              <span className="text-slate-400 dark:text-slate-500">| WebGL</span>
            </>
          )}
        </div>
      </div>

      {/* Ferramentas de Desenho e Controles */}
      <div className="flex items-center gap-2 flex-wrap">
        {!drawingMode ? (
          <>
            <button
              type="button"
              onClick={() => onStartDrawing('rectangle')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Desenhar Boxe Retangular (Clique e arraste sobre a vaga)"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ Desenhar Retangulo</span>
              <span className="inline sm:hidden">+ Retangulo</span>
            </button>

            <button
              type="button"
              onClick={() => onStartDrawing('polygon')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 text-xs font-medium transition-all shadow-sm cursor-pointer"
              title="Desenhar Boxe em Perspectiva (Clique nos 4 cantos da vaga)"
            >
              <Shapes className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />
              <span className="hidden sm:inline">+ Perspectiva (4 Cantos)</span>
              <span className="inline sm:hidden">+ Perspectiva</span>
            </button>

            <button
              type="button"
              onClick={onRestartCamera}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs transition-colors cursor-pointer"
              title="Reiniciar Camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs transition-colors cursor-pointer"
              title="Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 bg-cyan-950/90 p-1.5 rounded-xl border border-cyan-500/50">
            <span className="text-xs font-bold text-cyan-300 px-2 flex items-center gap-1.5">
              {drawTool === 'rectangle'
                ? 'Clique e arraste para criar o Boxe'
                : `Clique nos 4 cantos da vaga (${drawingPointsCount}/4)`}
            </span>

            <button
              type="button"
              onClick={onCancelDrawing}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
