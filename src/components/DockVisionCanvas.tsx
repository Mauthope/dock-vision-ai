'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDock } from '../context/DockContext';
import { useTruckDetection } from '../hooks/useTruckDetection';
import {
  Point2D,
  DockBox,
  TruckDetection
} from '../types/dock';
import {
  normalizePoint,
  denormalizePoint,
  createRectanglePoints,
  formatDuration
} from '../utils/boxGeometry';
import {
  Maximize2,
  Minimize2,
  PenTool,
  Square,
  Shapes,
  Trash2,
  Check,
  X,
  Camera,
  RefreshCw,
  Video,
  Info,
  Sparkles
} from 'lucide-react';

interface DockVisionCanvasProps {
  onEditBox?: (box: DockBox) => void;
}

export const DockVisionCanvas: React.FC<DockVisionCanvasProps> = ({ onEditBox }) => {
  const {
    boxes,
    cameras,
    activeCameraId,
    setActiveCameraId,
    settings,
    processDetections,
    addBox,
    updateBox,
    deleteBox,
    manualToggleOccupied
  } = useDock();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCamera = cameras.find(c => c.id === activeCameraId) || cameras[0];

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawTool, setDrawTool] = useState<'rectangle' | 'polygon'>('rectangle');
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([]);
  const [dragStartPoint, setDragStartPoint] = useState<Point2D | null>(null);
  const [activeBoxName, setActiveBoxName] = useState<string>('Novo Boxe');
  const [activeBoxColor, setActiveBoxColor] = useState<string>('#06b6d4');
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Dragging vertex state for fine calibration
  const [draggingVertex, setDraggingVertex] = useState<{ boxId: string; pointIdx: number } | null>(null);

  // Hook de detecção com TensorFlow.js COCO-SSD
  const {
    videoRef,
    isLoadingModel,
    modelError,
    cameraActive,
    cameraError,
    startCamera,
    fps,
    currentDetections,
    refreshDevices,
    availableDevices,
    selectedDeviceId,
    setSelectedDeviceId
  } = useTruckDetection({
    activeCamera,
    confidenceThreshold: settings.confidenceThreshold,
    inferenceIntervalMs: settings.inferenceIntervalMs,
    onDetections: processDetections,
  });

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

  // Helper para obter coordenadas do ponteiro normalizadas (0.0 a 1.0)
  const getNormalizedPointerPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clientX / rect.width));
    const normY = Math.max(0, Math.min(1, clientY / rect.height));
    return { x: normX, y: normY };
  }, []);

  // Iniciar desenho de novo boxe
  const startDrawing = (tool: 'rectangle' | 'polygon') => {
    setDrawTool(tool);
    setDrawingMode(true);
    setCurrentPoints([]);
    setDragStartPoint(null);
    const nextNumber = boxes.length + 1;
    setActiveBoxName(`Boxe ${nextNumber}`);
    const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
    setActiveBoxColor(colors[nextNumber % colors.length]);
  };

  // Cancelar desenho
  const cancelDrawing = () => {
    setDrawingMode(false);
    setCurrentPoints([]);
    setDragStartPoint(null);
  };

  // Concluir e salvar novo boxe desenhado
  const finishDrawing = () => {
    if (currentPoints.length < 3) {
      alert('Desenhe pelo menos 3 pontos para criar o boxe.');
      return;
    }

    addBox({
      name: activeBoxName || `Boxe ${boxes.length + 1}`,
      color: activeBoxColor,
      points: currentPoints,
      cameraId: activeCameraId,
      detectionCriteria: 'ground',
      overlapThreshold: 0.25,
      entryDebounceFrames: 3,
      exitGraceSeconds: 3.5,
      targetClasses: ['truck'],
    });

    setDrawingMode(false);
    setCurrentPoints([]);
    setDragStartPoint(null);
  };

  // Mouse Down no Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const norm = getNormalizedPointerPos(e);
    if (!norm) return;

    if (drawingMode) {
      if (drawTool === 'rectangle') {
        setDragStartPoint(norm);
        setCurrentPoints(createRectanglePoints(norm, norm));
      } else if (drawTool === 'polygon') {
        if (currentPoints.length < 4) {
          const updated = [...currentPoints, norm];
          setCurrentPoints(updated);
          if (updated.length === 4) {
            // Completa os 4 pontos de perspectiva
            setCurrentPoints(updated);
          }
        }
      }
      return;
    }

    // Modo normal: verificar se clicou em algum vértice de boxe para ajuste fino
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.width;
    const ch = canvas.height;

    for (const box of boxes) {
      if (box.cameraId !== activeCameraId) continue;
      for (let i = 0; i < box.points.length; i++) {
        const pt = denormalizePoint(box.points[i], cw, ch);
        const clickPx = denormalizePoint(norm, cw, ch);
        const dist = Math.hypot(pt.x - clickPx.x, pt.y - clickPx.y);
        if (dist <= 15) { // Raio de toque em pixels
          setDraggingVertex({ boxId: box.id, pointIdx: i });
          setSelectedBoxId(box.id);
          return;
        }
      }
    }
  };

  // Mouse Move no Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const norm = getNormalizedPointerPos(e);
    if (!norm) return;

    if (drawingMode) {
      if (drawTool === 'rectangle' && dragStartPoint) {
        setCurrentPoints(createRectanglePoints(dragStartPoint, norm));
      }
      return;
    }

    // Ajuste de vértice existente
    if (draggingVertex) {
      const box = boxes.find(b => b.id === draggingVertex.boxId);
      if (box) {
        const updatedPoints = [...box.points];
        updatedPoints[draggingVertex.pointIdx] = norm;
        updateBox(box.id, { points: updatedPoints });
      }
    }
  };

  // Mouse Up no Canvas
  const handleCanvasMouseUp = () => {
    if (drawingMode && drawTool === 'rectangle' && dragStartPoint) {
      setDragStartPoint(null);
    }
    if (draggingVertex) {
      setDraggingVertex(null);
    }
  };

  // Render Loop do Canvas de Visualização & HUD Sci-Fi
  useEffect(() => {
    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;

      // Se temos vídeo ativo, desenha o frame
      if (video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, cw, ch);
      } else {
        // Fundo escuro industrial estilizado caso a câmera esteja inicializando
        ctx.fillStyle = '#060a13';
        ctx.fillRect(0, 0, cw, ch);

        // Grade cibernética sutil
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = 0; x < cw; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ch);
          ctx.stroke();
        }
        for (let y = 0; y < ch; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(cw, y);
          ctx.stroke();
        }
      }

      // 1. DESENHAR OS BOXES CADASTRADOS
      boxes.forEach(box => {
        if (box.cameraId !== activeCameraId || box.points.length < 3) return;

        const isOcc = box.status === 'occupied';
        const isApp = box.status === 'approaching';
        const isSel = selectedBoxId === box.id;

        const pts = box.points.map(p => denormalizePoint(p, cw, ch));

        // Caminho do polígono
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        // Estilos de preenchimento dinâmicos
        if (isOcc) {
          // Boxe Ocupado: Glow vibrante vermelho / neon pulsante
          const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[2]?.x || pts[0].x, pts[2]?.y || pts[0].y);
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
          grad.addColorStop(1, 'rgba(244, 63, 94, 0.18)');
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 18;
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset shadow
        } else if (isApp) {
          // Aproximação: Âmbar/Laranja
          ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Boxe Livre: Estilo normal com a cor do boxe
          ctx.fillStyle = `${box.color}15`; // ~8% opacity
          ctx.fill();
          ctx.strokeStyle = box.color;
          ctx.lineWidth = isSel ? 3 : 2;
          ctx.stroke();
        }

        // Desenhar vértices de calibração interativa
        pts.forEach((pt, idx) => {
          ctx.fillStyle = '#060a13';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isOcc ? '#f43f5e' : box.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.stroke();

          // Ponto central branco
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });

        // Tag Superior com Nome do Boxe
        const firstPt = pts[0];
        const tagText = box.name;
        ctx.font = 'bold 13px Outfit, sans-serif';
        const textWidth = ctx.measureText(tagText).width;

        ctx.fillStyle = 'rgba(6, 10, 19, 0.9)';
        ctx.beginPath();
        ctx.roundRect(firstPt.x, Math.max(18, firstPt.y - 24), textWidth + 24, 22, 6);
        ctx.fill();

        ctx.strokeStyle = isOcc ? '#f43f5e' : box.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Bolinha de status na tag
        ctx.fillStyle = isOcc ? '#f43f5e' : isApp ? '#f59e0b' : '#10b981';
        ctx.beginPath();
        ctx.arc(firstPt.x + 8, Math.max(18, firstPt.y - 24) + 11, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(tagText, firstPt.x + 18, Math.max(18, firstPt.y - 24) + 15);

        // Se estiver ocupado, desenha CRONÔMETRO GIGANTE centralizado no boxe!
        if (isOcc && box.currentTruck) {
          const duration = box.currentTruck.durationSeconds;
          const timeStr = formatDuration(duration);

          // Centro aproximado do boxe
          const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
          const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

          // Box do Cronômetro
          const timerBoxW = 160;
          const timerBoxH = 54;
          ctx.fillStyle = 'rgba(8, 13, 26, 0.94)';
          ctx.beginPath();
          ctx.roundRect(centerX - timerBoxW / 2, centerY - timerBoxH / 2, timerBoxW, timerBoxH, 12);
          ctx.fill();

          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Label "TEMPO EM DOCA"
          ctx.fillStyle = '#fca5a5';
          ctx.font = 'bold 10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('EM ATENDIMENTO', centerX, centerY - timerBoxH / 2 + 16);

          // Dígitos do tempo em fonte Mono gigante
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px monospace';
          ctx.fillText(timeStr, centerX, centerY + 18);
          ctx.textAlign = 'left'; // Reset
        }
      });

      // 2. DESENHAR DETECÇÕES DE CAMINHÕES DA IA
      currentDetections.forEach(det => {
        const [rx, ry, rw, rh] = det.bbox;

        // Bounding box retangular ciano com cantos cyberpunk
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);

        // Cantos cibernéticos reforçados
        const cLen = 16;
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3.5;
        // Top-Left
        ctx.beginPath();
        ctx.moveTo(rx, ry + cLen);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx + cLen, ry);
        ctx.stroke();
        // Top-Right
        ctx.beginPath();
        ctx.moveTo(rx + rw - cLen, ry);
        ctx.lineTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + cLen);
        ctx.stroke();
        // Bottom-Right
        ctx.beginPath();
        ctx.moveTo(rx + rw, ry + rh - cLen);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx + rw - cLen, ry + rh);
        ctx.stroke();
        // Bottom-Left
        ctx.beginPath();
        ctx.moveTo(rx + cLen, ry + rh);
        ctx.lineTo(rx, ry + rh);
        ctx.lineTo(rx, ry + rh - cLen);
        ctx.stroke();

        // PONTO DE CONTATO COM O SOLO (onde as rodas tocam o chão)
        // Isso mostra graficamente ao usuário por que a detecção está 100% precisa dentro do boxe!
        const gPt = denormalizePoint(det.groundContact, cw, ch);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gPt.x, gPt.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Laser cruzado no ponto de contato das rodas
        ctx.beginPath();
        ctx.moveTo(gPt.x - 12, gPt.y);
        ctx.lineTo(gPt.x + 12, gPt.y);
        ctx.moveTo(gPt.x, gPt.y - 12);
        ctx.lineTo(gPt.x, gPt.y + 12);
        ctx.stroke();

        // Badge com Classe e Confiança
        const labelText = `${det.class.toUpperCase()} ${(det.score * 100).toFixed(0)}%`;
        ctx.font = 'bold 12px monospace';
        const labelW = ctx.measureText(labelText).width + 16;
        ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
        ctx.beginPath();
        ctx.roundRect(rx, Math.max(14, ry - 22), labelW, 20, 4);
        ctx.fill();

        ctx.fillStyle = '#060a13';
        ctx.fillText(labelText, rx + 8, Math.max(14, ry - 22) + 14);
      });

      // 3. DESENHAR BOXE SENDO DESENHADO NO MOMENTO
      if (drawingMode && currentPoints.length > 0) {
        const pts = currentPoints.map(p => denormalizePoint(p, cw, ch));

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        if (drawTool === 'rectangle' || pts.length === 4) {
          ctx.closePath();
        }

        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.fill();

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

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`P${i + 1}`, pt.x + 8, pt.y - 6);
        });
      }

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [boxes, currentDetections, activeCameraId, drawingMode, currentPoints, drawTool, selectedBoxId]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden glass-panel border border-slate-800 shadow-2xl flex flex-col ${
        isFullscreen ? 'h-screen w-screen rounded-none z-50 fixed inset-0' : 'min-h-[480px]'
      }`}
    >
      {/* Barra de Ferramentas Superior do Vídeo */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/80 border-b border-slate-800 backdrop-blur-md z-10">
        
        {/* Lado Esquerdo: Identificação da Câmera & Status do Modelo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-200">{activeCamera.name}</span>
            <span className="text-[10px] text-slate-500 font-mono">({activeCamera.type})</span>
          </div>

          {/* Badge FPS & Status da IA */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
            {isLoadingModel ? (
              <span className="text-amber-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Carregando IA...
              </span>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 font-bold">{fps} FPS</span>
                <span className="text-slate-500">| COCO-SSD WebGL</span>
              </>
            )}
          </div>
        </div>

        {/* Lado Direito: Ferramentas de Desenho e Controles */}
        <div className="flex items-center gap-2 flex-wrap">
          {!drawingMode ? (
            <>
              {/* Botão Desenhar Retângulo */}
              <button
                onClick={() => startDrawing('rectangle')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-all shadow-sm"
                title="Desenhar novo Boxe Retangular (Clique e arraste)"
              >
                <Square className="w-3.5 h-3.5 text-cyan-400" />
                <span>+ Boxe Retângulo</span>
              </button>

              {/* Botão Desenhar Polígono 4 Pontos */}
              <button
                onClick={() => startDrawing('polygon')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/50 text-slate-300 hover:text-teal-300 text-xs font-medium transition-all shadow-sm"
                title="Desenhar Boxe em Perspectiva (Clique nos 4 cantos da vaga)"
              >
                <Shapes className="w-3.5 h-3.5 text-teal-400" />
                <span>+ Perspectiva (4 Pontos)</span>
              </button>

              {/* Alternar Câmera / Recarregar */}
              <button
                onClick={startCamera}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-colors"
                title="Reiniciar Stream da Câmera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {/* Alternar Tela Cheia */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-colors"
                title="Alternar Tela Cheia"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            /* Modo Ativo de Desenho */
            <div className="flex items-center gap-2 bg-cyan-950/80 p-1 rounded-xl border border-cyan-500/40">
              <span className="text-xs font-semibold text-cyan-300 px-2 flex items-center gap-1">
                <PenTool className="w-3.5 h-3.5 animate-pulse" />
                {drawTool === 'rectangle' ? 'Arraste na tela para desenhar o Boxe' : `Clique nos 4 cantos da vaga (${currentPoints.length}/4)`}
              </span>

              {/* Nome do Boxe Input Rápido */}
              <input
                type="text"
                value={activeBoxName}
                onChange={e => setActiveBoxName(e.target.value)}
                placeholder="Nome do Boxe"
                className="px-2 py-1 rounded bg-slate-900 border border-cyan-800/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-28"
              />

              {/* Botão Concluir */}
              <button
                onClick={finishDrawing}
                disabled={currentPoints.length < 3}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold text-xs shadow transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar Boxe</span>
              </button>

              {/* Botão Cancelar */}
              <button
                onClick={cancelDrawing}
                className="p-1 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Área de Visualização com Vídeo e Canvas Sobrepostos */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[440px] select-none">
        
        {/* Elemento de Vídeo HTML5 (Alimenta o WebGL e Canvas) */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-0"
          playsInline
          muted
          autoPlay
        />

        {/* Canvas Interativo de Alta Resolução */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className={`w-full h-full object-contain cursor-crosshair transition-opacity duration-300 ${
            cameraActive ? 'opacity-100' : 'opacity-80'
          }`}
        />

        {/* Notificações e Avisos de Erro de Câmera */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/90 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-lg">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Acesso à Câmera Bloqueado</h3>
            <p className="text-sm text-slate-400 max-w-md mb-4">{cameraError}</p>
            <div className="flex gap-2">
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => {
                  const sampleCam = cameras.find(c => c.type === 'sample_video');
                  if (sampleCam) setActiveCameraId(sampleCam.id);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                Usar Simulação de Vídeo
              </button>
            </div>
          </div>
        )}

        {/* Dica de Orientação ao Desenhar */}
        {drawingMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-slate-950/90 border border-cyan-500/50 text-cyan-300 text-xs shadow-xl backdrop-blur-md flex items-center gap-2 pointer-events-none animate-bounce">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>
              {drawTool === 'rectangle'
                ? 'Clique no canto superior e arraste até o canto inferior da vaga no chão.'
                : 'Clique nos 4 cantos da vaga no pátio para compensar o ângulo da câmera.'}
            </span>
          </div>
        )}
      </div>

      {/* Barra Inferior com Lista Rápida de Boxes e Ações */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Docas Configuradas:
          </span>

          {boxes.map(box => (
            <div
              key={box.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
                selectedBoxId === box.id
                  ? 'bg-slate-800 border-cyan-500/60 text-white'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: box.color }} />
              <span className="font-medium">{box.name}</span>

              {/* Botão de teste manual de ocupação */}
              <button
                onClick={() => manualToggleOccupied(box.id)}
                title={box.status === 'occupied' ? 'Liberar boxe manualmente' : 'Simular entrada manual'}
                className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                {box.status === 'occupied' ? 'Liberar' : 'Simular'}
              </button>

              {/* Botão de Excluir Boxe */}
              <button
                onClick={() => {
                  if (confirm(`Remover "${box.name}"?`)) deleteBox(box.id);
                }}
                className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                title="Excluir este Boxe"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {boxes.length === 0 && (
            <span className="text-xs text-slate-500 italic">
              Nenhum boxe desenhado. Clique em "+ Boxe Retângulo" acima para criar.
            </span>
          )}
        </div>

        {/* Dica de Calibração */}
        <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Arraste os círculos brancos para ajustar os cantos da vaga em tempo real</span>
        </div>
      </div>

    </div>
  );
};
