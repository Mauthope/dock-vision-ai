'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TruckDetection, CameraSourceConfig, DockBox } from '../types/dock';
import { isPointInPolygon } from '../utils/boxGeometry';

interface UseTruckDetectionOptions {
  activeCamera: CameraSourceConfig;
  confidenceThreshold?: number;
  inferenceIntervalMs?: number;
  onDetections?: (detections: TruckDetection[]) => void;
  boxes?: DockBox[];
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export function useTruckDetection({
  activeCamera,
  confidenceThreshold = 0.38,
  inferenceIntervalMs = 380,
  onDetections,
  boxes = [],
}: UseTruckDetectionOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modelRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(activeCamera?.deviceId || '');
  const [fps, setFps] = useState<number>(0);

  // Armazena detecções em Ref para 60 FPS sem re-render desnecessário no React
  const detectionsRef = useRef<TruckDetection[]>([]);
  const isDetectingRef = useRef<boolean>(false);
  const onDetectionsRef = useRef(onDetections);
  onDetectionsRef.current = onDetections;

  const boxesRef = useRef<DockBox[]>(boxes);
  boxesRef.current = boxes;
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<Uint8Array | null>(null);

  // Carregar Modelo TensorFlow.js COCO-SSD com aceleração WebGL
  useEffect(() => {
    let isMounted = true;

    async function loadModel() {
      try {
        setIsLoadingModel(true);
        setModelError(null);

        const tf = await import('@tensorflow/tfjs');
        await tf.ready();

        if (tf.getBackend() !== 'webgl') {
          try {
            await tf.setBackend('webgl');
          } catch (e) {
            console.warn('WebGL fallback:', tf.getBackend());
          }
        }

        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2', // Ultra rápido e leve para mobile
        });

        if (isMounted) {
          modelRef.current = loadedModel;
          setIsLoadingModel(false);
        }
      } catch (err: any) {
        console.error('Erro ao carregar modelo COCO-SSD:', err);
        if (isMounted) {
          setModelError(err?.message || 'Falha ao carregar o motor de IA.');
          setIsLoadingModel(false);
        }
      }
    }

    loadModel();

    return () => {
      isMounted = false;
    };
  }, []);

  // Enumerate Câmeras Físicas
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Câmera ${idx + 1}`
        }));
      setAvailableDevices(videoDevs);
    } catch (err) {
      console.warn('Erro ao enumerar dispositivos:', err);
    }
  }, []);

  // Parar stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Iniciar Fonte de Vídeo (Otimizado com limites reais para smartphone)
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!activeCamera) return;

    if (activeCamera.type === 'sample_video' && activeCamera.sampleUrl) {
      if (videoRef.current) {
        videoRef.current.src = activeCamera.sampleUrl;
        videoRef.current.loop = true;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.crossOrigin = 'anonymous';
        videoRef.current.play().catch(e => console.warn('Sample video play error:', e));
        setCameraActive(true);
      }
      return;
    }

    if (activeCamera.type === 'ip_camera') {
      setCameraActive(true);
      return;
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Navegador não suporta acesso à câmera.');
      return;
    }

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    // Resoluções controladas para não travar celulares
    const videoConstraints: MediaTrackConstraints = isMobile
      ? {
          facingMode: { ideal: activeCamera.facingMode || 'environment' },
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 24, max: 30 }
        }
      : {
          facingMode: { ideal: activeCamera.facingMode || 'environment' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 }
        };

    if (selectedDeviceId) {
      videoConstraints.deviceId = { exact: selectedDeviceId };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      streamRef.current = stream;
      refreshDevices();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;

        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          videoRef.current.onloadedmetadata = () => resolve();
          setTimeout(resolve, 500);
        });

        await videoRef.current.play().catch(() => {});
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('Falha ao iniciar câmera:', err);
      let msg = 'Não foi possível acessar a câmera.';
      if (err.name === 'NotAllowedError') {
        msg = 'Permissão de câmera negada.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Nenhuma câmera conectada encontrada.';
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, [activeCamera, selectedDeviceId, stopCamera, refreshDevices]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Loop de Inferência com Auto-Encadeamento Não-Bloqueante
  useEffect(() => {
    if (!cameraActive) return;

    let isRunning = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    // Intervalo adaptativo: 500ms no celular mantém bateria fria e FPS suave
    const effectiveCooldown = isMobile ? Math.max(500, inferenceIntervalMs) : inferenceIntervalMs;

    const runInferenceCycle = async () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const model = modelRef.current;

      if (model && video && video.readyState >= 2 && !video.paused && !isDetectingRef.current) {
        isDetectingRef.current = true;

        const now = performance.now();
        frameCount++;
        if (now - lastFpsTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
          frameCount = 0;
          lastFpsTime = now;
        }

        try {
          const vWidth = video.videoWidth;
          const vHeight = video.videoHeight;

          if (vWidth > 0 && vHeight > 0) {
            // Executa predição DIRETO no elemento de vídeo via WebGL (zero distorção de aspecto!)
            const predictions = await model.detect(video, 10, confidenceThreshold);

            const vehicleDetections: TruckDetection[] = [];

            for (let i = 0; i < predictions.length; i++) {
              const p = predictions[i];
              const cls = p.class.toLowerCase();

              // FILTRO PRECISO DE CLASSES (Caminhão, Ônibus/Van, Carro, Pessoa/Pedestre)
              if (cls === 'truck' || cls === 'bus' || cls === 'car' || cls === 'person') {
                const [rx, ry, rw, rh] = p.bbox;

                // Coordenadas normalizadas matematicamente exatas em relação ao vídeo real
                const normalizedBbox: [number, number, number, number] = [
                  Math.max(0, Math.min(1, rx / vWidth)),
                  Math.max(0, Math.min(1, ry / vHeight)),
                  Math.max(0, Math.min(1, rw / vWidth)),
                  Math.max(0, Math.min(1, rh / vHeight)),
                ];

                const centroid = {
                  x: normalizedBbox[0] + normalizedBbox[2] / 2,
                  y: normalizedBbox[1] + normalizedBbox[3] / 2,
                };

                // Ponto de contato com o solo: pés para pessoa (98%), rodas para veículos (94%)
                const groundContact = {
                  x: normalizedBbox[0] + normalizedBbox[2] / 2,
                  y: Math.min(1, normalizedBbox[1] + normalizedBbox[3] * (cls === 'person' ? 0.98 : 0.94)),
                };

                // Identificação autêntica de cada elemento
                let label = 'Carro';
                if (cls === 'truck') {
                  label = 'Caminhão';
                } else if (cls === 'bus') {
                  label = 'Ônibus/Van';
                } else if (cls === 'person') {
                  label = 'Pessoa';
                }

                vehicleDetections.push({
                  bbox: [rx, ry, rw, rh],
                  normalizedBbox,
                  class: cls, // 'truck' | 'bus' | 'car' | 'person'
                  label,
                  score: p.score,
                  centroid,
                  groundContact,
                });
              }
            }

            // DETECÇÃO DE MOVIMENTO EM TEMPO REAL (Frame-Differencing Ultrarrápido)
            const currentBoxes = boxesRef.current || [];
            const boxesWithMotion = currentBoxes.filter(
              b => b.cameraId === activeCamera.id && b.targetClasses?.includes('motion') && b.points.length >= 3
            );

            if (boxesWithMotion.length > 0) {
              if (!motionCanvasRef.current && typeof document !== 'undefined') {
                motionCanvasRef.current = document.createElement('canvas');
              }
              const mCanvas = motionCanvasRef.current;
              if (mCanvas) {
                mCanvas.width = 160;
                mCanvas.height = 90;
                const mCtx = mCanvas.getContext('2d', { willReadFrequently: true });
                if (mCtx) {
                  mCtx.drawImage(video, 0, 0, 160, 90);
                  const imgData = mCtx.getImageData(0, 0, 160, 90);
                  const data = imgData.data;
                  const len = data.length / 4;
                  const gray = new Uint8Array(len);
                  for (let idx = 0; idx < len; idx++) {
                    gray[idx] = (data[idx * 4] * 77 + data[idx * 4 + 1] * 150 + data[idx * 4 + 2] * 29) >> 8;
                  }

                  const prevGray = prevFrameDataRef.current;
                  if (prevGray && prevGray.length === len) {
                    for (const box of boxesWithMotion) {
                      const minX = Math.min(...box.points.map(p => p.x));
                      const maxX = Math.max(...box.points.map(p => p.x));
                      const minY = Math.min(...box.points.map(p => p.y));
                      const maxY = Math.max(...box.points.map(p => p.y));

                      const startPxX = Math.floor(minX * 160);
                      const endPxX = Math.ceil(maxX * 160);
                      const startPxY = Math.floor(minY * 90);
                      const endPxY = Math.ceil(maxY * 90);

                      let totalInside = 0;
                      let changedPixels = 0;

                      for (let py = startPxY; py < endPxY; py += 2) {
                        if (py < 0 || py >= 90) continue;
                        const normY = py / 90;
                        for (let px = startPxX; px < endPxX; px += 2) {
                          if (px < 0 || px >= 160) continue;
                          const normX = px / 160;

                          if (isPointInPolygon({ x: normX, y: normY }, box.points)) {
                            totalInside++;
                            const pIdx = py * 160 + px;
                            const diff = Math.abs(gray[pIdx] - prevGray[pIdx]);
                            if (diff > 22) { // Limiar de movimento
                              changedPixels++;
                            }
                          }
                        }
                      }

                      if (totalInside > 0) {
                        const motionIntensity = changedPixels / totalInside;
                        // Se pelo menos 3% dos pixels da área demarcada mudaram
                        if (motionIntensity >= 0.03) {
                          const boxCenterX = (minX + maxX) / 2;
                          const boxCenterY = (minY + maxY) / 2;
                          vehicleDetections.push({
                            bbox: [minX * vWidth, minY * vHeight, (maxX - minX) * vWidth, (maxY - minY) * vHeight],
                            normalizedBbox: [minX, minY, maxX - minX, maxY - minY],
                            class: 'motion',
                            label: 'Movimento',
                            score: Math.min(0.99, Math.max(0.40, motionIntensity * 8)),
                            centroid: { x: boxCenterX, y: boxCenterY },
                            groundContact: { x: boxCenterX, y: boxCenterY },
                          });
                        }
                      }
                    }
                  }
                  prevFrameDataRef.current = gray;
                }
              }
            }

            detectionsRef.current = vehicleDetections;

            if (onDetectionsRef.current) {
              onDetectionsRef.current(vehicleDetections);
            }
          }
        } catch (err) {
          console.warn('Erro inferência IA:', err);
        } finally {
          isDetectingRef.current = false;
        }
      }

      if (isRunning) {
        timeoutId = setTimeout(runInferenceCycle, effectiveCooldown);
      }
    };

    timeoutId = setTimeout(runInferenceCycle, 200);

    return () => {
      isRunning = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [cameraActive, confidenceThreshold, inferenceIntervalMs]);

  return {
    videoRef,
    isLoadingModel,
    modelError,
    cameraActive,
    cameraError,
    availableDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    fps,
    detectionsRef,
    startCamera,
    stopCamera,
    refreshDevices,
  };
}
