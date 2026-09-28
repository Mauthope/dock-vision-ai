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
  Truck
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
    detectionsRef
  } = useTruckDetection({
    activeCamera,
    confidenceThreshold: settings.confidenceThreshold,
    inferenceIntervalMs: settings.inferenceIntervalMs,
    onDetections: processDetections,
  });

  const selectedBox = boxes.find(b => b.id === selectedBoxId);

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
      detectionCriteria: 'ground',
      overlapThreshold: 0.25,
      entryDebounceFrames: 3,
      exitGraceSeconds: 3.5,
      targetClasses: ['truck'],
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

  // --- ÚNICO LOOP DE RENDERIZAÇÃO NO CANVAS (60 FPS SUAVES) ---
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
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

        // Bounding Box Ciano com cantos cibernéticos
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);

        const cLen = 14;
        ctx.strokeStyle = '#06b6d4';
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

        // Ponto de solo (onde as rodas tocam a vaga)
        const gPt = normalizedToCanvasCoord(det.groundContact, cw, ch, vw, vh);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gPt.x, gPt.y, 7, 0, Math.PI * 2);
        ctx.stroke();

        // Badge de identificação
        const label = `${det.class.toUpperCase()} ${(det.score * 100).toFixed(0)}%`;
        ctx.font = 'bold 11px monospace';
        const labelW = ctx.measureText(label).width + 14;

        ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
        ctx.beginPath();
        ctx.roundRect(rx, Math.max(14, ry - 20), labelW, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#060a13';
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
        isFullscreen ? 'h-screen w-screen rounded-none z-50 fixed inset-0' : 'min-h-[520px]'
      }`}
    >
      {/* Barra de Ferramentas Superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/85 border-b border-slate-800 backdrop-blur-md z-10">
        
        {/* Identificação da Câmera & Status da IA */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-200">{activeCamera.name}</span>
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700/60 text-cyan-300 text-xs font-bold transition-all shadow-sm"
                title="Desenhar Boxe Retangular (Clique e arraste sobre a vaga)"
              >
                <Square className="w-3.5 h-3.5" />
                <span>+ Desenhar Retângulo</span>
              </button>

              <button
                onClick={() => startDrawing('polygon')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/50 text-slate-300 hover:text-teal-300 text-xs font-medium transition-all shadow-sm"
                title="Desenhar Boxe em Perspectiva (Clique nos 4 cantos da vaga)"
              >
                <Shapes className="w-3.5 h-3.5 text-teal-400" />
                <span>+ Perspectiva (4 Cantos)</span>
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

      {/* Área do Vídeo e Canvas Interativo */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[460px] select-none">
        
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
          <div className="absolute top-4 left-4 z-20 p-3 rounded-xl bg-slate-950/95 border border-cyan-500/50 shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 min-w-[240px] animate-in fade-in zoom-in-95 duration-150">
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
