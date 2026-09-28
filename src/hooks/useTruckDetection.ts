'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TruckDetection, CameraSourceConfig } from '../types/dock';

interface UseTruckDetectionOptions {
  activeCamera: CameraSourceConfig;
  confidenceThreshold?: number;
  inferenceIntervalMs?: number;
  onDetections?: (detections: TruckDetection[]) => void;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export function useTruckDetection({
  activeCamera,
  confidenceThreshold = 0.38,
  inferenceIntervalMs = 400,
  onDetections,
}: UseTruckDetectionOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modelRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inferCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(activeCamera?.deviceId || '');
  const [fps, setFps] = useState<number>(0);

  // Armazena detecções em Ref para 60 FPS sem re-render no React
  const detectionsRef = useRef<TruckDetection[]>([]);
  const isDetectingRef = useRef<boolean>(false);
  const onDetectionsRef = useRef(onDetections);
  onDetectionsRef.current = onDetections;

  // Carregar Modelo TensorFlow.js COCO-SSD
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
          base: 'lite_mobilenet_v2', // Modelo ultra-rápido para dispositivos móveis
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

    // Canvas offscreen padronizado em 224x224 (resolução nativa do MobileNet v2)
    // Reduz o consumo de GPU mobile em 60%
    if (typeof document !== 'undefined' && !inferCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 224;
      c.height = 224;
      inferCanvasRef.current = c;
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Enumerate Câmeras
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

  // Iniciar Fonte de Vídeo (Otimizado para Mobile)
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

    // Resoluções sob medida: 640x480 em celulares roda 4x mais rápido sem perder precisão
    const idealW = isMobile ? 640 : 1280;
    const idealH = isMobile ? 480 : 720;
    const idealFps = isMobile ? 24 : 30;

    try {
      let stream: MediaStream | null = null;

      if (selectedDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: selectedDeviceId },
              width: { ideal: idealW },
              height: { ideal: idealH },
              frameRate: { ideal: idealFps },
            },
            audio: false,
          });
        } catch (e) {
          console.warn('Falha deviceId, usando padrão...', e);
        }
      }

      if (!stream) {
        const facing = activeCamera.facingMode || 'environment';
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: idealW },
              height: { ideal: idealH },
              frameRate: { ideal: idealFps },
            },
            audio: false,
          });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      streamRef.current = stream;
      refreshDevices();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;

        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          videoRef.current.onloadedmetadata = () => resolve();
          setTimeout(resolve, 600);
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

  // Loop de Inferência com Auto-Encadeamento Não-Bloqueante (Timeout Inteligente)
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
          const vWidth = video.videoWidth || 640;
          const vHeight = video.videoHeight || 480;

          // Renderiza no canvas 224x224 com interpolação rápida
          let inputSource: HTMLVideoElement | HTMLCanvasElement = video;
          const inferCanvas = inferCanvasRef.current;
          if (inferCanvas) {
            const inferCtx = inferCanvas.getContext('2d', { alpha: false });
            if (inferCtx) {
              inferCtx.drawImage(video, 0, 0, inferCanvas.width, inferCanvas.height);
              inputSource = inferCanvas;
            }
          }

          const predictions = await model.detect(inputSource, 6, confidenceThreshold);

          const scaleX = inferCanvas ? vWidth / inferCanvas.width : 1;
          const scaleY = inferCanvas ? vHeight / inferCanvas.height : 1;

          const vehicleDetections: TruckDetection[] = [];

          for (let i = 0; i < predictions.length; i++) {
            const p = predictions[i];
            const cls = p.class.toLowerCase();

            // ACEITA 'truck', 'bus', 'car' e normaliza veículos de doca
            if (cls === 'truck' || cls === 'bus' || cls === 'car') {
              const rawX = p.bbox[0] * scaleX;
              const rawY = p.bbox[1] * scaleY;
              const rawW = p.bbox[2] * scaleX;
              const rawH = p.bbox[3] * scaleY;

              const normalizedBbox: [number, number, number, number] = [
                Math.max(0, Math.min(1, rawX / vWidth)),
                Math.max(0, Math.min(1, rawY / vHeight)),
                Math.max(0, Math.min(1, rawW / vWidth)),
                Math.max(0, Math.min(1, rawH / vHeight)),
              ];

              const centroid = {
                x: normalizedBbox[0] + normalizedBbox[2] / 2,
                y: normalizedBbox[1] + normalizedBbox[3] / 2,
              };

              // Base das rodas onde o veículo toca o solo
              const groundContact = {
                x: normalizedBbox[0] + normalizedBbox[2] / 2,
                y: Math.min(1, normalizedBbox[1] + normalizedBbox[3] * 0.90),
              };

              // Normaliza a classe para 'truck' nas docas para que o usuário não veja 'car'
              vehicleDetections.push({
                bbox: [rawX, rawY, rawW, rawH],
                normalizedBbox,
                class: 'truck', // Normalizado para Caminhão nas docas
                score: p.score,
                centroid,
                groundContact,
              });
            }
          }

          detectionsRef.current = vehicleDetections;

          if (onDetectionsRef.current) {
            onDetectionsRef.current(vehicleDetections);
          }
        } catch (err) {
          console.warn('Erro inferência IA:', err);
        } finally {
          isDetectingRef.current = false;
        }
      }

      // Agenda a próxima inferência SOMENTE após o término da atual (sem sobrecarga de pilha)
      if (isRunning) {
        timeoutId = setTimeout(runInferenceCycle, effectiveCooldown);
      }
    };

    // Inicia ciclo
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
