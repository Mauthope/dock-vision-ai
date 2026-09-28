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
  confidenceThreshold = 0.40,
  inferenceIntervalMs = 350,
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

  // Armazena as detecções em uma Ref para acesso síncrono a 60 FPS sem forçar re-render React
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
          base: 'lite_mobilenet_v2', // Ultra leve e otimizado
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

    // Canvas offscreen para inferência (300x200 para máxima velocidade da GPU)
    if (typeof document !== 'undefined' && !inferCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 200;
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

  // Iniciar Fonte de Vídeo
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

    try {
      let stream: MediaStream | null = null;

      if (selectedDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: selectedDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
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
              width: { ideal: 1280 },
              height: { ideal: 720 },
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
          setTimeout(resolve, 800);
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

  // Loop Exclusivo de Inferência IA (Totalmente desacoplado do Canvas)
  useEffect(() => {
    if (!cameraActive) return;

    let isRunning = true;
    let lastInferenceTime = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const inferenceTimer = setInterval(async () => {
      if (!isRunning || isDetectingRef.current) return;

      const video = videoRef.current;
      const model = modelRef.current;

      if (!model || !video || video.readyState < 2 || video.paused) return;

      const now = performance.now();
      frameCount++;
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }

      isDetectingRef.current = true;

      try {
        const vWidth = video.videoWidth || 640;
        const vHeight = video.videoHeight || 480;

        // Renderiza frame reduzido no canvas de inferência
        let inputSource: HTMLVideoElement | HTMLCanvasElement = video;
        const inferCanvas = inferCanvasRef.current;
        if (inferCanvas) {
          const inferCtx = inferCanvas.getContext('2d', { alpha: false });
          if (inferCtx) {
            inferCtx.drawImage(video, 0, 0, inferCanvas.width, inferCanvas.height);
            inputSource = inferCanvas;
          }
        }

        const predictions = await model.detect(inputSource, 8, confidenceThreshold);

        const scaleX = inferCanvas ? vWidth / inferCanvas.width : 1;
        const scaleY = inferCanvas ? vHeight / inferCanvas.height : 1;

        const vehicleDetections: TruckDetection[] = [];

        for (let i = 0; i < predictions.length; i++) {
          const p = predictions[i];
          const cls = p.class.toLowerCase();

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

            const groundContact = {
              x: normalizedBbox[0] + normalizedBbox[2] / 2,
              y: Math.min(1, normalizedBbox[1] + normalizedBbox[3] * 0.90),
            };

            vehicleDetections.push({
              bbox: [rawX, rawY, rawW, rawH],
              normalizedBbox,
              class: cls,
              score: p.score,
              centroid,
              groundContact,
            });
          }
        }

        // Salva na Ref sem disparar re-render no React
        detectionsRef.current = vehicleDetections;

        if (onDetectionsRef.current) {
          onDetectionsRef.current(vehicleDetections);
        }
      } catch (err) {
        console.warn('Erro na inferência:', err);
      } finally {
        isDetectingRef.current = false;
      }
    }, inferenceIntervalMs);

    return () => {
      isRunning = false;
      clearInterval(inferenceTimer);
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
