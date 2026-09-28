import { Point2D, DockBox, TruckDetection } from '../types/dock';

export interface VideoRenderDimensions {
  renderW: number;
  renderH: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Calcula a área de desenho real (com letterboxing proporcional) do vídeo dentro do elemento Canvas.
 * Essencial para que o clique do mouse e o desenho coincidam 100% com os pixels do vídeo!
 */
export function getVideoRenderDimensions(
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number
): VideoRenderDimensions {
  if (canvasW <= 0 || canvasH <= 0 || videoW <= 0 || videoH <= 0) {
    return { renderW: canvasW, renderH: canvasH, offsetX: 0, offsetY: 0 };
  }

  const canvasAspect = canvasW / canvasH;
  const videoAspect = videoW / videoH;

  let renderW: number;
  let renderH: number;
  let offsetX: number;
  let offsetY: number;

  if (videoAspect > canvasAspect) {
    // Barras pretas verticais (em cima/baixo)
    renderW = canvasW;
    renderH = canvasW / videoAspect;
    offsetX = 0;
    offsetY = (canvasH - renderH) / 2;
  } else {
    // Barras pretas horizontais (nas laterais)
    renderH = canvasH;
    renderW = canvasH * videoAspect;
    offsetX = (canvasW - renderW) / 2;
    offsetY = 0;
  }

  return { renderW, renderH, offsetX, offsetY };
}

/**
 * Converte coordenadas do mouse ou toque na tela (clientX, clientY)
 * para coordenadas normalizadas (0.0 a 1.0) dentro do vídeo.
 */
export function screenToNormalizedVideoCoord(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  videoW: number,
  videoH: number
): Point2D | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const rawX = clientX - rect.left;
  const rawY = clientY - rect.top;

  const dims = getVideoRenderDimensions(rect.width, rect.height, videoW, videoH);

  // Subtrai o offset de letterbox e normaliza
  const normX = (rawX - dims.offsetX) / dims.renderW;
  const normY = (rawY - dims.offsetY) / dims.renderH;

  return {
    x: Math.max(0, Math.min(1, normX)),
    y: Math.max(0, Math.min(1, normY))
  };
}

/**
 * Converte um ponto normalizado (0.0 a 1.0) para coordenadas de renderização no canvas.
 */
export function normalizedToCanvasCoord(
  point: Point2D,
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number
): Point2D {
  const dims = getVideoRenderDimensions(canvasW, canvasH, videoW, videoH);
  return {
    x: dims.offsetX + point.x * dims.renderW,
    y: dims.offsetY + point.y * dims.renderH
  };
}

/**
 * Normaliza um ponto em pixels para 0.0 - 1.0
 */
export function normalizePoint(p: Point2D, width: number, height: number): Point2D {
  if (width <= 0 || height <= 0) return { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(1, p.x / width)),
    y: Math.max(0, Math.min(1, p.y / height))
  };
}

/**
 * Converte um ponto normalizado para coordenadas em pixels
 */
export function denormalizePoint(p: Point2D, width: number, height: number): Point2D {
  return {
    x: p.x * width,
    y: p.y * height
  };
}

/**
 * Algoritmo de Ray-Casting (Jordan Curve Theorem)
 * Testa com precisão se um ponto está dentro de qualquer polígono.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  const { x, y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Move todos os vértices de um boxe por um delta (dx, dy) mantendo dentro dos limites 0-1
 */
export function moveBoxPointsByDelta(points: Point2D[], deltaX: number, deltaY: number): Point2D[] {
  // Encontra limites atuais
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  // Ajusta delta para não estourar os limites da tela (0 a 1)
  const clampedDx = Math.max(-minX, Math.min(1 - maxX, deltaX));
  const clampedDy = Math.max(-minY, Math.min(1 - maxY, deltaY));

  return points.map(p => ({
    x: p.x + clampedDx,
    y: p.y + clampedDy
  }));
}

/**
 * Calcula a área de um polígono usando Shoelace
 */
export function calculatePolygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Calcula o overlap percentual entre a BoundingBox e o Polígono
 */
export function calculateBoxOverlapRatio(
  bboxNorm: [number, number, number, number],
  polygonNorm: Point2D[],
  gridResolution: number = 8
): number {
  const [bx, by, bw, bh] = bboxNorm;
  if (bw <= 0 || bh <= 0 || polygonNorm.length < 3) return 0;

  let pointsInside = 0;
  const totalPoints = gridResolution * gridResolution;

  for (let ix = 0; ix < gridResolution; ix++) {
    for (let iy = 0; iy < gridResolution; iy++) {
      const sampleX = bx + (ix + 0.5) * (bw / gridResolution);
      const sampleY = by + (iy + 0.5) * (bh / gridResolution);

      if (isPointInPolygon({ x: sampleX, y: sampleY }, polygonNorm)) {
        pointsInside++;
      }
    }
  }

  return pointsInside / totalPoints;
}

/**
 * Avalia se o caminhão está dentro do Boxe com alta precisão
 */
export function isTruckInsideDockBox(
  detection: TruckDetection,
  dockBox: DockBox
): { isInside: boolean; overlap: number; reason: string } {
  const { groundContact, centroid, normalizedBbox } = detection;
  const points = dockBox.points;

  if (points.length < 3) {
    return { isInside: false, overlap: 0, reason: 'Polígono incompleto' };
  }

  const overlap = calculateBoxOverlapRatio(normalizedBbox, points, 8);
  const isGroundInside = isPointInPolygon(groundContact, points);
  const isCentroidInside = isPointInPolygon(centroid, points);

  const threshold = dockBox.overlapThreshold ?? 0.25;
  const criteria = dockBox.detectionCriteria ?? 'ground';

  if (criteria === 'centroid') {
    return {
      isInside: isCentroidInside,
      overlap,
      reason: isCentroidInside ? 'Centroide dentro do boxe' : 'Centroide fora'
    };
  }

  if (criteria === 'overlap') {
    const isInside = overlap >= threshold;
    return {
      isInside,
      overlap,
      reason: isInside ? `Overlap ${(overlap * 100).toFixed(0)}% >= ${(threshold * 100).toFixed(0)}%` : 'Overlap insuficiente'
    };
  }

  // CRITÉRIO RIGOROSO DE ALTA FIDELIDADE:
  // 1. O ponto de contato das rodas com o solo DEVE estar estritamente dentro da vaga delimitada.
  // 2. Além disso, pelo menos 28% da caixa do veículo deve estar dentro do boxe (evita ativação por borda).
  const isInside = isGroundInside && (overlap >= Math.max(0.28, threshold) || isCentroidInside);

  return {
    isInside,
    overlap,
    reason: isInside 
      ? `Confirmado: rodas no solo da vaga e ${(overlap * 100).toFixed(0)}% de área`
      : isGroundInside
      ? 'Rodas na vaga, mas área insuficiente'
      : 'Veículo fora da área delimitada (rodas fora do boxe)'
  };
}

/**
 * Cria os 4 pontos normalizados de um retângulo a partir de 2 vértices opostos
 */
export function createRectanglePoints(p1: Point2D, p2: Point2D): Point2D[] {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/**
 * Formata duração em segundos para MM:SS ou HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
