'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DockBox,
  TruckRecord,
  CameraSourceConfig,
  DockSettings,
  SyncPayload,
  Point2D,
  TruckDetection
} from '../types/dock';
import { isTruckInsideDockBox, formatDuration } from '../utils/boxGeometry';
import { playEntryTone, playExitTone } from '../utils/audio';

const STORAGE_KEY_BOXES = 'dock_vision_boxes_v1';
const STORAGE_KEY_RECORDS = 'dock_vision_records_v1';
const STORAGE_KEY_SETTINGS = 'dock_vision_settings_v1';
const STORAGE_KEY_CAMERAS = 'dock_vision_cameras_v1';

// Boxes padrão com 4 vértices normalizados caso o usuário entre pela primeira vez
const DEFAULT_BOXES: DockBox[] = [
  {
    id: 'box-1',
    name: 'Boxe 1 - Docas Sul',
    color: '#06b6d4', // Ciano
    points: [
      { x: 0.08, y: 0.35 },
      { x: 0.45, y: 0.35 },
      { x: 0.45, y: 0.88 },
      { x: 0.08, y: 0.88 },
    ],
    cameraId: 'cam-main',
    status: 'empty',
    currentTruck: null,
    lastSession: null,
    detectionCriteria: 'ground',
    overlapThreshold: 0.25,
    entryDebounceFrames: 3,
    exitGraceSeconds: 3.5,
    targetClasses: ['truck'],
    consecutiveDetections: 0,
    consecutiveAbsences: 0,
  },
  {
    id: 'box-2',
    name: 'Boxe 2 - Carga Geral',
    color: '#10b981', // Esmeralda
    points: [
      { x: 0.54, y: 0.35 },
      { x: 0.92, y: 0.35 },
      { x: 0.92, y: 0.88 },
      { x: 0.54, y: 0.88 },
    ],
    cameraId: 'cam-main',
    status: 'empty',
    currentTruck: null,
    lastSession: null,
    detectionCriteria: 'ground',
    overlapThreshold: 0.25,
    entryDebounceFrames: 3,
    exitGraceSeconds: 3.5,
    targetClasses: ['truck'],
    consecutiveDetections: 0,
    consecutiveAbsences: 0,
  }
];

const DEFAULT_SETTINGS: DockSettings = {
  confidenceThreshold: 0.40,
  inferenceIntervalMs: 250,
  allowTruck: true,
  allowBus: true,
  allowCar: false,
  soundAlerts: true,
  autoSaveSnapshots: false,
  targetStayMinutes: 25,
};

const DEFAULT_CAMERAS: CameraSourceConfig[] = [
  {
    id: 'cam-main',
    name: 'Câmera Principal (Webcam / Aparelho)',
    type: 'webcam',
    facingMode: 'environment',
  },
  {
    id: 'cam-ip-1',
    name: 'Câmera IP Docas (Exemplo RTSP/MJPEG)',
    type: 'ip_camera',
    ipUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1280&q=80',
  },
  {
    id: 'cam-sample',
    name: 'Vídeo Simulação de Pátio',
    type: 'sample_video',
    sampleUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  }
];

interface DockContextType {
  boxes: DockBox[];
  records: TruckRecord[];
  cameras: CameraSourceConfig[];
  activeCameraId: string;
  settings: DockSettings;
  isDrawingMode: boolean;
  drawingShape: 'rectangle' | 'polygon';
  selectedBoxId: string | null;
  activeDeviceId: string;

  // Actions
  setActiveCameraId: (id: string) => void;
  setIsDrawingMode: (active: boolean) => void;
  setDrawingShape: (shape: 'rectangle' | 'polygon') => void;
  setSelectedBoxId: (id: string | null) => void;
  updateSettings: (newSettings: Partial<DockSettings>) => void;
  addBox: (box: Omit<DockBox, 'id' | 'status' | 'currentTruck' | 'lastSession'>) => string;
  updateBox: (id: string, updates: Partial<DockBox>) => void;
  deleteBox: (id: string) => void;
  addCamera: (cam: CameraSourceConfig) => void;
  updateCamera: (id: string, updates: Partial<CameraSourceConfig>) => void;
  deleteCamera: (id: string) => void;
  clearHistory: () => void;
  exportHistoryCSV: () => void;
  exportHistoryJSON: () => void;
  processDetections: (detections: TruckDetection[]) => void;
  manualToggleOccupied: (boxId: string) => void;

  // Estatísticas calculadas
  stats: {
    totalRecords: number;
    currentlyOccupied: number;
    occupancyRate: number;
    averageStaySeconds: number;
    fastestStaySeconds: number;
    longestStaySeconds: number;
    byBox: Record<string, { count: number; avgDurationSeconds: number; name: string }>;
  };
}

const DockContext = createContext<DockContextType | undefined>(undefined);

export const DockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [boxes, setBoxes] = useState<DockBox[]>(DEFAULT_BOXES);
  const [records, setRecords] = useState<TruckRecord[]>([]);
  const [cameras, setCameras] = useState<CameraSourceConfig[]>(DEFAULT_CAMERAS);
  const [activeCameraId, setActiveCameraId] = useState<string>('cam-main');
  const [settings, setSettings] = useState<DockSettings>(DEFAULT_SETTINGS);

  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawingShape, setDrawingShape] = useState<'rectangle' | 'polygon'>('rectangle');
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Identificador deste cliente (aparelho)
  const [activeDeviceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('dock_device_id');
      if (stored) return stored;
      const newId = 'dev-' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('dock_device_id', newId);
      return newId;
    }
    return 'dev-server';
  });

  // Carregar do localStorage no mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedBoxes = localStorage.getItem(STORAGE_KEY_BOXES);
      if (savedBoxes) setBoxes(JSON.parse(savedBoxes));

      const savedRecords = localStorage.getItem(STORAGE_KEY_RECORDS);
      if (savedRecords) setRecords(JSON.parse(savedRecords));

      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedSettings) setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));

      const savedCameras = localStorage.getItem(STORAGE_KEY_CAMERAS);
      if (savedCameras) setCameras(JSON.parse(savedCameras));
    } catch (e) {
      console.error('Falha ao restaurar dados locais:', e);
    }
  }, []);

  // Salvar no localStorage sempre que boxes mudam
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_BOXES, JSON.stringify(boxes));
    } catch (e) {
      console.warn('Erro ao salvar boxes no storage:', e);
    }
  }, [boxes]);

  // Salvar records no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    } catch (e) {
      console.warn('Erro ao salvar registros no storage:', e);
    }
  }, [records]);

  // Salvar settings no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Erro ao salvar configurações:', e);
    }
  }, [settings]);

  // Sincronização via BroadcastChannel (comunicação em tempo real entre abas no mesmo navegador)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel('dock_vision_sync_channel');

    channel.onmessage = (event: MessageEvent<SyncPayload>) => {
      const data = event.data;
      if (data && data.senderDeviceId !== activeDeviceId) {
        if (data.boxes) {
          setBoxes(data.boxes);
        }
        if (data.records) {
          setRecords(data.records);
        }
      }
    };

    return () => {
      channel.close();
    };
  }, [activeDeviceId]);

  // Função para transmitir atualização para outros aparelhos/abas
  const broadcastSync = useCallback((updatedBoxes: DockBox[], updatedRecords: TruckRecord[]) => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('dock_vision_sync_channel');
        channel.postMessage({
          boxes: updatedBoxes,
          records: updatedRecords,
          activeCameraId,
          senderDeviceId: activeDeviceId,
          timestamp: Date.now(),
        });
        channel.close();
      } catch (e) {
        console.warn('Broadcast sync error:', e);
      }
    }
  }, [activeCameraId, activeDeviceId]);

  // Atualizador do cronômetro em tempo real (1 segundo)
  useEffect(() => {
    const timer = setInterval(() => {
      setBoxes(prevBoxes => {
        let changed = false;
        const updated = prevBoxes.map(box => {
          if (box.status === 'occupied' && box.currentTruck) {
            changed = true;
            const now = Date.now();
            const elapsed = Math.floor((now - box.currentTruck.entryTime) / 1000);
            return {
              ...box,
              currentTruck: {
                ...box.currentTruck,
                durationSeconds: Math.max(0, elapsed),
              }
            };
          }
          return box;
        });
        return changed ? updated : prevBoxes;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Processamento e Filtragem Geométrica de Detecções de IA
  const processDetections = useCallback((detections: TruckDetection[]) => {
    const now = Date.now();

    setBoxes(prevBoxes => {
      let stateChanged = false;
      const newRecords: TruckRecord[] = [];

      const nextBoxes = prevBoxes.map(box => {
        // Ignora se o boxe não pertence à câmera atual
        if (box.cameraId !== activeCameraId) return box;

        // Filtra detecções que pertençam às classes alvo do boxe (ex: 'truck')
        const allowedDetections = detections.filter(d => {
          const cls = d.class.toLowerCase();
          if (cls === 'truck' && settings.allowTruck) return true;
          if (cls === 'bus' && settings.allowBus) return true;
          if (cls === 'car' && settings.allowCar) return true;
          return false;
        });

        // Avalia se alguma detecção está DENTRO do boxe desenhado
        let foundInside: TruckDetection | null = null;
        let bestOverlap = 0;

        for (const det of allowedDetections) {
          const evalResult = isTruckInsideDockBox(det, box);
          if (evalResult.isInside) {
            if (evalResult.overlap > bestOverlap || !foundInside) {
              bestOverlap = evalResult.overlap;
              foundInside = det;
            }
          }
        }

        const debounceThreshold = box.entryDebounceFrames || 3;
        const exitGraceMs = (box.exitGraceSeconds || 3.5) * 1000;

        let consecutiveDetections = box.consecutiveDetections || 0;
        let consecutiveAbsences = box.consecutiveAbsences || 0;
        let status = box.status;
        let currentTruck = box.currentTruck ? { ...box.currentTruck } : null;
        let lastSession = box.lastSession ? { ...box.lastSession } : null;

        if (foundInside) {
          consecutiveDetections++;
          consecutiveAbsences = 0;

          if (status === 'empty') {
            if (consecutiveDetections >= debounceThreshold) {
              // Entrada confirmada!
              status = 'occupied';
              currentTruck = {
                entryTime: now,
                durationSeconds: 0,
                confidence: foundInside.score,
                label: foundInside.class,
                lastSeenTime: now,
              };
              stateChanged = true;
              if (settings.soundAlerts) playEntryTone();
            } else {
              // Em aproximação (detectado por poucos frames)
              status = 'approaching';
              stateChanged = true;
            }
          } else if (status === 'approaching') {
            if (consecutiveDetections >= debounceThreshold) {
              status = 'occupied';
              currentTruck = {
                entryTime: now,
                durationSeconds: 0,
                confidence: foundInside.score,
                label: foundInside.class,
                lastSeenTime: now,
              };
              stateChanged = true;
              if (settings.soundAlerts) playEntryTone();
            }
          } else if (status === 'occupied' && currentTruck) {
            // Atualiza lastSeenTime e confiança
            currentTruck.lastSeenTime = now;
            currentTruck.confidence = Math.max(currentTruck.confidence, foundInside.score);
          }
        } else {
          // Não foi detectado nenhum caminhão dentro deste boxe neste frame
          consecutiveAbsences++;
          consecutiveDetections = 0;

          if (status === 'approaching') {
            status = 'empty';
            stateChanged = true;
          } else if (status === 'occupied' && currentTruck) {
            const timeSinceLastSeen = now - currentTruck.lastSeenTime;

            // Se o tempo sem detecção exceder a tolerância (exitGraceMs), confirma saída definitiva!
            if (timeSinceLastSeen >= exitGraceMs) {
              const finalDurationSec = Math.max(1, Math.floor((now - currentTruck.entryTime) / 1000));

              // Registra histórico final
              const rec: TruckRecord = {
                id: 'rec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                boxId: box.id,
                boxName: box.name,
                entryTime: currentTruck.entryTime,
                exitTime: now,
                durationSeconds: finalDurationSec,
                formattedDuration: formatDuration(finalDurationSec),
                label: currentTruck.label,
                confidence: currentTruck.confidence,
                cameraId: box.cameraId,
              };

              newRecords.push(rec);

              lastSession = {
                entryTime: currentTruck.entryTime,
                exitTime: now,
                durationSeconds: finalDurationSec,
              };

              status = 'empty';
              currentTruck = null;
              stateChanged = true;

              if (settings.soundAlerts) playExitTone();
            }
          }
        }

        return {
          ...box,
          status,
          currentTruck,
          lastSession,
          consecutiveDetections,
          consecutiveAbsences,
        };
      });

      if (newRecords.length > 0) {
        setRecords(prev => {
          const updated = [...newRecords, ...prev];
          broadcastSync(nextBoxes, updated);
          return updated;
        });
      } else if (stateChanged) {
        broadcastSync(nextBoxes, records);
      }

      return stateChanged ? nextBoxes : prevBoxes;
    });
  }, [activeCameraId, settings, broadcastSync, records]);

  // Ação manual de alternar ocupação (útil para testes ou intervenção manual)
  const manualToggleOccupied = useCallback((boxId: string) => {
    setBoxes(prev => {
      const updated = prev.map(b => {
        if (b.id !== boxId) return b;
        const now = Date.now();
        if (b.status === 'occupied' && b.currentTruck) {
          const duration = Math.max(1, Math.floor((now - b.currentTruck.entryTime) / 1000));
          const rec: TruckRecord = {
            id: 'rec-' + Date.now(),
            boxId: b.id,
            boxName: b.name,
            entryTime: b.currentTruck.entryTime,
            exitTime: now,
            durationSeconds: duration,
            formattedDuration: formatDuration(duration),
            label: 'truck',
            confidence: 1.0,
            cameraId: b.cameraId,
          };
          setRecords(prevRec => [rec, ...prevRec]);
          if (settings.soundAlerts) playExitTone();
          return {
            ...b,
            status: 'empty' as const,
            currentTruck: null,
            lastSession: {
              entryTime: b.currentTruck.entryTime,
              exitTime: now,
              durationSeconds: duration,
            }
          };
        } else {
          if (settings.soundAlerts) playEntryTone();
          return {
            ...b,
            status: 'occupied' as const,
            currentTruck: {
              entryTime: now,
              durationSeconds: 0,
              confidence: 0.95,
              label: 'truck',
              lastSeenTime: now,
            }
          };
        }
      });
      return updated;
    });
  }, [settings.soundAlerts]);

  // Adicionar Box
  const addBox = useCallback((boxData: Omit<DockBox, 'id' | 'status' | 'currentTruck' | 'lastSession'>) => {
    const id = 'box-' + Date.now();
    const newBox: DockBox = {
      ...boxData,
      id,
      status: 'empty',
      currentTruck: null,
      lastSession: null,
      consecutiveDetections: 0,
      consecutiveAbsences: 0,
    };
    setBoxes(prev => [...prev, newBox]);
    return id;
  }, []);

  // Atualizar Box
  const updateBox = useCallback((id: string, updates: Partial<DockBox>) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  // Excluir Box
  const deleteBox = useCallback((id: string) => {
    setBoxes(prev => prev.filter(b => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  }, [selectedBoxId]);

  // Câmeras
  const addCamera = useCallback((cam: CameraSourceConfig) => {
    setCameras(prev => [...prev, cam]);
  }, []);

  const updateCamera = useCallback((id: string, updates: Partial<CameraSourceConfig>) => {
    setCameras(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCamera = useCallback((id: string) => {
    setCameras(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    if (confirm('Tem certeza que deseja zerar o histórico de atendimentos?')) {
      setRecords([]);
    }
  }, []);

  // Exportar CSV
  const exportHistoryCSV = useCallback(() => {
    if (records.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    const headers = ['ID', 'Boxe', 'Horario_Entrada', 'Horario_Saida', 'Duracao_Segundos', 'Duracao_Formatada', 'Tipo', 'Confianca'];
    const rows = records.map(r => [
      r.id,
      `"${r.boxName.replace(/"/g, '""')}"`,
      new Date(r.entryTime).toISOString(),
      new Date(r.exitTime).toISOString(),
      r.durationSeconds,
      r.formattedDuration,
      r.label,
      `${(r.confidence * 100).toFixed(0)}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_docas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [records]);

  // Exportar JSON
  const exportHistoryJSON = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `docas_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [records]);

  // Atualizar Configurações Gerais
  const updateSettings = useCallback((newSettings: Partial<DockSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Métricas calculadas para Dashboard
  const stats = useMemo(() => {
    const totalRecords = records.length;
    const currentlyOccupied = boxes.filter(b => b.status === 'occupied').length;
    const occupancyRate = boxes.length > 0 ? (currentlyOccupied / boxes.length) * 100 : 0;

    let totalDuration = 0;
    let fastestStaySeconds = totalRecords > 0 ? Infinity : 0;
    let longestStaySeconds = 0;

    const byBox: Record<string, { count: number; avgDurationSeconds: number; name: string; totalSec: number }> = {};

    boxes.forEach(b => {
      byBox[b.id] = { count: 0, avgDurationSeconds: 0, name: b.name, totalSec: 0 };
    });

    records.forEach(r => {
      totalDuration += r.durationSeconds;
      if (r.durationSeconds < fastestStaySeconds) fastestStaySeconds = r.durationSeconds;
      if (r.durationSeconds > longestStaySeconds) longestStaySeconds = r.durationSeconds;

      if (!byBox[r.boxId]) {
        byBox[r.boxId] = { count: 0, avgDurationSeconds: 0, name: r.boxName, totalSec: 0 };
      }
      byBox[r.boxId].count += 1;
      byBox[r.boxId].totalSec += r.durationSeconds;
    });

    const averageStaySeconds = totalRecords > 0 ? Math.round(totalDuration / totalRecords) : 0;
    if (fastestStaySeconds === Infinity) fastestStaySeconds = 0;

    const formattedByBox: Record<string, { count: number; avgDurationSeconds: number; name: string }> = {};
    Object.keys(byBox).forEach(boxId => {
      const item = byBox[boxId];
      formattedByBox[boxId] = {
        name: item.name,
        count: item.count,
        avgDurationSeconds: item.count > 0 ? Math.round(item.totalSec / item.count) : 0,
      };
    });

    return {
      totalRecords,
      currentlyOccupied,
      occupancyRate,
      averageStaySeconds,
      fastestStaySeconds,
      longestStaySeconds,
      byBox: formattedByBox,
    };
  }, [boxes, records]);

  return (
    <DockContext.Provider
      value={{
        boxes,
        records,
        cameras,
        activeCameraId,
        settings,
        isDrawingMode,
        drawingShape,
        selectedBoxId,
        activeDeviceId,
        setActiveCameraId,
        setIsDrawingMode,
        setDrawingShape,
        setSelectedBoxId,
        updateSettings,
        addBox,
        updateBox,
        deleteBox,
        addCamera,
        updateCamera,
        deleteCamera,
        clearHistory,
        exportHistoryCSV,
        exportHistoryJSON,
        processDetections,
        manualToggleOccupied,
        stats,
      }}
    >
      {children}
    </DockContext.Provider>
  );
};

export const useDock = () => {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error('useDock must be used within a DockProvider');
  }
  return context;
};
