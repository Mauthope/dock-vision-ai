'use client';

import React, { useState, useEffect } from 'react';
import { useDock } from '../context/DockContext';
import { X, Smartphone, Copy, Check, QrCode, Monitor, Video, Radio } from 'lucide-react';

interface RemoteDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemoteDeviceModal: React.FC<RemoteDeviceModalProps> = ({ isOpen, onClose }) => {
  const { boxes, activeDeviceId } = useDock();
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedBoxForDevice, setSelectedBoxForDevice] = useState<string>('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(window.location.origin);
    }
  }, []);

  if (!isOpen) return null;

  const deviceUrl = `${url}/device?box=${selectedBoxForDevice}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(deviceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-500 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Conectar Aparelho Remoto</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Transforme smartphones ou tablets em câmeras de doca
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

        {/* Conteúdo */}
        <div className="p-4 sm:p-6 flex flex-col gap-5">
          
          {/* Escolha do Boxe a ser assumido */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Qual doca este aparelho irá monitorar?
            </label>
            <select
              value={selectedBoxForDevice}
              onChange={e => setSelectedBoxForDevice(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Visão geral (todas as docas)</option>
              {boxes.map(box => (
                <option key={box.id} value={box.id}>
                  {box.name}
                </option>
              ))}
            </select>
          </div>

          {/* Link de Conexão */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                Link direto para o aparelho:
              </span>
              <span className="text-[10px] font-mono text-slate-500">ID: {activeDeviceId}</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={deviceUrl}
                className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-cyan-700 dark:text-cyan-300 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Instruções passo a passo */}
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </div>
              <p>Abra o navegador do smartphone e acesse o link copiado acima.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </div>
              <p>Permita o acesso à câmera traseira quando o navegador solicitar.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                3
              </div>
              <p>Posicione o celular em um tripé ou suporte apontado para a doca de carregamento.</p>
            </div>
          </div>

          {/* Botão de Abrir neste dispositivo */}
          <a
            href={deviceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Monitor className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Testar modo terminal nesta tela</span>
          </a>

        </div>

      </div>
    </div>
  );
};
