'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DockBox,
  TruckRecord,
  CameraSourceConfig,
  DockSettings,
  SyncPayload,
  Point2D,
  TruckDetection
} from '../types/dock';
import { isTruckInsideDockBox, formatDuration, moveBoxPointsByDelta } from '../utils/boxGeometry';
import { playEntryTone, playExitTone } from '../utils/audio';

const STORAGE_KEY_BOXES = 'dock_vision_boxes_v1';
const STORAGE_KEY_RECORDS = 'dock_vision_records_v1';
const STORAGE_KEY_SETTINGS = 'dock_vision_settings_v1';
const STORAGE_KEY_CAMERAS = 'dock_vision_cameras_v1';

const DEFAULT_BOXES: DockBox[] = [
  {
    id: 'box-1',
    name: 'Boxe 1 - Docas Sul',
    color: '#06b6d4',
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
    detectionCriteria: 'auto',
    overlapThreshold: 0.20,
    entryDebounceFrames: 2,
    exitGraceSeconds: 3.5,
    targetClasses: ['truck', 'bus', 'person'],
    motionThreshold: 0.03,
    motionDiffThreshold: 24,
    motionDebounceFrames: 2,
  },
  {
    id: 'box-2',
    name: 'Boxe 2 - Carga Geral',
    color: '#10b981',
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
    detectionCriteria: 'auto',
    overlapThreshold: 0.20,
    entryDebounceFrames: 2,
    exitGraceSeconds: 3.5,
    targetClasses: ['truck', 'bus', 'person'],
    motionThreshold: 0.03,
    motionDiffThreshold: 24,
    motionDebounceFrames: 2,
  }
];

const DEFAULT_SETTINGS: DockSettings = {
  confidenceThreshold: 0.38,
  inferenceIntervalMs: 380,
  allowTruck: true,
  allowBus: true,
  allowCar: true, // Habilitado globalmente para permitir controle granular por boxe
  allowPerson: true,
  allowMotion: true,
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
    name: 'Câmera IP Docas (RTSP/MJPEG)',
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
  selectedBoxId: string | null;
  activeDeviceId: string;

  // Actions
  setActiveCameraId: (id: string) => void;
  setSelectedBoxId: (id: string | null) => void;
  selectBoxAndCamera: (boxId: string) => void;
  updateSettings: (newSettings: Partial<DockSettings>) => void;
  addBox: (box: Omit<DockBox, 'id' | 'status' | 'currentTruck' | 'lastSession'>) => string;
  updateBox: (id: string, updates: Partial<DockBox>) => void;
  moveBox: (id: string, deltaX: number, deltaY: number) => void;
  duplicateBox: (id: string) => void;
  deleteBox: (id: string) => void;
  addCamera: (cam: CameraSourceConfig) => void;
  updateCamera: (id: string, updates: Partial<CameraSourceConfig>) => void;
  deleteCamera: (id: string) => void;
  clearHistory: () => void;
  exportHistoryCSV: () => void;
  exportHistoryJSON: () => void;
  processDetections: (detections: TruckDetection[]) => void;
  manualToggleOccupied: (boxId: string) => void;

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
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Ref para sincronização síncrona nos loops de renderização sem disparar re-render
  const boxesRef = useRef<DockBox[]>(boxes);
  boxesRef.current = boxes;

  const recordsRef = useRef<TruckRecord[]>(records);
  recordsRef.current = records;

  // Contadores de histerese e presença mantidos fora do React State para evitar re-render em massa!
  const boxCountersRef = useRef<Record<string, {
    consecutiveDetections: number;
    consecutiveAbsences: number;
    lastSeenTime: number;
  }>>({});

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
      if (savedBoxes) {
        const parsed = JSON.parse(savedBoxes);
        // Garante que todos os boxes tenham critérios modernos compatíveis com câmeras próximas e sensibilidade de movimento
        const updated = parsed.map((b: any) => {
          let classes = b.targetClasses && b.targetClasses.length > 0 ? b.targetClasses : ['truck', 'bus', 'person'];
          // Se o boxe tinha apenas a configuração antiga ['truck', 'bus'], adiciona 'person' para que funcione de imediato
          if (!classes.includes('person') && classes.includes('truck') && classes.includes('bus') && classes.length === 2) {
            classes = [...classes, 'person'];
          }
          return {
            ...b,
            detectionCriteria: (!b.detectionCriteria || b.detectionCriteria === 'ground') ? 'auto' : b.detectionCriteria,
            overlapThreshold: b.overlapThreshold !== undefined ? Math.min(b.overlapThreshold, 0.25) : 0.20,
            entryDebounceFrames: b.entryDebounceFrames ?? 2,
            targetClasses: classes,
            motionThreshold: b.motionThreshold ?? 0.03,
            motionDiffThreshold: b.motionDiffThreshold ?? 24,
            motionDebounceFrames: b.motionDebounceFrames ?? 2,
          };
        });
        setBoxes(updated);
      }

      const savedRecords = localStorage.getItem(STORAGE_KEY_RECORDS);
      if (savedRecords) setRecords(JSON.parse(savedRecords));

      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedSettings) {
        const parsedStg = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsedStg,
          allowCar: true, // Força true para não descartar caminhões detectados como car
          allowTruck: true,
          allowBus: true,
          allowPerson: parsedStg.allowPerson ?? true,
          allowMotion: parsedStg.allowMotion ?? true,
        }));
      }

      const savedCameras = localStorage.getItem(STORAGE_KEY_CAMERAS);
      if (savedCameras) setCameras(JSON.parse(savedCameras));
    } catch (e) {
      console.error('Falha ao restaurar dados locais:', e);
    }
  }, []);

  // Salvar boxes com Debounce (apenas quando o usuário cria/edita/remove)
  const saveBoxesTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (saveBoxesTimerRef.current) clearTimeout(saveBoxesTimerRef.current);

    saveBoxesTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_BOXES, JSON.stringify(boxes));
      } catch (e) {
        console.warn('Erro ao salvar boxes:', e);
      }
    }, 1000);

    return () => {
      if (saveBoxesTimerRef.current) clearTimeout(saveBoxesTimerRef.current);
    };
  }, [boxes]);

  // Salvar registros
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    } catch (e) {
      console.warn('Erro ao salvar registros:', e);
    }
  }, [records]);

  // Salvar settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Erro ao salvar settings:', e);
    }
  }, [settings]);

  // BroadcastChannel para sincronização entre abas
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel('dock_vision_sync_channel');

    channel.onmessage = (event: MessageEvent<SyncPayload>) => {
      const data = event.data;
      if (data && data.senderDeviceId !== activeDeviceId) {
        if (data.boxes) setBoxes(data.boxes);
        if (data.records) setRecords(data.records);
      }
    };

    return () => {
      channel.close();
    };
  }, [activeDeviceId]);

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

  // Cronômetro em tempo real de 1s (apenas atualiza boxes ocupados)
  useEffect(() => {
    const timer = setInterval(() => {
      setBoxes(prevBoxes => {
        let hasOccupied = false;
        const now = Date.now();

        const updated = prevBoxes.map(box => {
          if (box.status === 'occupied' && box.currentTruck) {
            hasOccupied = true;
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

        return hasOccupied ? updated : prevBoxes;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Processamento de IA OTIMIZADO: Só atualiza State quando o status EFETIVAMENTE muda!
  const processDetections = useCallback((detections: TruckDetection[]) => {
    const now = Date.now();
    const currentBoxes = boxesRef.current;
    let stateChanged = false;
    const newRecords: TruckRecord[] = [];

    const allowedDetections = detections.filter(d => {
      const cls = d.class.toLowerCase();
      if (cls === 'truck' && settings.allowTruck) return true;
      if (cls === 'bus' && settings.allowBus) return true;
      if (cls === 'car' && settings.allowCar) return true;
      if (cls === 'person' && settings.allowPerson) return true;
      if (cls === 'motion' && settings.allowMotion) return true;
      return false;
    });

    const nextBoxes = currentBoxes.map(box => {
      if (box.cameraId !== activeCameraId) return box;

      if (!boxCountersRef.current[box.id]) {
        boxCountersRef.current[box.id] = {
          consecutiveDetections: 0,
          consecutiveAbsences: 0,
          lastSeenTime: now,
        };
      }
      const counters = boxCountersRef.current[box.id];

      // Avalia se há veículo/pessoa/movimento permitido para este boxe dentro dele
      let foundInside: TruckDetection | null = null;
      let bestOverlap = 0;
      const boxAllowed = box.targetClasses || ['truck', 'bus', 'person'];

      for (let i = 0; i < allowedDetections.length; i++) {
        const det = allowedDetections[i];
        // Se o boxe não aceita essa classe de detecção, ignora!
        if (!boxAllowed.includes(det.class)) continue;

        const evalRes = isTruckInsideDockBox(det, box);
        if (evalRes.isInside && (!foundInside || evalRes.overlap > bestOverlap)) {
          bestOverlap = evalRes.overlap;
          foundInside = det;
        }
      }

      // Para detecção de movimento ou pessoa, o disparo é ágil
      const isMotion = foundInside?.class === 'motion';
      const isPerson = foundInside?.class === 'person';
      const debounceThreshold = isMotion
        ? (box.motionDebounceFrames ?? 2)
        : isPerson
        ? 1 // Disparo ágil de 1 frame para pedestres/conferentes
        : (box.entryDebounceFrames || 2);
      const exitGraceMs = (box.exitGraceSeconds || 3.5) * 1000;

      if (foundInside) {
        counters.consecutiveDetections++;
        counters.consecutiveAbsences = 0;
        counters.lastSeenTime = now;

        const defaultLabel = foundInside.label || (
          foundInside.class === 'truck' ? 'Caminhão' :
          foundInside.class === 'person' ? 'Pessoa' :
          foundInside.class === 'motion' ? 'Movimento' :
          foundInside.class === 'bus' ? 'Ônibus/Van' : 'Veículo'
        );

        if (box.status === 'empty') {
          if (counters.consecutiveDetections >= debounceThreshold) {
            // CONFIRMADO: Vazio -> Ocupado (Na hora para movimento!)
            stateChanged = true;
            if (settings.soundAlerts) playEntryTone();
            return {
              ...box,
              status: 'occupied' as const,
              currentTruck: {
                entryTime: now,
                durationSeconds: 0,
                confidence: foundInside.score,
                label: defaultLabel,
                lastSeenTime: now,
              }
            };
          } else {
            stateChanged = true;
            return { ...box, status: 'approaching' as const };
          }
        } else if (box.status === 'approaching') {
          if (counters.consecutiveDetections >= debounceThreshold) {
            stateChanged = true;
            if (settings.soundAlerts) playEntryTone();
            return {
              ...box,
              status: 'occupied' as const,
              currentTruck: {
                entryTime: now,
                durationSeconds: 0,
                confidence: foundInside.score,
                label: defaultLabel,
                lastSeenTime: now,
              }
            };
          }
        }
      } else {
        counters.consecutiveAbsences++;
        counters.consecutiveDetections = 0;

        if (box.status === 'approaching') {
          stateChanged = true;
          return { ...box, status: 'empty' as const };
        } else if (box.status === 'occupied' && box.currentTruck) {
          const timeSinceLastSeen = now - counters.lastSeenTime;

          if (timeSinceLastSeen >= exitGraceMs) {
            // CONFIRMADO: Ocupado -> Liberado
            const finalDurationSec = Math.max(1, Math.floor((now - box.currentTruck.entryTime) / 1000));

            const rec: TruckRecord = {
              id: 'rec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              boxId: box.id,
              boxName: box.name,
              entryTime: box.currentTruck.entryTime,
              exitTime: now,
              durationSeconds: finalDurationSec,
              formattedDuration: formatDuration(finalDurationSec),
              label: box.currentTruck.label,
              confidence: box.currentTruck.confidence,
              cameraId: box.cameraId,
            };

            newRecords.push(rec);
            stateChanged = true;
            if (settings.soundAlerts) playExitTone();

            return {
              ...box,
              status: 'empty' as const,
              currentTruck: null,
              lastSession: {
                entryTime: box.currentTruck.entryTime,
                exitTime: now,
                durationSeconds: finalDurationSec,
              }
            };
          }
        }
      }

      return box;
    });

    if (newRecords.length > 0) {
      setRecords(prev => [...newRecords, ...prev]);
    }

    if (stateChanged) {
      setBoxes(nextBoxes);
      broadcastSync(nextBoxes, recordsRef.current);
    }
  }, [activeCameraId, settings, broadcastSync]);

  // Mover Boxe Inteiro por Delta
  const moveBox = useCallback((id: string, deltaX: number, deltaY: number) => {
    setBoxes(prev => prev.map(b => {
      if (b.id !== id) return b;
      return {
        ...b,
        points: moveBoxPointsByDelta(b.points, deltaX, deltaY)
      };
    }));
  }, []);

  // Duplicar Boxe
  const duplicateBox = useCallback((id: string) => {
    const existing = boxes.find(b => b.id === id);
    if (!existing) return;

    const newBox: DockBox = {
      ...existing,
      id: 'box-' + Date.now(),
      name: `${existing.name} (Cópia)`,
      points: moveBoxPointsByDelta(existing.points, 0.04, 0.04),
      status: 'empty',
      currentTruck: null,
      lastSession: null,
    };

    setBoxes(prev => [...prev, newBox]);
    setSelectedBoxId(newBox.id);
  }, [boxes]);

  // Alternar ocupação manual
  const manualToggleOccupied = useCallback((boxId: string) => {
    setBoxes(prev => {
      const now = Date.now();
      return prev.map(b => {
        if (b.id !== boxId) return b;
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
              confidence: 0.98,
              label: 'truck',
              lastSeenTime: now,
            }
          };
        }
      });
    });
  }, [settings.soundAlerts]);

  const addBox = useCallback((boxData: Omit<DockBox, 'id' | 'status' | 'currentTruck' | 'lastSession'>) => {
    const id = 'box-' + Date.now();
    const newBox: DockBox = {
      ...boxData,
      id,
      status: 'empty',
      currentTruck: null,
      lastSession: null,
    };
    setBoxes(prev => [...prev, newBox]);
    setSelectedBoxId(id);
    return id;
  }, []);

  const updateBox = useCallback((id: string, updates: Partial<DockBox>) => {
    setBoxes(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const deleteBox = useCallback((id: string) => {
    setBoxes(prev => prev.filter(b => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  }, [selectedBoxId]);

  const addCamera = useCallback((cam: CameraSourceConfig) => setCameras(prev => [...prev, cam]), []);
  const updateCamera = useCallback((id: string, updates: Partial<CameraSourceConfig>) => {
    setCameras(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);
  const deleteCamera = useCallback((id: string) => setCameras(prev => prev.filter(c => c.id !== id)), []);

  const clearHistory = useCallback(() => {
    if (confirm('Zerar o histórico de atendimentos?')) setRecords([]);
  }, []);

  const exportHistoryCSV = useCallback(() => {
    if (records.length === 0) return alert('Nenhum registro para exportar.');
    const headers = ['ID', 'Boxe', 'Entrada', 'Saida', 'Segundos', 'Duracao', 'Veiculo', 'Confianca'];
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
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `docas_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }, [records]);

  const exportHistoryJSON = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `docas_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  }, [records]);

  const updateSettings = useCallback((newSettings: Partial<DockSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

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

  // Selecionar boxe e mudar automaticamente para a câmera responsável por ele
  const selectBoxAndCamera = useCallback((boxId: string) => {
    setSelectedBoxId(boxId);
    const box = boxesRef.current.find(b => b.id === boxId);
    if (box && box.cameraId && box.cameraId !== activeCameraId) {
      setActiveCameraId(box.cameraId);
    }
  }, [activeCameraId]);

  return (
    <DockContext.Provider
      value={{
        boxes,
        records,
        cameras,
        activeCameraId,
        settings,
        selectedBoxId,
        activeDeviceId,
        setActiveCameraId,
        setSelectedBoxId,
        selectBoxAndCamera,
        updateSettings,
        addBox,
        updateBox,
        moveBox,
        duplicateBox,
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
  if (!context) throw new Error('useDock must be used within DockProvider');
  return context;
};
