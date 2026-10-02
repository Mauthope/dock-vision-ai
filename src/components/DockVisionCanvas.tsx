'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDock } from '../context/DockContext';
import { useTruckDetection } from '../hooks/useTruckDetection';
import { Point2D, DockBox } from '../types/dock';
import {
  screenToNormalizedVideoCoord,
  normalizedToCanvasCoord,
  getVideoRenderDimensions,
  isPointInPolygon,
  createRectanglePoints,
  formatDuration
} from '../utils/boxGeometry';
import {
  Maximize2,
  Minimize2,
  Square,
  Shapes,
  Trash2,
  RefreshCw,
  Video,
  Copy,
  Sliders,
  Check,
  X,
  Move,
  Info,
  HelpCircle,
  Truck,
  Layers,
  ChevronDown,
  Zap,
  Shield,
  Gauge,
  Activity,
  Scale,
  Car,
  User,
  Bus,
  Camera
} from 'lucide-react';

export const DockVisionCanvas: React.FC = () => {
  const {
    boxes,
    cameras,
    activeCameraId,
    setActiveCameraId,
    settings,
    processDetections,
    addBox,
    updateBox,
    moveBox,
    duplicateBox,
    deleteBox,
    selectedBoxId,
    setSelectedBoxId,
    selectBoxAndCamera,
    manualToggleOccupied
  } = useDock();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCamera = cameras.find(c => c.id === activeCameraId) || cameras[0];

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawTool, setDrawTool] = useState<'rectangle' | 'polygon'>('rectangle');
  const [drawingPoints, setDrawingPoints] = useState<Point2D[]>([]);
  const [dragStartPoint, setDragStartPoint] = useState<Point2D | null>(null);
  const [mousePreviewPoint, setMousePreviewPoint] = useState<Point2D | null>(null);

  // Estados de manipulação
  const [isDraggingWholeBox, setIsDraggingWholeBox] = useState(false);
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  const [dragLastPoint, setDragLastPoint] = useState<Point2D | null>(null);

  // Refs síncronas para 60 FPS sem engasgos
  const boxesRef = useRef<DockBox[]>(boxes);
  boxesRef.current = boxes;

  const selectedBoxIdRef = useRef<string | null>(selectedBoxId);
  selectedBoxIdRef.current = selectedBoxId;

  const drawingPointsRef = useRef<Point2D[]>(drawingPoints);
  drawingPointsRef.current = drawingPoints;

  const drawToolRef = useRef<'rectangle' | 'polygon'>(drawTool);
  drawToolRef.current = drawTool;

  const drawingModeRef = useRef<boolean>(drawingMode);
  drawingModeRef.current = drawingMode;

  const mousePreviewPointRef = useRef<Point2D | null>(mousePreviewPoint);
  mousePreviewPointRef.current = mousePreviewPoint;

  // Hook IA com detecções salvas na Ref (zero re-renders)
  const {
    videoRef,
    isLoadingModel,
    cameraActive,
    cameraError,
    startCamera,
    fps,
    detectionsRef,
    liveMotionMapRef
  } = useTruckDetection({
    activeCamera,
    confidenceThreshold: settings.confidenceThreshold,
    inferenceIntervalMs: settings.inferenceIntervalMs,
    onDetections: processDetections,
    boxes,
  });

  const selectedBox = boxes.find(b => b.id === selectedBoxId);

  // Monitor em tempo real da intensidade de movimento para o painel de edição
  const [panelMotionLevel, setPanelMotionLevel] = useState<number>(0);

  useEffect(() => {
    if (!selectedBox || !selectedBox.targetClasses?.includes('motion')) return;
    const interval = setInterval(() => {
      const val = liveMotionMapRef.current?.[selectedBox.id] || 0;
      setPanelMotionLevel(val);
    }, 150);
    return () => clearInterval(interval);
  }, [selectedBox?.id, selectedBox?.targetClasses, liveMotionMapRef]);

  // Alternar tela cheia
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Helper para obter coordenadas normalizadas do mouse
  const getNormalizedPointFromEvent = useCallback((clientX: number, clientY: number): Point2D | null => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return null;

    const vWidth = video?.videoWidth || 1280;
    const vHeight = video?.videoHeight || 720;

    return screenToNormalizedVideoCoord(clientX, clientY, canvas, vWidth, vHeight);
  }, []);

  // Iniciar modo de desenho
  const startDrawing = (tool: 'rectangle' | 'polygon') => {
    setDrawTool(tool);
    setDrawingMode(true);
    setDrawingPoints([]);
    setDragStartPoint(null);
    setSelectedBoxId(null);
  };

  const cancelDrawing = () => {
    setDrawingMode(false);
    setDrawingPoints([]);
    setDragStartPoint(null);
    setMousePreviewPoint(null);
  };

  // Finalizar e salvar boxe
  const finalizeDrawnBox = (points: Point2D[]) => {
    if (points.length < 3) return;

    const count = boxes.length + 1;
    const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
    const color = colors[count % colors.length];

    const newId = addBox({
      name: `Boxe ${count}`,
      color,
      points,
      cameraId: activeCameraId,
      detectionCriteria: 'auto',
      overlapThreshold: 0.20,
      entryDebounceFrames: 2,
      exitGraceSeconds: 3.5,
      targetClasses: ['truck', 'bus', 'person'],
    });

    setDrawingMode(false);
    setDrawingPoints([]);
    setDragStartPoint(null);
    setMousePreviewPoint(null);
    setSelectedBoxId(newId);
  };

  // --- TRATAMENTO DE EVENTOS DE MOUSE E TOUCH ---

  const handlePointerDown = (clientX: number, clientY: number) => {
    const norm = getNormalizedPointFromEvent(clientX, clientY);
    if (!norm) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const vw = video?.videoWidth || 1280;
    const vh = video?.videoHeight || 720;

    // 1. MODO DE DESENHO ATIVO
    if (drawingMode) {
      if (drawTool === 'rectangle') {
        setDragStartPoint(norm);
        setDrawingPoints(createRectanglePoints(norm, norm));
      } else if (drawTool === 'polygon') {
        const nextPts = [...drawingPoints, norm];
        if (nextPts.length >= 4) {
          finalizeDrawnBox(nextPts);
        } else {
          setDrawingPoints(nextPts);
        }
      }
      return;
    }

    // 2. MODO NORMAL: TESTAR CLIQUE EM VÉRTICES OU NO INTERIOR DO BOXE

    // (A) Testar clique em vértices dos boxes (Hit radius de 25px em coordenadas de tela)
    for (const box of boxesRef.current) {
      if (box.cameraId !== activeCameraId) continue;

      for (let i = 0; i < box.points.length; i++) {
        const pt = normalizedToCanvasCoord(box.points[i], cw, ch, vw, vh);
        const mousePx = normalizedToCanvasCoord(norm, cw, ch, vw, vh);
        const dist = Math.hypot(pt.x - mousePx.x, pt.y - mousePx.y);

        if (dist <= 26) {
          setSelectedBoxId(box.id);
          setDraggingVertexIdx(i);
          setDragLastPoint(norm);
          return;
        }
      }
    }

    // (B) Testar clique dentro de algum boxe (Hit test para selecionar e mover o boxe inteiro)
    for (let b = boxesRef.current.length - 1; b >= 0; b--) {
      const box = boxesRef.current[b];
      if (box.cameraId !== activeCameraId) continue;

      if (isPointInPolygon(norm, box.points)) {
        setSelectedBoxId(box.id);
        setIsDraggingWholeBox(true);
        setDragLastPoint(norm);
        return;
      }
    }

    // Clique fora de qualquer boxe desmarca a seleção
    setSelectedBoxId(null);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    const norm = getNormalizedPointFromEvent(clientX, clientY);
    if (!norm) return;

    // Modo desenho
    if (drawingMode) {
      setMousePreviewPoint(norm);
      if (drawTool === 'rectangle' && dragStartPoint) {
        setDrawingPoints(createRectanglePoints(dragStartPoint, norm));
      }
      return;
    }

    // Arrastando vértice específico
    if (draggingVertexIdx !== null && selectedBoxId && dragLastPoint) {
      const currentBox = boxesRef.current.find(b => b.id === selectedBoxId);
      if (currentBox) {
        const updatedPoints = [...currentBox.points];
        updatedPoints[draggingVertexIdx] = norm;
        updateBox(currentBox.id, { points: updatedPoints });
      }
      return;
    }

    // Arrastando o boxe inteiro
    if (isDraggingWholeBox && selectedBoxId && dragLastPoint) {
      const dx = norm.x - dragLastPoint.x;
      const dy = norm.y - dragLastPoint.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        moveBox(selectedBoxId, dx, dy);
        setDragLastPoint(norm);
      }
    }
  };

  const handlePointerUp = () => {
    if (drawingMode && drawTool === 'rectangle' && dragStartPoint && drawingPoints.length === 4) {
      finalizeDrawnBox(drawingPoints);
    }

    setIsDraggingWholeBox(false);
    setDraggingVertexIdx(null);
    setDragLastPoint(null);
  };

  // Eventos de Mouse
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => handlePointerDown(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => handlePointerMove(e.clientX, e.clientY);
  const onMouseUp = () => handlePointerUp();

  // Eventos de Touch
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchEnd = () => handlePointerUp();

  // --- ÚNICO LOOP DE RENDERIZAÇÃO NO CANVAS (OTIMIZADO PARA MOBILE) ---
  useEffect(() => {
    let animId: number;
    let lastRenderTime = 0;
    const isMobileDevice = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const minFrameInterval = isMobileDevice ? 33 : 16; // 30 FPS no mobile evita aquecimento e lag; 60 FPS no desktop

    const renderLoop = (time: number) => {
      // Throttling de FPS para economia de GPU no celular
      if (time - lastRenderTime < minFrameInterval) {
        animId = requestAnimationFrame(renderLoop);
        return;
      }
      lastRenderTime = time;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) return;

      // Sincroniza dimensões internas do Canvas com as dimensões CSS reais do elemento
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.round(rect.width);
      const targetH = Math.round(rect.height);

      if (targetW > 0 && targetH > 0 && (canvas.width !== targetW || canvas.height !== targetH)) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const vw = video?.videoWidth || 1280;
      const vh = video?.videoHeight || 720;

      // 1. Limpa o fundo escuro
      ctx.fillStyle = '#060a13';
      ctx.fillRect(0, 0, cw, ch);

      // 2. Renderiza o frame de vídeo com proporção e letterboxing perfeitos
      if (video && video.readyState >= 2) {
        const { renderW, renderH, offsetX, offsetY } = getVideoRenderDimensions(cw, ch, vw, vh);
        ctx.drawImage(video, offsetX, offsetY, renderW, renderH);
      } else {
        // Grade cibernética sutil enquanto a câmera inicializa
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.lineWidth = 1;
        for (let x = 0; x < cw; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ch);
          ctx.stroke();
        }
        for (let y = 0; y < ch; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(cw, y);
          ctx.stroke();
        }
      }

      const curBoxes = boxesRef.current;
      const curSelectedId = selectedBoxIdRef.current;

      // 3. DESENHAR BOXES EXISTENTES
      curBoxes.forEach(box => {
        if (box.cameraId !== activeCameraId || box.points.length < 3) return;

        const isOcc = box.status === 'occupied';
        const isApp = box.status === 'approaching';
        const isSel = curSelectedId === box.id;

        const pts = box.points.map(p => normalizedToCanvasCoord(p, cw, ch, vw, vh));

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        // Preenchimento e Borda
        if (isOcc) {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 4;
          ctx.stroke();
        } else if (isApp) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.20)';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = isSel ? `${box.color}25` : `${box.color}12`;
          ctx.fill();
          ctx.strokeStyle = box.color;
          ctx.lineWidth = isSel ? 3.5 : 2;
          ctx.stroke();
        }

        // Desenhar alças dos Vértices
        pts.forEach((pt, idx) => {
          ctx.fillStyle = isSel ? '#ffffff' : '#080d1a';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isSel ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isOcc ? '#f43f5e' : box.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isSel ? 7 : 5, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Etiqueta com Nome do Boxe
        const firstPt = pts[0];
        ctx.font = 'bold 12px Outfit, sans-serif';
        const labelText = box.name;
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(8, 13, 26, 0.88)';
        ctx.beginPath();
        ctx.roundRect(firstPt.x, Math.max(16, firstPt.y - 24), textWidth + 24, 22, 6);
        ctx.fill();

        ctx.strokeStyle = isOcc ? '#f43f5e' : isSel ? '#ffffff' : box.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ponto indicador de status
        ctx.fillStyle = isOcc ? '#f43f5e' : isApp ? '#f59e0b' : '#10b981';
        ctx.beginPath();
        ctx.arc(firstPt.x + 8, Math.max(16, firstPt.y - 24) + 11, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(labelText, firstPt.x + 18, Math.max(16, firstPt.y - 24) + 15);

        // Indicador em tempo real de movimento para boxes configurados com 'motion'
        if (box.targetClasses?.includes('motion')) {
          const curMotion = liveMotionMapRef.current?.[box.id] || 0;
          const thresh = box.motionThreshold ?? 0.03;
          const isTriggered = curMotion >= thresh;
          const meterW = Math.max(124, textWidth + 24);
          const meterH = 15;
          const meterY = Math.max(16, firstPt.y - 24) + 26;

          // Fundo do medidor
          ctx.fillStyle = 'rgba(8, 13, 26, 0.92)';
          ctx.beginPath();
          ctx.roundRect(firstPt.x, meterY, meterW, meterH, 4);
          ctx.fill();

          ctx.strokeStyle = isTriggered ? '#f43f5e' : isSel ? '#eab308' : 'rgba(234, 179, 8, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Barra preenchida proporcional
          const fillRatio = Math.min(1, curMotion / (thresh * 1.5));
          const barW = Math.max(0, (meterW - 4) * fillRatio);
          if (barW > 0) {
            ctx.fillStyle = isTriggered ? '#f43f5e' : curMotion > thresh * 0.7 ? '#f59e0b' : '#06b6d4';
            ctx.beginPath();
            ctx.roundRect(firstPt.x + 2, meterY + 2, barW, meterH - 4, 2);
            ctx.fill();
          }

          // Rótulo: ⚡ atual% / limiar%
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = isTriggered ? '#fca5a5' : '#e2e8f0';
          ctx.fillText(`⚡ ${(curMotion * 100).toFixed(1)}% / ${(thresh * 100).toFixed(1)}%`, firstPt.x + 6, meterY + 11);
        }

        // Se estiver ocupado, desenhar cronômetro gigante no centro do boxe
        if (isOcc && box.currentTruck) {
          const duration = box.currentTruck.durationSeconds;
          const timeStr = formatDuration(duration);

          const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
          const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

          const boxW = 150;
          const boxH = 50;

          ctx.fillStyle = 'rgba(8, 13, 26, 0.94)';
          ctx.beginPath();
          ctx.roundRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, 10);
          ctx.fill();

          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#fca5a5';
          ctx.font = 'bold 9px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('EM ATENDIMENTO', centerX, centerY - boxH / 2 + 15);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px monospace';
          ctx.fillText(timeStr, centerX, centerY + 16);
          ctx.textAlign = 'left';
        }
      });

      // 4. DESENHAR DETECÇÕES DE CAMINHÕES DA IA
      const curDetections = detectionsRef.current;
      curDetections.forEach(det => {
        const normB = det.normalizedBbox;
        const topLeft = normalizedToCanvasCoord({ x: normB[0], y: normB[1] }, cw, ch, vw, vh);
        const bottomRight = normalizedToCanvasCoord(
          { x: normB[0] + normB[2], y: normB[1] + normB[3] },
          cw,
          ch,
          vw,
          vh
        );

        const rx = topLeft.x;
        const ry = topLeft.y;
        const rw = bottomRight.x - topLeft.x;
        const rh = bottomRight.y - topLeft.y;

        const isTruck = det.class === 'truck';
        const isBus = det.class === 'bus';
        const isPerson = det.class === 'person';
        const isMotion = det.class === 'motion';
        const themeColor = isTruck ? '#06b6d4' : isBus ? '#8b5cf6' : isPerson ? '#38bdf8' : isMotion ? '#eab308' : '#f59e0b';

        // Preenchimento especial para movimento
        if (isMotion) {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.14)';
          ctx.fillRect(rx, ry, rw, rh);
        }

        // Bounding Box temática
        ctx.strokeStyle = `${themeColor}99`;
        ctx.lineWidth = 1.5;
        if (isMotion) ctx.setLineDash([6, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        if (isMotion) ctx.setLineDash([]);

        const cLen = 14;
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 3;
        // Cantos
        ctx.beginPath();
        ctx.moveTo(rx, ry + cLen);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx + cLen, ry);
        ctx.moveTo(rx + rw - cLen, ry);
        ctx.lineTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + cLen);
        ctx.moveTo(rx + rw, ry + rh - cLen);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx + rw - cLen, ry + rh);
        ctx.moveTo(rx + cLen, ry + rh);
        ctx.lineTo(rx, ry + rh);
        ctx.lineTo(rx, ry + rh - cLen);
        ctx.stroke();

        // Ponto de solo (onde as rodas ou pés tocam a vaga - oculto para movimento amplo)
        if (!isMotion) {
          const gPt = normalizedToCanvasCoord(det.groundContact, cw, ch, vw, vh);
          ctx.strokeStyle = isPerson ? '#38bdf8' : '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(gPt.x, gPt.y, isPerson ? 5 : 7, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Badge de identificacao com classe autentica
        const prefix = isPerson ? '[PESSOA] ' : isMotion ? '[MOVIMENTO] ' : isTruck ? '[CAMINHAO] ' : isBus ? '[VAN] ' : '[CARRO] ';
        const label = `${prefix}${(det.label || 'Objeto').toUpperCase()} ${(det.score * 100).toFixed(0)}%`;
        ctx.font = 'bold 11px monospace';
        const labelW = ctx.measureText(label).width + 14;

        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.roundRect(rx, Math.max(14, ry - 20), labelW, 18, 4);
        ctx.fill();

        ctx.fillStyle = (isTruck || isMotion) ? '#060a13' : '#ffffff';
        ctx.fillText(label, rx + 7, Math.max(14, ry - 20) + 13);
      });

      // 5. DESENHO INTERATIVO EM PROGRESSO
      if (drawingModeRef.current && drawingPointsRef.current.length > 0) {
        const pts = drawingPointsRef.current.map(p => normalizedToCanvasCoord(p, cw, ch, vw, vh));

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }

        if (drawToolRef.current === 'rectangle' || pts.length === 4) {
          ctx.closePath();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
          ctx.fill();
        }

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Vértices do desenho
        pts.forEach((pt, i) => {
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fill();
        });

        // Linha elástica guia até o mouse no modo polígono
        if (drawToolRef.current === 'polygon' && mousePreviewPointRef.current && pts.length < 4) {
          const lastPt = pts[pts.length - 1];
          const mPt = normalizedToCanvasCoord(mousePreviewPointRef.current, cw, ch, vw, vh);

          ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(lastPt.x, lastPt.y);
          ctx.lineTo(mPt.x, mPt.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeCameraId]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden glass-panel border border-slate-800 shadow-2xl flex flex-col ${
        isFullscreen ? 'h-screen w-screen rounded-none z-50 fixed inset-0' : 'min-h-[400px] sm:min-h-[480px] lg:min-h-[520px]'
      }`}
    >
      {/* Barra de Ferramentas Superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/85 border-b border-slate-800 backdrop-blur-md z-10">
        
        {/* Identificação da Câmera & Status da IA */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs shadow-inner">
            <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={activeCameraId}
              onChange={e => setActiveCameraId(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold text-xs border-none focus:outline-none cursor-pointer pr-1"
              title="Trocar Câmera Ativa"
            >
              {cameras.map(cam => (
                <option key={cam.id} value={cam.id} className="bg-slate-950 text-white">
                  {cam.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
            {isLoadingModel ? (
              <span className="text-amber-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Carregando IA...
              </span>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 font-bold">{fps} FPS</span>
                <span className="text-slate-500">| WebGL</span>
              </>
            )}
          </div>
        </div>

        {/* Ferramentas de Desenho e Controles */}
        <div className="flex items-center gap-2 flex-wrap">
          {!drawingMode ? (
            <>
              <button
                onClick={() => startDrawing('rectangle')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700/60 text-cyan-300 text-xs font-bold transition-all shadow-sm"
                title="Desenhar Boxe Retangular (Clique e arraste sobre a vaga)"
              >
                <Square className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Desenhar Retângulo</span>
                <span className="inline sm:hidden">+ Retângulo</span>
              </button>

              <button
                onClick={() => startDrawing('polygon')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/50 text-slate-300 hover:text-teal-300 text-xs font-medium transition-all shadow-sm"
                title="Desenhar Boxe em Perspectiva (Clique nos 4 cantos da vaga)"
              >
                <Shapes className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden sm:inline">+ Perspectiva (4 Cantos)</span>
                <span className="inline sm:hidden">+ Perspectiva</span>
              </button>

              <button
                onClick={startCamera}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-colors"
                title="Reiniciar Câmera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-colors"
                title="Tela Cheia"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-cyan-950/90 p-1.5 rounded-xl border border-cyan-500/50">
              <span className="text-xs font-bold text-cyan-300 px-2 flex items-center gap-1.5">
                {drawTool === 'rectangle'
                  ? 'Clique e arraste para criar o Boxe'
                  : `Clique nos 4 cantos da vaga (${drawingPoints.length}/4)`}
              </span>

              <button
                onClick={cancelDrawing}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Seleção Rápida de Docas: Clicar em qualquer boxe muda para a câmera responsável */}
      {boxes.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/70 border-b border-slate-800/80 overflow-x-auto custom-scrollbar z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
            <Layers className="w-3 h-3 text-cyan-400" />
            Docas:
          </span>
          {boxes.map(b => {
            const isCurrentCam = b.cameraId === activeCameraId;
            const isSelected = selectedBoxId === b.id;
            const isOcc = b.status === 'occupied';
            const cam = cameras.find(c => c.id === b.cameraId);

            return (
              <button
                key={b.id}
                onClick={() => selectBoxAndCamera(b.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 border transition-all ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-950/50'
                    : isOcc
                    ? 'bg-rose-950/40 border-rose-600/50 text-rose-200 hover:border-rose-500'
                    : isCurrentCam
                    ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-cyan-600'
                    : 'bg-slate-950/80 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                title={`Clique para ir à câmera "${cam?.name || b.cameraId}" e visualizar ${b.name}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                <span className="font-bold">{b.name}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                  isCurrentCam ? 'text-cyan-300 bg-cyan-950/70 border border-cyan-800/50' : 'text-slate-500 bg-slate-900'
                }`}>
                  {cam ? cam.name.replace(/\(.*\)/, '').trim() : b.cameraId}
                </span>
                {isOcc && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Área do Vídeo e Canvas Interativo */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[340px] sm:min-h-[420px] lg:min-h-[460px] select-none">
        
        {/* Vídeo HTML5 (Alimenta a IA e o Canvas) */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-0"
          playsInline
          muted
          autoPlay
        />

        {/* Canvas de Alta Precisão */}
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="w-full h-full cursor-crosshair touch-none"
        />

        {/* PAINEL FLUTUANTE DE EDIÇÃO DO BOXE SELECIONADO */}
        {selectedBox && !drawingMode && (
          <div
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
            className="absolute top-2 sm:top-4 left-2 sm:left-4 z-20 p-3 rounded-xl bg-slate-950/95 border border-cyan-500/50 shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 w-80 sm:w-84 md:w-92 max-w-[calc(100%-1rem)] max-h-[calc(100%-1rem)] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedBox.color }} />
                Editar Boxe
              </span>
              <button
                onClick={() => setSelectedBoxId(null)}
                className="text-slate-400 hover:text-white p-0.5"
                title="Fechar Painel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Input Nome do Boxe */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold">Nome</label>
              <input
                type="text"
                value={selectedBox.name}
                onChange={e => updateBox(selectedBox.id, { name: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Seletor de Cores */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Cor:</span>
              <div className="flex gap-1.5">
                {['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'].map(c => (
                  <button
                    key={c}
                    onClick={() => updateBox(selectedBox.id, { color: c })}
                    className={`w-5 h-5 rounded-full border transition-transform ${
                      selectedBox.color === c ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Modo de Enquadramento da Câmera */}
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Enquadramento da Câmera:</span>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">
                  {selectedBox.detectionCriteria === 'close_dock' ? 'Doca Próxima' : selectedBox.detectionCriteria === 'ground' ? 'Pátio Amplo' : 'Auto Híbrido'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => updateBox(selectedBox.id, { detectionCriteria: 'auto' })}
                  className={`px-1.5 py-1.5 rounded text-[10px] font-semibold border text-center transition-colors ${
                    (selectedBox.detectionCriteria || 'auto') === 'auto'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-600 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Detecta tanto visão de doca próxima quanto visão ampla de pátio"
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => updateBox(selectedBox.id, { detectionCriteria: 'close_dock' })}
                  className={`px-1.5 py-1.5 rounded text-[10px] font-semibold border text-center transition-colors ${
                    selectedBox.detectionCriteria === 'close_dock'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Câmera próxima à doca: detecta mesmo quando a cabine fica fora do vídeo ou o caminhão corta a tela"
                >
                  Doca Próxima
                </button>
                <button
                  type="button"
                  onClick={() => updateBox(selectedBox.id, { detectionCriteria: 'ground' })}
                  className={`px-1.5 py-1.5 rounded text-[10px] font-semibold border text-center transition-colors ${
                    selectedBox.detectionCriteria === 'ground'
                      ? 'bg-purple-950 text-purple-300 border-purple-600 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Câmera ampla: exige caminhão inteiro e rodas no solo da vaga"
                >
                  Pátio Amplo
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-tight">
                {selectedBox.detectionCriteria === 'close_dock'
                  ? 'Doca Próxima: ativado quando a traseira/baú encosta na vaga, dispensando ver o caminhão inteiro.'
                  : selectedBox.detectionCriteria === 'ground'
                  ? 'Pátio Amplo: exige o caminhão inteiro e suas rodas dentro da demarcação.'
                  : 'Híbrido Inteligente: ideal para qualquer distância, detecta atracamento em doca ou estacionamento completo.'}
              </p>
            </div>

            {/* Sensibilidade / Cobertura Mínima da Vaga */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Sensibilidade (Cobertura da Vaga):</span>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">
                  {Math.round((selectedBox.overlapThreshold ?? 0.20) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={Math.round((selectedBox.overlapThreshold ?? 0.20) * 100)}
                onChange={e => updateBox(selectedBox.id, { overlapThreshold: Number(e.target.value) / 100 })}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[9px] text-slate-400">
                Quanto da vaga desenhada precisa ser coberta pelo veículo para disparar (padrão: 20%).
              </span>
            </div>

            {/* Câmera Responsável pelo Boxe */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-800">
              <label className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between">
                <span>Câmera Responsável:</span>
                <span className="text-[9px] text-cyan-400 font-mono">Associação</span>
              </label>
              <select
                value={selectedBox.cameraId}
                onChange={e => {
                  const newCamId = e.target.value;
                  updateBox(selectedBox.id, { cameraId: newCamId });
                  setActiveCameraId(newCamId);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id} className="bg-slate-950 text-white">
                    {cam.name}
                  </option>
                ))}
              </select>
              <span className="text-[9px] text-slate-500">
                Ao clicar neste boxe, o app mudará automaticamente para esta câmera.
              </span>
            </div>

            {/* O que detectar neste Boxe (Checkboxes) */}
            <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">O que detectar nesta doca:</span>
                <span className="text-[9px] text-cyan-400 font-mono">
                  {(selectedBox.targetClasses || ['truck', 'bus', 'person']).length} selecionado(s)
                </span>
              </div>

              <div className="flex flex-col gap-1.5 bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                {[
                  { id: 'truck', label: 'Caminhão', icon: Truck, iconColor: 'text-cyan-400', desc: 'Carretas, baús, trucks e semirreboques' },
                  { id: 'bus', label: 'Ônibus / Van', icon: Bus, iconColor: 'text-teal-400', desc: 'Vans de carga e furgões de entrega' },
                  { id: 'car', label: 'Carro Comum', icon: Car, iconColor: 'text-purple-400', desc: 'Veículos leves e utilitários (VUCs)' },
                  { id: 'person', label: 'Pessoa / Pedestre', icon: User, iconColor: 'text-sky-400', desc: 'Conferentes, motoristas ou pedestres' },
                  { id: 'motion', label: 'Qualquer Movimento', icon: Activity, iconColor: 'text-amber-400', desc: 'Portas abrindo, empilhadeiras, pallets, etc.' },
                ].map(item => {
                  const current = selectedBox.targetClasses || ['truck', 'bus', 'person'];
                  const isChecked = current.includes(item.id);
                  const IconComp = item.icon;

                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-2.5 p-1.5 rounded-lg cursor-pointer transition-colors ${
                        isChecked ? 'bg-cyan-950/40 text-slate-200 border border-cyan-800/40' : 'hover:bg-slate-800/50 text-slate-400 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const next = isChecked
                            ? current.filter(c => c !== item.id)
                            : [...current, item.id];
                          if (next.length > 0) {
                            updateBox(selectedBox.id, { targetClasses: next });
                          }
                        }}
                        className="mt-0.5 w-3.5 h-3.5 rounded border-slate-700 bg-slate-850 text-cyan-500 focus:ring-0 focus:ring-offset-0 accent-cyan-500 cursor-pointer shrink-0"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-200">
                          <IconComp className={`w-3.5 h-3.5 ${item.iconColor}`} />
                          <span>{item.label}</span>
                        </span>
                        <span className="text-[9px] text-slate-500 leading-tight">{item.desc}</span>
                      </div>
                    </label>
                  );
                })}

                {/* Parâmetros Específicos para Detecção de Movimento */}
                {(selectedBox.targetClasses || []).includes('motion') && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/40 flex flex-col gap-2.5">
                    {/* Cabeçalho do Bloco de Movimento */}
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                      <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Calibração de Movimento
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300 font-bold">
                        {(panelMotionLevel * 100).toFixed(1)}% ao vivo
                      </span>
                    </div>

                    {/* Medidor de Movimento ao Vivo com Barra Dinâmica */}
                    <div className="flex flex-col gap-1 bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-cyan-400" />
                          Atividade na Vaga:
                        </span>
                        <span className={`font-mono font-bold ${
                          panelMotionLevel >= (selectedBox.motionThreshold ?? 0.03)
                            ? 'text-rose-400 animate-pulse'
                            : panelMotionLevel >= (selectedBox.motionThreshold ?? 0.03) * 0.7
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}>
                          {panelMotionLevel >= (selectedBox.motionThreshold ?? 0.03)
                            ? 'Disparando'
                            : panelMotionLevel >= (selectedBox.motionThreshold ?? 0.03) * 0.7
                            ? 'Variação Leve'
                            : 'Estável / Silencioso'}
                        </span>
                      </div>
                      
                      <div className="relative w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                        {/* Linha indicadora da Meta / Limiar */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                          style={{
                            left: `${Math.min(100, Math.max(0, ((selectedBox.motionThreshold ?? 0.03) / 0.12) * 100))}%`
                          }}
                          title={`Limiar de ativação: ${((selectedBox.motionThreshold ?? 0.03) * 100).toFixed(1)}%`}
                        />
                        {/* Barra de Progresso do Movimento Atual */}
                        <div
                          className={`h-full transition-all duration-150 rounded-full ${
                            panelMotionLevel >= (selectedBox.motionThreshold ?? 0.03)
                              ? 'bg-rose-500'
                              : panelMotionLevel >= (selectedBox.motionThreshold ?? 0.03) * 0.7
                              ? 'bg-amber-400'
                              : 'bg-cyan-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(0, (panelMotionLevel / 0.12) * 100))}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                        <span>0%</span>
                        <span className="text-amber-400 font-semibold">
                          Meta: {((selectedBox.motionThreshold ?? 0.03) * 100).toFixed(1)}%
                        </span>
                        <span>12%</span>
                      </div>
                    </div>

                    {/* Presets Rápidos */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Presets Rápidos:</span>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => updateBox(selectedBox.id, {
                            motionThreshold: 0.015,
                            motionDiffThreshold: 18,
                            motionDebounceFrames: 1
                          })}
                          className={`px-1.5 py-1.5 rounded text-[9px] font-bold border transition-colors flex flex-col items-center gap-0.5 ${
                            (selectedBox.motionThreshold ?? 0.03) <= 0.018 && (selectedBox.motionDebounceFrames ?? 2) === 1
                              ? 'bg-amber-950 text-amber-200 border-amber-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                          title="Dispara rápido com qualquer pequeno movimento (1.5% da vaga, 1 frame)"
                        >
                          <span className="flex items-center gap-0.5"><Zap className="w-3 h-3 text-amber-400" /> Alta</span>
                          <span className="text-[8px] font-normal opacity-80">1.5% | 1 frame</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateBox(selectedBox.id, {
                            motionThreshold: 0.030,
                            motionDiffThreshold: 24,
                            motionDebounceFrames: 2
                          })}
                          className={`px-1.5 py-1.5 rounded text-[9px] font-bold border transition-colors flex flex-col items-center gap-0.5 ${
                            (selectedBox.motionThreshold ?? 0.03) > 0.018 && (selectedBox.motionThreshold ?? 0.03) <= 0.045
                              ? 'bg-amber-950 text-amber-200 border-amber-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                          title="Equilibrado para docas de carga. Filtra ruídos de sensor (3.0% da vaga, 2 frames)"
                        >
                          <span className="flex items-center gap-0.5"><Scale className="w-3 h-3 text-cyan-400" /> Padrão</span>
                          <span className="text-[8px] font-normal opacity-80">3.0% | 2 frames</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateBox(selectedBox.id, {
                            motionThreshold: 0.060,
                            motionDiffThreshold: 35,
                            motionDebounceFrames: 2
                          })}
                          className={`px-1.5 py-1.5 rounded text-[9px] font-bold border transition-colors flex flex-col items-center gap-0.5 ${
                            (selectedBox.motionThreshold ?? 0.03) > 0.045
                              ? 'bg-amber-950 text-amber-200 border-amber-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                          title="Anti-ruído para áreas abertas, vento, sol e sombra (6.0% da vaga)"
                        >
                          <span className="flex items-center gap-0.5"><Shield className="w-3 h-3 text-emerald-400" /> Anti-Ruído</span>
                          <span className="text-[8px] font-normal opacity-80">6.0% | Rígido</span>
                        </button>
                      </div>
                    </div>

                    {/* Parâmetro 1: Área Mínima de Movimento (% da vaga) */}
                    <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-cyan-400" />
                          Área Mínima de Movimento:
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono font-bold">
                          {((selectedBox.motionThreshold ?? 0.03) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={Math.round((selectedBox.motionThreshold ?? 0.03) * 1000)}
                        onChange={e => updateBox(selectedBox.id, { motionThreshold: Number(e.target.value) / 1000 })}
                        className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                      <span className="text-[8.5px] text-slate-400 leading-tight">
                        Quanto da vaga desenhada precisa mudar visualmente para disparar (1% a 10%).
                      </span>
                    </div>

                    {/* Parâmetro 2: Filtro de Luz e Ruído de Sensor (motionDiffThreshold) */}
                    <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          Filtro de Ruído Luminoso:
                        </span>
                        <span className="text-[9px] text-cyan-300 font-mono font-semibold">
                          {(selectedBox.motionDiffThreshold ?? 24) <= 20
                            ? 'Sensível (18)'
                            : (selectedBox.motionDiffThreshold ?? 24) <= 28
                            ? 'Equilibrado (24)'
                            : 'Forte (35)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { val: 18, label: 'Sensível', desc: 'Luz fraca' },
                          { val: 24, label: 'Normal', desc: 'Filtra sensor' },
                          { val: 35, label: 'Forte', desc: 'Sol & trepidação' },
                        ].map(f => {
                          const isSelDiff = (selectedBox.motionDiffThreshold ?? 24) === f.val;
                          return (
                            <button
                              key={f.val}
                              type="button"
                              onClick={() => updateBox(selectedBox.id, { motionDiffThreshold: f.val })}
                              className={`px-1 py-1 rounded text-[9px] font-semibold border transition-colors ${
                                isSelDiff
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              <div>{f.label}</div>
                              <div className="text-[7.5px] opacity-75">{f.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Parâmetro 3: Velocidade de Confirmação (Debounce de Disparo) */}
                    <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          Velocidade de Disparo:
                        </span>
                        <span className="text-[9px] text-amber-300 font-mono font-semibold">
                          {(selectedBox.motionDebounceFrames ?? 2) === 1
                            ? '1 frame (Instantâneo)'
                            : (selectedBox.motionDebounceFrames ?? 2) === 2
                            ? '2 frames (Confirmado)'
                            : '3 frames (Estável)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { frames: 1, label: 'Instantâneo', desc: '1 frame (~300ms)' },
                          { frames: 2, label: 'Confirmado', desc: '2 frames (Padrão)' },
                          { frames: 3, label: 'Suave', desc: '3 frames (~1s)' },
                        ].map(opt => {
                          const isSelFrames = (selectedBox.motionDebounceFrames ?? 2) === opt.frames;
                          return (
                            <button
                              key={opt.frames}
                              type="button"
                              onClick={() => updateBox(selectedBox.id, { motionDebounceFrames: opt.frames })}
                              className={`px-1 py-1 rounded text-[9px] font-semibold border transition-colors ${
                                isSelFrames
                                  ? 'bg-amber-950 text-amber-200 border-amber-500 shadow-sm'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              <div>{opt.label}</div>
                              <div className="text-[7.5px] opacity-75">{opt.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Parâmetro 4: Tempo de Saída / Liberação (exitGraceSeconds) */}
                    <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300 font-semibold">
                          Liberação após Parada:
                        </span>
                        <span className="text-[10px] text-cyan-400 font-mono font-bold">
                          {selectedBox.exitGraceSeconds ?? 3.5}s
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[2, 3.5, 5, 8].map(sec => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => updateBox(selectedBox.id, { exitGraceSeconds: sec })}
                            className={`px-1 py-1 rounded text-[9px] font-bold border transition-colors ${
                              (selectedBox.exitGraceSeconds ?? 3.5) === sec
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-sm'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                      <span className="text-[8.5px] text-slate-500 leading-tight">
                        Tempo de silêncio para registrar fim de atendimento e liberar o boxe.
                      </span>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* Instruções de Arraste */}
            <div className="text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Arraste o interior para mover o boxe ou arraste os cantos brancos.</span>
            </div>

            {/* Ações: Duplicar e Excluir */}
            <div className="flex gap-2 pt-1 border-t border-slate-800">
              <button
                onClick={() => duplicateBox(selectedBox.id)}
                className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 transition-colors"
                title="Duplicar este Boxe"
              >
                <Copy className="w-3 h-3" />
                <span>Duplicar</span>
              </button>

              <button
                onClick={() => {
                  if (confirm(`Excluir ${selectedBox.name}?`)) deleteBox(selectedBox.id);
                }}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                title="Excluir Boxe"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dica ao desenhar */}
        {drawingMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-slate-950/90 border border-cyan-500/60 text-cyan-300 text-xs shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>
              {drawTool === 'rectangle'
                ? 'Clique no primeiro canto e arraste até o canto oposto da vaga.'
                : 'Clique nos 4 cantos da vaga no pátio. O boxe fechará automaticamente.'}
            </span>
          </div>
        )}
      </div>

      {/* Barra Inferior com Lista de Docas e Atalhos */}
      <div className="p-3 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Docas:
          </span>

          {boxes.map(box => (
            <button
              key={box.id}
              onClick={() => setSelectedBoxId(box.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                selectedBoxId === box.id
                  ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-lg shadow-cyan-950/40'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: box.color }} />
              <span>{box.name}</span>
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5 text-cyan-400" />
          <span>Clique em qualquer boxe para mover, editar ou redimensionar</span>
        </div>
      </div>

    </div>
  );
};
