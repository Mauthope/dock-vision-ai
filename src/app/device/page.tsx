'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDock } from '@/context/DockContext';
import { useTruckDetection } from '@/hooks/useTruckDetection';
import { formatDuration } from '@/utils/boxGeometry';
import { Truck, Smartphone, Camera, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

function DeviceTerminalContent() {
  const searchParams = useSearchParams();
  const boxParam = searchParams.get('box');
  const { boxes, cameras, activeCameraId, processDetections, manualToggleOccupied } = useDock();

  const [selectedBoxId, setSelectedBoxId] = useState<string>(boxParam || 'all');
  const activeCamera = cameras.find(c => c.id === activeCameraId) || cameras[0];

  const targetBox = boxes.find(b => b.id === selectedBoxId);
  const isOccupied = targetBox?.status === 'occupied';
  const durationSec = targetBox?.currentTruck?.durationSeconds ?? 0;

  const {
    videoRef,
    cameraActive,
    cameraError,
    startCamera,
    fps,
    isLoadingModel,
  } = useTruckDetection({
    activeCamera,
    confidenceThreshold: 0.40,
    onDetections: processDetections,
  });

  return (
    <div className="min-h-screen bg-[#060a13] text-white flex flex-col justify-between p-3 sm:p-6 select-none">
      
      {/* Topo do Terminal */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-slate-300">
            {isLoadingModel ? 'Carregando IA...' : `${fps} FPS | Conectado`}
          </span>
        </div>
      </div>

      {/* Conteúdo Central: Visor e Cronômetro Gigante */}
      <div className="flex-1 flex flex-col items-center justify-center my-4 gap-4">
        
        {/* Seletor de Boxe para o Aparelho */}
        <div className="w-full max-w-md">
          <label className="text-xs text-slate-400 font-semibold mb-1 block">
            Este aparelho está monitorando:
          </label>
          <select
            value={selectedBoxId}
            onChange={e => setSelectedBoxId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Visão Geral (Todas as Docas)</option>
            {boxes.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} {b.status === 'occupied' ? '[Ocupado]' : '[Livre]'}
              </option>
            ))}
          </select>
        </div>

        {/* Card do Status do Boxe Selecionado */}
        {targetBox ? (
          <div className={`w-full max-w-md p-6 rounded-2xl border text-center flex flex-col items-center gap-3 transition-all ${
            isOccupied
              ? 'bg-rose-950/40 border-rose-500 shadow-2xl shadow-rose-950/50'
              : 'bg-slate-900/80 border-slate-800'
          }`}>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              {targetBox.name}
            </span>

            {isOccupied ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5 animate-pulse">
                  <Truck className="w-4 h-4" /> CAMINHÃO EM ATENDIMENTO
                </span>
                <span className="text-5xl sm:text-6xl font-extrabold font-mono text-white tracking-wider my-2">
                  {formatDuration(durationSec)}
                </span>
                <span className="text-xs text-slate-400">
                  Tempo corrido cronometrado automaticamente
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <span className="text-xl font-bold text-emerald-400">Boxe Disponível</span>
                <span className="text-xs text-slate-400">
                  Aponte a câmera para a vaga. O cronômetro iniciará ao detectar o caminhão.
                </span>
              </div>
            )}

            <button
              onClick={() => manualToggleOccupied(targetBox.id)}
              className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-98 ${
                isOccupied
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
              }`}
            >
              {isOccupied ? 'Finalizar Atendimento Manualmente' : 'Registrar Entrada Manual'}
            </button>
          </div>
        ) : (
          <div className="text-center text-slate-400 text-sm">
            Monitorando todas as docas simultaneamente no pátio.
          </div>
        )}

        {/* Visor da Câmera do Smartphone com vídeo nativo ultra leve */}
        <div className="w-full max-w-md h-52 rounded-xl overflow-hidden bg-black border border-slate-800 relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          
          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-[10px] font-mono text-cyan-300 border border-cyan-800/40">
            CÂMERA ATIVA
          </div>

          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
              <Camera className="w-6 h-6 text-rose-400 mb-2" />
              <p className="text-xs text-slate-300">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-600 text-xs font-bold text-slate-950"
              >
                Permitir Câmera
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Rodapé Informativo */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-900 pt-3">
        <span>VisionAi Terminal • Criado por Mauricio Grigol</span>
      </div>

    </div>
  );
}

export default function DeviceTerminalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-white">Carregando Terminal...</div>}>
      <DeviceTerminalContent />
    </Suspense>
  );
}
