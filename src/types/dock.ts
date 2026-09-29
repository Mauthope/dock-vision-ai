export type BoxStatus = 'empty' | 'approaching' | 'occupied';

export interface Point2D {
  x: number; // Coordenada normalizada (0.0 a 1.0)
  y: number; // Coordenada normalizada (0.0 a 1.0)
}

export interface CurrentTruckState {
  entryTime: number; // Timestamp em ms
  durationSeconds: number;
  confidence: number;
  label: string;
  trackingId?: string;
  lastSeenTime: number;
}

export interface LastSessionState {
  entryTime: number;
  exitTime: number;
  durationSeconds: number;
  truckId?: string;
}

export interface DockBox {
  id: string;
  name: string;
  color: string;
  points: Point2D[]; // 4 pontos do polígono ou retângulo no plano normalizado (0 a 1)
  cameraId: string;
  status: BoxStatus;
  currentTruck: CurrentTruckState | null;
  lastSession: LastSessionState | null;
  // Parâmetros de calibração fina de detecção:
  detectionCriteria: 'auto' | 'close_dock' | 'ground' | 'centroid' | 'overlap'; // default: 'auto'
  overlapThreshold: number; // 0.1 a 0.8 (default 0.20)
  entryDebounceFrames: number; // frames consecutivos necessários para confirmar entrada (default 3)
  exitGraceSeconds: number; // segundos de tolerância de ausência antes de considerar saída (default 3.0)
  targetClasses: string[]; // ['truck', 'bus', 'car', 'person', 'motion']
  motionThreshold?: number; // Limiar de sensibilidade de área de movimento (0.01 a 0.15, default: 0.03 = 3%)
  motionDiffThreshold?: number; // Contraste mínimo de pixel para ruído de luz (15 a 50, default: 24)
  motionDebounceFrames?: number; // Frames consecutivos para confirmar disparo de movimento (1, 2 ou 3, default: 2)
  // Contadores internos de histerese:
  consecutiveDetections?: number;
  consecutiveAbsences?: number;
}

export type DetectionClassType = 'truck' | 'bus' | 'car' | 'person' | 'motion';

export interface TruckDetection {
  bbox: [number, number, number, number]; // [x, y, width, height] em pixels do frame
  normalizedBbox: [number, number, number, number]; // [x, y, w, h] normalizado 0 a 1
  class: 'truck' | 'car' | 'bus' | 'person' | 'motion' | string;
  label: string; // "Caminhão", "Carro", "Ônibus", "Pessoa", "Movimento"
  score: number;
  centroid: Point2D;
  groundContact: Point2D; // Ponto das rodas ou pés tocando o solo
  motionIntensity?: number; // Percentual da vaga com movimento medido (0 a 1.0)
}

export interface TruckRecord {
  id: string;
  boxId: string;
  boxName: string;
  entryTime: number;
  exitTime: number;
  durationSeconds: number;
  formattedDuration: string;
  label: string;
  confidence: number;
  notes?: string;
  cameraId: string;
  snapshotUrl?: string;
}

export type VideoSourceType = 'webcam' | 'ip_camera' | 'sample_video';

export interface CameraSourceConfig {
  id: string;
  name: string;
  type: VideoSourceType;
  deviceId?: string;
  ipUrl?: string; // URL MJPEG, snapshot HTTP ou HLS stream
  sampleUrl?: string;
  facingMode?: 'user' | 'environment';
}

export interface DockSettings {
  confidenceThreshold: number; // default 0.38
  inferenceIntervalMs: number; // default 380ms
  allowTruck: boolean;
  allowBus: boolean;
  allowCar: boolean;
  allowPerson: boolean;
  allowMotion: boolean;
  soundAlerts: boolean;
  autoSaveSnapshots: boolean;
  targetStayMinutes: number; // meta de tempo por caminhão (ex: 25 min)
}

export interface SyncPayload {
  boxes: DockBox[];
  records: TruckRecord[];
  activeCameraId: string;
  senderDeviceId: string;
  timestamp: number;
}
