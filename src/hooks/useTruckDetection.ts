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
  inferenceIntervalMs = 250,
  onDetections,
}: UseTruckDetectionOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
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
  const [currentDetections, setCurrentDetections] = useState<TruckDetection[]>([]);

  const isDetectingRef = useRef<boolean>(false);
  const lastDetectionsRef = useRef<TruckDetection[]>([]);
  const onDetectionsRef = useRef(onDetections);
  onDetectionsRef.current = onDetections;

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
            console.warn('WebGL fallback to default backend:', tf.getBackend());
          }
        }

        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2', // Ultra rápido para detecção em tempo real sem sobrecarregar a CPU
        });

        if (isMounted) {
          modelRef.current = loadedModel;
          setIsLoadingModel(false);
        }
      } catch (err: any) {
        console.error('Erro ao carregar modelo COCO-SSD:', err);
        if (isMounted) {
          setModelError(err?.message || 'Falha ao inicializar o motor de inteligência artificial.');
          setIsLoadingModel(false);
        }
      }
    }

    loadModel();

    // Canvas offscreen downscaled para inferência ultra rápida (320x240)
    if (typeof document !== 'undefined' && !inferCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      inferCanvasRef.current = c;
    }

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
      console.warn('Erro ao enumerar dispositivos de vídeo:', err);
    }
  }, []);

  // Interrompe stream atual
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

  // Iniciar Fonte de Vídeo (Webcam, Câmera IP ou Vídeo Sample)
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!activeCamera) return;

    if (activeCamera.type === 'sample_video' && activeCamera.sampleUrl) {
      // Fonte de vídeo de simulação
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
      // Se for uma imagem estática ou snapshot MJPEG em URL
      setCameraActive(true);
      return;
    }

    // Caso seja Webcam do aparelho
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Navegador não suporta acesso à câmera (getUserMedia).');
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
          console.warn('Falha com deviceId específico, usando padrão...', e);
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

        await videoRef.current.play().catch(playErr => {
          console.warn('Autoplay bloqueado, tentando muted:', playErr);
          if (videoRef.current) {
            videoRef.current.muted = true;
            return videoRef.current.play();
          }
        });

        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('Falha ao iniciar câmera:', err);
      let msg = 'Não foi possível acessar a câmera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão de câmera negada. Permita o acesso nas configurações do seu navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera conectada foi encontrada.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'A câmera está sendo utilizada por outro aplicativo.';
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, [activeCamera, selectedDeviceId, stopCamera, refreshDevices]);

  // Efeito para alternar câmera
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Loop de Renderização e Inferência IA
  useEffect(() => {
    if (!cameraActive) return;

    let isRunning = true;
    let lastInferenceTime = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const detectionLoop = async (time: number) => {
      if (!isRunning) return;

      const video = videoRef.current;
      const model = modelRef.current;
      const canvas = canvasRef.current;

      // Cálculo de FPS suave
      frameCount++;
      if (time - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = time;
      }

      // 1. Renderiza o frame de vídeo no canvas se disponível
      if (video && video.readyState >= 2 && canvas) {
        if (!canvasCtxRef.current || canvasCtxRef.current.canvas !== canvas) {
          canvasCtxRef.current = canvas.getContext('2d', { alpha: false });
        }
        const ctx = canvasCtxRef.current;

        if (ctx) {
          // Ajusta resolução do canvas para o aspect ratio nativo do vídeo ou 1280x720
          const vWidth = video.videoWidth || 640;
          const vHeight = video.videoHeight || 480;

          if (canvas.width !== vWidth || canvas.height !== vHeight) {
            canvas.width = vWidth;
            canvas.height = vHeight;
          }

          // Desenha frame de vídeo real
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }

      // 2. Executa Inferência Throttled do Modelo
      if (
        model &&
        video &&
        video.readyState >= 2 &&
        time - lastInferenceTime >= inferenceIntervalMs &&
        !isDetectingRef.current
      ) {
        isDetectingRef.current = true;
        lastInferenceTime = time;

        try {
          // Redimensiona para canvas offscreen para velocidade máxima de processamento
          let inputSource: HTMLVideoElement | HTMLCanvasElement = video;
          const inferCanvas = inferCanvasRef.current;
          if (inferCanvas) {
            const inferCtx = inferCanvas.getContext('2d');
            if (inferCtx) {
              inferCtx.drawImage(video, 0, 0, inferCanvas.width, inferCanvas.height);
              inputSource = inferCanvas;
            }
          }

          // Executa predição COCO-SSD
          const predictions = await model.detect(inputSource, 10, confidenceThreshold);

          // Escala de volta para as dimensões nativas do vídeo
          const vWidth = video.videoWidth || 640;
          const vHeight = video.videoHeight || 480;
          const scaleX = inferCanvas ? vWidth / inferCanvas.width : 1;
          const scaleY = inferCanvas ? vHeight / inferCanvas.height : 1;

          // Mapeia detecções com cálculos geométricos essenciais
          const vehicleDetections: TruckDetection[] = [];

          predictions.forEach((p: any) => {
            const cls = p.class.toLowerCase();
            // Aceita veículos relevantes: truck, bus, car
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

              // Ponto de contato das rodas com o solo (base inferior central)
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
          });

          lastDetectionsRef.current = vehicleDetections;
          setCurrentDetections(vehicleDetections);

          if (onDetectionsRef.current) {
            onDetectionsRef.current(vehicleDetections);
          }
        } catch (predErr) {
          console.warn('Erro na predição de caminhões:', predErr);
        } finally {
          isDetectingRef.current = false;
        }
      }

      if (isRunning) {
        requestAnimationFrame(detectionLoop);
      }
    };

    const animId = requestAnimationFrame(detectionLoop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    };
  }, [cameraActive, confidenceThreshold, inferenceIntervalMs]);

  return {
    videoRef,
    canvasRef,
    isLoadingModel,
    modelError,
    cameraActive,
    cameraError,
    availableDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    fps,
    currentDetections,
    startCamera,
    stopCamera,
    refreshDevices,
  };
}
