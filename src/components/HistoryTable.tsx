'use client';

import React, { useState, useMemo } from 'react';
import { useDock } from '../context/DockContext';
import { formatDateTime, formatDuration } from '../utils/boxGeometry';
import {
  Download,
  Search,
  Filter,
  Trash2,
  FileSpreadsheet,
  FileCode,
  Clock,
  Truck,
  CheckCircle2
} from 'lucide-react';

export const HistoryTable: React.FC = () => {
  const { records, boxes, clearHistory, exportHistoryCSV, exportHistoryJSON } = useDock();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState('all');

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch =
        r.boxName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchBox = selectedBoxFilter === 'all' || r.boxId === selectedBoxFilter;

      return matchSearch && matchBox;
    });
  }, [records, searchTerm, selectedBoxFilter]);

  return (
    <div className="w-full flex flex-col gap-4">
      
      {/* Barra de Filtros e Exportação */}
      <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        
        {/* Filtros de Busca e Seleção de Boxe */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Input de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por boxe, tipo ou código..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Select de Boxe */}
          <div className="relative">
            <select
              value={selectedBoxFilter}
              onChange={e => setSelectedBoxFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 pr-8"
            >
              <option value="all">Todas as Docas</option>
              {boxes.map(box => (
                <option key={box.id} value={box.id}>
                  {box.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botões de Exportação e Limpeza */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportHistoryCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 font-semibold text-xs transition-colors shadow-sm"
            title="Baixar planilha CSV compatível com Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={exportHistoryJSON}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium text-xs transition-colors"
            title="Baixar arquivo de backup JSON"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Backup JSON</span>
          </button>

          {records.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/80 border border-slate-800 text-slate-500 hover:text-rose-400 text-xs transition-colors"
              title="Limpar Histórico"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      {/* Tabela de Registros com Scroll Horizontal Responsivo */}
      <div className="w-full rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4">Boxe / Doca</th>
                <th className="py-3.5 px-4">Entrada</th>
                <th className="py-3.5 px-4">Saída</th>
                <th className="py-3.5 px-4">Tempo Total em Doca</th>
                <th className="py-3.5 px-4">Veículo / IA</th>
                <th className="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {filteredRecords.map(rec => (
                <tr key={rec.id} className="hover:bg-slate-900/40 transition-colors">
                  
                  {/* Nome do Boxe */}
                  <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>{rec.boxName}</span>
                  </td>

                  {/* Entrada */}
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {formatDateTime(rec.entryTime)}
                  </td>

                  {/* Saída */}
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {formatDateTime(rec.exitTime)}
                  </td>

                  {/* Duração Formatada */}
                  <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800/50">
                      {rec.formattedDuration}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-500 font-normal">
                      ({(rec.durationSeconds / 60).toFixed(1)} min)
                    </span>
                  </td>

                  {/* Veículo / Confiança */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[11px] text-slate-300 uppercase">
                      <Truck className="w-3 h-3 text-cyan-400" />
                      <span>{rec.label}</span>
                      <strong className="text-cyan-400">{(rec.confidence * 100).toFixed(0)}%</strong>
                    </span>
                  </td>

                  {/* Status Final */}
                  <td className="py-3.5 px-4 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Concluído
                    </span>
                  </td>

                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 text-xs">
                    Nenhum registro encontrado. Quando caminhões entrarem e saírem das áreas desenhadas, os tempos aparecerão aqui automaticamente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Mostrando {filteredRecords.length} de {records.length} registros</span>
          <span className="font-mono text-[11px]">Sistema de Auditoria Automática</span>
        </div>
      </div>

    </div>
  );
};
