'use client';

import React, { useState } from 'react';
import { useDock } from '../context/DockContext';
import { CameraSourceConfig } from '../types/dock';
import { X, Video, Plus, Check, Trash2, Globe, Shield, HelpCircle, Smartphone } from 'lucide-react';

interface IPCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IPCameraModal: React.FC<IPCameraModalProps> = ({ isOpen, onClose }) => {
  const { cameras, activeCameraId, setActiveCameraId, addCamera, deleteCamera } = useDock();

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'ip_camera' | 'webcam' | 'sample_video'>('ip_camera');
  const [newUrl, setNewUrl] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCam: CameraSourceConfig = {
      id: 'cam-' + Date.now(),
      name: newName.trim(),
      type: newType,
      ipUrl: newType === 'ip_camera' ? newUrl.trim() : undefined,
      sampleUrl: newType === 'sample_video' ? newUrl.trim() : undefined,
      facingMode: newType === 'webcam' ? facingMode : undefined,
    };

    addCamera(newCam);
    setActiveCameraId(newCam.id);
    setNewName('');
    setNewUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Fontes de Vídeo & Câmeras IP</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Alterne entre Webcams, Câmeras IP Industriais (RTSP/MJPEG) e Simulação
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          
          {/* Câmeras Atualmente Cadastradas */}
          <div>
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Câmeras Conectadas ({cameras.length})
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              {cameras.map(cam => {
                const isActive = cam.id === activeCameraId;
                return (
                  <div
                    key={cam.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isActive
                        ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-400 dark:border-cyan-500/60 shadow-lg shadow-cyan-950/10'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {cam.type === 'webcam' ? <Smartphone className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{cam.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                            {cam.type}
                          </span>
                        </div>
                        {cam.ipUrl && (
                          <span className="text-xs text-slate-500 font-mono truncate block max-w-sm">
                            {cam.ipUrl}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-cyan-800 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-300 dark:border-cyan-800/60">
                          <Check className="w-3.5 h-3.5" /> Ativa
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveCameraId(cam.id);
                            onClose();
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
                        >
                          Usar esta câmera
                        </button>
                      )}

                      {cameras.length > 1 && (
                        <button
                          onClick={() => deleteCamera(cam.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                          title="Remover câmera"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Formulário: Adicionar Nova Câmera IP */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Adicionar Nova Câmera / Stream IP
            </h3>

            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1 block">Nome Identificador</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Ex: Câmera Doca 03 Norte"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1 block">Tipo de Fonte</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ip_camera">Câmera IP (MJPEG / HTTP Stream / Snapshot)</option>
                    <option value="webcam">Webcam / Celular (WebRTC)</option>
                    <option value="sample_video">Vídeo de Teste / Demonstração (MP4)</option>
                  </select>
                </div>
              </div>

              {newType === 'ip_camera' && (
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1 block">URL do Stream / Snapshot IP</label>
                  <input
                    type="text"
                    required
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8080/video ou http://servidor/doca1.mjpeg"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Aceita streams MJPEG HTTP, URLs de snapshots periódicos ou stream WebRTC/HLS proxy.
                  </span>
                </div>
              )}

              {newType === 'sample_video' && (
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1 block">URL do Arquivo MP4</label>
                  <input
                    type="text"
                    required
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder="https://exemplo.com/caminhao_doca.mp4"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {newType === 'webcam' && (
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1 block">Lente Preferencial</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFacingMode('environment')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                        facingMode === 'environment'
                          ? 'bg-cyan-100 text-cyan-800 border-cyan-400 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-700'
                          : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                      }`}
                    >
                      Traseira (Chão de Fábrica / Pátio)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacingMode('user')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                        facingMode === 'user'
                          ? 'bg-cyan-100 text-cyan-800 border-cyan-400 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-700'
                          : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                      }`}
                    >
                      Frontal
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all active:scale-[0.99]"
              >
                Cadastrar Câmera
              </button>
            </form>
          </div>

          {/* Dicas e Instruções para Câmeras IP Corporativas */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
            <HelpCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-slate-800 dark:text-slate-300">Como conectar câmeras IP comerciais (Intelbras, Hikvision, Dahua):</strong>
              <p className="mt-0.5">
                Câmeras de segurança comumente transmitem em protocolo RTSP. Para visualizar em navegadores sem delay, você pode utilizar um gateway leve como <code className="text-cyan-700 dark:text-cyan-300 font-mono">go2rtc</code> ou <code className="text-cyan-700 dark:text-cyan-300 font-mono">MediaMTX</code> que converte RTSP para WebRTC/MJPEG HTTP instantaneamente.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
