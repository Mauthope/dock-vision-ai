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
import { Info, Move } from 'lucide-react';
import { DockCanvasToolbar } from './dock-canvas/dock-canvas-toolbar';
import { DockQuickSelector } from './dock-canvas/dock-quick-selector';
import { DockBoxInspector } from './dock-canvas/dock-box-inspector';

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
      {/* Barra de Ferramentas Superior Modular */}
      <DockCanvasToolbar
        cameras={cameras}
        activeCameraId={activeCameraId}
        onCameraChange={setActiveCameraId}
        isLoadingModel={isLoadingModel}
        fps={fps}
        drawingMode={drawingMode}
        drawTool={drawTool}
        drawingPointsCount={drawingPoints.length}
        isFullscreen={isFullscreen}
        onStartDrawing={startDrawing}
        onCancelDrawing={cancelDrawing}
        onRestartCamera={startCamera}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Barra de Selecao Rapida de Docas Modular */}
      <DockQuickSelector
        boxes={boxes}
        activeCameraId={activeCameraId}
        selectedBoxId={selectedBoxId}
        cameras={cameras}
        onSelectBoxAndCamera={selectBoxAndCamera}
      />

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

        {/* Painel Flutuante Modular de Inspecao do Boxe Selecionado */}
        {selectedBox && !drawingMode && (
          <DockBoxInspector
            selectedBox={selectedBox}
            cameras={cameras}
            panelMotionLevel={panelMotionLevel}
            onClose={() => setSelectedBoxId(null)}
            onUpdateBox={updateBox}
            onDuplicateBox={duplicateBox}
            onDeleteBox={deleteBox}
            onSetActiveCameraId={setActiveCameraId}
          />
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
