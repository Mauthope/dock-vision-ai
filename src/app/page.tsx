'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { KPISummary } from '@/components/KPISummary';
import { DockVisionCanvas } from '@/components/DockVisionCanvas';
import { IPCameraModal } from '@/components/IPCameraModal';
import { RemoteDeviceModal } from '@/components/RemoteDeviceModal';
import { useDock } from '@/context/DockContext';
import { formatDuration } from '@/utils/boxGeometry';
import {
  Truck,
  ShieldCheck,
  Zap,
  Sliders,
  Sparkles,
  Layers,
  HelpCircle,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function HomePage() {
  const {
    boxes,
    cameras,
    activeCameraId,
    selectBoxAndCamera,
    selectedBoxId,
    settings,
    updateSettings,
    manualToggleOccupied
  } = useDock();
  const [isIPModalOpen, setIsIPModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  return (
    <>
      <Navbar
        onOpenIPModal={() => setIsIPModalOpen(true)}
        onOpenDeviceModal={() => setIsDeviceModalOpen(true)}
      />

      <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 flex flex-col gap-5 pb-20">
        
        {/* Painel Superior de Resumo e Métricas (Estilo Bahia SummaryPanel) */}
        <KPISummary />

        {/* Linha Principal: Canvas de Visão Computacional + Painel de Controle de Docas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          
          {/* Coluna Principal: Feed de Câmera, IA e Desenho de Boxes */}
          <div className="col-span-1 lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
            <DockVisionCanvas />
          </div>

          {/* Coluna Lateral: No tablet retrato (md), as 2 caixas ficam lado a lado! No desktop/tablet paisagem (lg), ficam na lateral! */}
          <div className="col-span-1 lg:col-span-5 xl:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
            
            {/* Card: Status em Tempo Real dos Boxes */}
            <div className="p-4 rounded-2xl glass-panel border border-slate-800 shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Docas Monitoradas ({boxes.length})
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Ao Vivo
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {boxes.map(box => {
                  const isOcc = box.status === 'occupied';
                  const isApp = box.status === 'approaching';
                  const isSelected = selectedBoxId === box.id;
                  const isCurrentCam = box.cameraId === activeCameraId;
                  const duration = box.currentTruck?.durationSeconds ?? 0;
                  const cam = cameras.find(c => c.id === box.cameraId);

                  return (
                    <div
                      key={box.id}
                      onClick={() => selectBoxAndCamera(box.id)}
                      className={`p-3 rounded-xl border transition-all flex flex-col gap-2 cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-950/40'
                          : isOcc
                          ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/20 hover:border-rose-400'
                          : isApp
                          ? 'bg-amber-950/30 border-amber-500/50 hover:border-amber-400'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                      title={`Clique para alternar para a câmera "${cam?.name || box.cameraId}" e gerenciar ${box.name}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: box.color }}
                          />
                          <span className="font-bold text-sm text-white truncate">{box.name}</span>
                        </div>

                        {isOcc ? (
                          <span className="text-[10px] font-bold text-rose-300 bg-rose-950 px-2 py-0.5 rounded-full border border-rose-800 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            Ocupado
                          </span>
                        ) : isApp ? (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950 px-2 py-0.5 rounded-full border border-amber-800 shrink-0">
                            Aproximando
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800 shrink-0">
                            Livre
                          </span>
                        )}
                      </div>

                      {/* Identificação da Câmera Vinculada */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 truncate text-slate-400">
                          <Eye className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate">{cam ? cam.name : box.cameraId}</span>
                        </span>
                        {!isCurrentCam && (
                          <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40 shrink-0">
                            Ver Câmera
                          </span>
                        )}
                      </div>

                      {/* Tags do que este boxe detecta */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {(box.targetClasses || ['truck', 'bus']).map(cls => (
                          <span
                            key={cls}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono"
                          >
                            {cls === 'truck' ? '🚚 Caminhão' :
                             cls === 'bus' ? '🚌 Van' :
                             cls === 'person' ? '👤 Pessoa' :
                             cls === 'motion' ? '⚡ Movimento' : '🚗 Carro'}
                          </span>
                        ))}
                      </div>

                      {/* Cronômetro se Ocupado */}
                      {isOcc && (
                        <div className="p-2 rounded-lg bg-slate-950 border border-rose-900/50 flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {box.currentTruck?.label || 'Em Atendimento'}:
                          </span>
                          <span className="text-lg font-mono font-extrabold text-rose-400">
                            {formatDuration(duration)}
                          </span>
                        </div>
                      )}

                      {/* Último atendimento registrado */}
                      {!isOcc && box.lastSession && (
                        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                          <span>Última estadia:</span>
                          <span className="font-mono text-cyan-300 font-semibold">
                            {formatDuration(box.lastSession.durationSeconds)}
                          </span>
                        </div>
                      )}

                      {/* Botão de intervenção manual */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          manualToggleOccupied(box.id);
                        }}
                        className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isOcc
                            ? 'bg-rose-900/40 hover:bg-rose-800/60 text-rose-200 border border-rose-700/50'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {isOcc ? 'Finalizar Cronômetro Manual' : 'Simular Entrada Manual'}
                      </button>
                    </div>
                  );
                })}

                {boxes.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Nenhum boxe cadastrado nesta câmera. Use os botões acima do vídeo para desenhar retângulos ou polígonos nas vagas.
                  </div>
                )}
              </div>
            </div>

            {/* Card: Calibração de Precisão da IA (Garantindo 100% de detecção no boxe) */}
            <div className="p-4 rounded-2xl glass-panel border border-slate-800 shadow-xl flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Calibração Fina de Detecção</span>
              </div>

              {/* Limiar de Confiança */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Confiança Mínima IA</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {(settings.confidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.05"
                  value={settings.confidenceThreshold}
                  onChange={e => updateSettings({ confidenceThreshold: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Meta de Tempo por Boxe */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Meta de Estadia (Tempo Máx)</span>
                  <span className="font-mono font-bold text-teal-300">
                    {settings.targetStayMinutes} min
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={settings.targetStayMinutes}
                  onChange={e => updateSettings({ targetStayMinutes: parseInt(e.target.value) })}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>

              {/* Classes Permitidas Globalmente */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400">Classes Monitoradas na IA:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.allowTruck}
                      onChange={e => updateSettings({ allowTruck: e.target.checked })}
                      className="accent-cyan-400 rounded cursor-pointer"
                    />
                    <span>🚚 Caminhão</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.allowBus}
                      onChange={e => updateSettings({ allowBus: e.target.checked })}
                      className="accent-cyan-400 rounded cursor-pointer"
                    />
                    <span>🚌 Ônibus/Van</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.allowCar}
                      onChange={e => updateSettings({ allowCar: e.target.checked })}
                      className="accent-cyan-400 rounded cursor-pointer"
                    />
                    <span>🚗 Carro</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.allowPerson}
                      onChange={e => updateSettings({ allowPerson: e.target.checked })}
                      className="accent-cyan-400 rounded cursor-pointer"
                    />
                    <span>👤 Pessoa</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer col-span-2">
                    <input
                      type="checkbox"
                      checked={settings.allowMotion}
                      onChange={e => updateSettings({ allowMotion: e.target.checked })}
                      className="accent-cyan-400 rounded cursor-pointer"
                    />
                    <span>⚡ Qualquer Movimento</span>
                  </label>
                </div>
              </div>

              {/* Informação Técnica de Precisão */}
              <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-900/40 text-[11px] text-cyan-300/90 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Algoritmo <strong>Ray-Casting + Ponto de Contato no Solo</strong> ativado: a detecção só dispara quando os eixos do caminhão entram na vaga delimitada.
                </span>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Modais Globais */}
      <IPCameraModal
        isOpen={isIPModalOpen}
        onClose={() => setIsIPModalOpen(false)}
      />

      <RemoteDeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />
    </>
  );
}
