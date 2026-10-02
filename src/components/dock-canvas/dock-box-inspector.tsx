'use client';

import React from 'react';
import {
  X,
  Truck,
  Bus,
  Car,
  User,
  Activity,
  Zap,
  Shield,
  Gauge,
  Scale,
  Move,
  Copy,
  Trash2,
} from 'lucide-react';
import { DockBox, CameraSourceConfig } from '@/types/dock';

interface DockBoxInspectorProps {
  selectedBox: DockBox;
  cameras: CameraSourceConfig[];
  panelMotionLevel: number;
  onClose: () => void;
  onUpdateBox: (id: string, updates: Partial<DockBox>) => void;
  onDuplicateBox: (id: string) => void;
  onDeleteBox: (id: string) => void;
  onSetActiveCameraId: (id: string) => void;
}

const COLOR_OPTIONS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const TARGET_CLASSES_CONFIG = [
  { id: 'truck', label: 'Caminhao', icon: Truck, iconColor: 'text-cyan-400', desc: 'Carretas, baus e semirreboques' },
  { id: 'bus', label: 'Onibus / Van', icon: Bus, iconColor: 'text-teal-400', desc: 'Vans de carga e furgoes de entrega' },
  { id: 'car', label: 'Carro Comum', icon: Car, iconColor: 'text-purple-400', desc: 'Veiculos leves e utilitarios (VUCs)' },
  { id: 'person', label: 'Pessoa / Pedestre', icon: User, iconColor: 'text-sky-400', desc: 'Conferentes, motoristas ou pedestres' },
  { id: 'motion', label: 'Qualquer Movimento', icon: Activity, iconColor: 'text-amber-400', desc: 'Portas abrindo, empilhadeiras, pallets' },
];

export const DockBoxInspector: React.FC<DockBoxInspectorProps> = ({
  selectedBox,
  cameras,
  panelMotionLevel,
  onClose,
  onUpdateBox,
  onDuplicateBox,
  onDeleteBox,
  onSetActiveCameraId,
}) => {
  const currentTargetClasses = selectedBox.targetClasses || ['truck', 'bus', 'person'];
  const motionThreshold = selectedBox.motionThreshold ?? 0.03;
  const isTriggeringMotion = panelMotionLevel >= motionThreshold;

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      className="absolute top-2 sm:top-4 left-2 sm:left-4 z-20 p-3.5 rounded-2xl bg-slate-950/95 dark:bg-slate-950/95 bg-white/95 border border-cyan-500/50 shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 w-80 sm:w-84 md:w-92 max-w-[calc(100%-1rem)] max-h-[calc(100%-1rem)] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Cabecalho */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-heading">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedBox.color }} />
          Editar Boxe
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Fechar Painel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Nome do Boxe */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Identificacao</label>
        <input
          type="text"
          value={selectedBox.name}
          onChange={e => onUpdateBox(selectedBox.id, { name: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Seletor de Cores */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Cor:</span>
        <div className="flex gap-1.5">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdateBox(selectedBox.id, { color: c })}
              className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                selectedBox.color === c ? 'scale-125 border-cyan-500 ring-2 ring-white/50' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Enquadramento de Camera */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Enquadramento:</span>
          <span className="text-[10px] text-cyan-500 dark:text-cyan-400 font-mono font-bold">
            {selectedBox.detectionCriteria === 'close_dock' ? 'Doca Proxima' : selectedBox.detectionCriteria === 'ground' ? 'Patio Amplo' : 'Auto Hibrido'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'auto', label: 'Auto' },
            { id: 'close_dock', label: 'Doca Proxima' },
            { id: 'ground', label: 'Patio Amplo' },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onUpdateBox(selectedBox.id, { detectionCriteria: opt.id as 'auto' | 'close_dock' | 'ground' })}
              className={`px-1.5 py-1.5 rounded text-[10px] font-semibold border text-center transition-colors cursor-pointer ${
                (selectedBox.detectionCriteria || 'auto') === opt.id
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sensibilidade / Cobertura Mínima */}
      <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Cobertura Minima:</span>
          <span className="text-[10px] text-cyan-500 dark:text-cyan-400 font-mono font-bold">
            {Math.round((selectedBox.overlapThreshold ?? 0.20) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="60"
          step="5"
          value={Math.round((selectedBox.overlapThreshold ?? 0.20) * 100)}
          onChange={e => onUpdateBox(selectedBox.id, { overlapThreshold: Number(e.target.value) / 100 })}
          className="w-full accent-cyan-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Camera Vinculada */}
      <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200 dark:border-slate-800">
        <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Camera Responsavel:</label>
        <select
          value={selectedBox.cameraId}
          onChange={e => {
            const newCamId = e.target.value;
            onUpdateBox(selectedBox.id, { cameraId: newCamId });
            onSetActiveCameraId(newCamId);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
        >
          {cameras.map(cam => (
            <option key={cam.id} value={cam.id} className="bg-slate-900 text-white">
              {cam.name}
            </option>
          ))}
        </select>
      </div>

      {/* O que detectar neste Boxe */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Classes Monitoradas:</span>
        <div className="flex flex-col gap-1.5 bg-slate-100/80 dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200 dark:border-slate-800/80">
          {TARGET_CLASSES_CONFIG.map(item => {
            const isChecked = currentTargetClasses.includes(item.id);
            const IconComp = item.icon;

            return (
              <label
                key={item.id}
                className={`flex items-start gap-2.5 p-1.5 rounded-lg cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-cyan-500/15 text-slate-900 dark:text-slate-100 border border-cyan-500/30'
                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked
                      ? currentTargetClasses.filter(c => c !== item.id)
                      : [...currentTargetClasses, item.id];
                    if (next.length > 0) {
                      onUpdateBox(selectedBox.id, { targetClasses: next });
                    }
                  }}
                  className="mt-0.5 w-3.5 h-3.5 rounded border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-850 accent-cyan-500 cursor-pointer shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-900 dark:text-slate-200">
                    <IconComp className={`w-3.5 h-3.5 ${item.iconColor}`} />
                    <span>{item.label}</span>
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-500 leading-tight">{item.desc}</span>
                </div>
              </label>
            );
          })}

          {/* Calibracao de Movimento */}
          {currentTargetClasses.includes('motion') && (
            <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                <span className="text-[11px] font-bold text-amber-500 dark:text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  Calibracao de Movimento
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold">
                  {(panelMotionLevel * 100).toFixed(1)}% ao vivo
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                  Atividade:
                </span>
                <span className={`font-mono font-bold ${
                  isTriggeringMotion ? 'text-rose-500 animate-pulse' : 'text-emerald-500'
                }`}>
                  {isTriggeringMotion ? 'Disparando' : 'Estavel / Silencioso'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 pt-1">
                {[
                  { thresh: 0.015, diff: 18, frames: 1, label: 'Alta', icon: Zap },
                  { thresh: 0.030, diff: 24, frames: 2, label: 'Padrao', icon: Scale },
                  { thresh: 0.060, diff: 35, frames: 2, label: 'Anti-Ruido', icon: Shield },
                ].map(preset => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onUpdateBox(selectedBox.id, {
                        motionThreshold: preset.thresh,
                        motionDiffThreshold: preset.diff,
                        motionDebounceFrames: preset.frames,
                      })}
                      className="px-1.5 py-1.5 rounded text-[9px] font-bold border transition-colors flex items-center justify-center gap-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500 cursor-pointer"
                    >
                      <Icon className="w-3 h-3 text-amber-500" />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instrucao de Arraste */}
      <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
        <Move className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
        <span>Arraste o interior para mover ou os vertices brancos para ajustar.</span>
      </div>

      {/* Acoes de Duplicar e Excluir */}
      <div className="flex gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onDuplicateBox(selectedBox.id)}
          className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
          title="Duplicar este Boxe"
        >
          <Copy className="w-3 h-3" />
          <span>Duplicar Boxe</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (confirm(`Excluir ${selectedBox.name}?`)) onDeleteBox(selectedBox.id);
          }}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer"
          title="Excluir Boxe"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
