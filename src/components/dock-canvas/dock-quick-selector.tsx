'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { DockBox, CameraSourceConfig } from '@/types/dock';

interface DockQuickSelectorProps {
  boxes: DockBox[];
  activeCameraId: string;
  selectedBoxId: string | null;
  cameras: CameraSourceConfig[];
  onSelectBoxAndCamera: (boxId: string) => void;
}

export const DockQuickSelector: React.FC<DockQuickSelectorProps> = ({
  boxes,
  activeCameraId,
  selectedBoxId,
  cameras,
  onSelectBoxAndCamera,
}) => {
  if (boxes.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/70 dark:bg-slate-950/70 bg-slate-100/90 border-b border-slate-200 dark:border-slate-800/80 overflow-x-auto custom-scrollbar z-10">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
        <Layers className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
        Docas:
      </span>
      {boxes.map(b => {
        const isCurrentCam = b.cameraId === activeCameraId;
        const isSelected = selectedBoxId === b.id;
        const isOcc = b.status === 'occupied';
        const cam = cameras.find(c => c.id === b.cameraId);

        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelectBoxAndCamera(b.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 border transition-all cursor-pointer ${
              isSelected
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-700 dark:text-white shadow-md shadow-cyan-500/20'
                : isOcc
                ? 'bg-rose-500/15 border-rose-500/60 text-rose-700 dark:text-rose-200 hover:border-rose-500'
                : isCurrentCam
                ? 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-cyan-500'
                : 'bg-white/80 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title={`Alternar para camera "${cam?.name || b.cameraId}" e inspecionar ${b.name}`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
            <span className="font-bold">{b.name}</span>
            <span
              className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                isCurrentCam
                  ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/15 border border-cyan-500/30'
                  : 'text-slate-500 bg-slate-100 dark:bg-slate-900'
              }`}
            >
              {cam ? cam.name.replace(/\(.*\)/, '').trim() : b.cameraId}
            </span>
            {isOcc && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />}
          </button>
        );
      })}
    </div>
  );
};
