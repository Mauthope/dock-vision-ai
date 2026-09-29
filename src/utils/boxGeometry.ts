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
 * Calcula o percentual da Bounding Box do veículo que está dentro da vaga demarcada.
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
 * Calcula a taxa de cobertura da VAGA (quanto da vaga/boxe desenhado está coberto pelo caminhão).
 * Essencial para câmeras instaladas perto da doca, onde o caminhão é maior que a tela ou fica parcialmente cortado pelo enquadramento.
 */
export function calculateDockCoverageRatio(
  bboxNorm: [number, number, number, number],
  polygonNorm: Point2D[],
  gridResolution: number = 8
): number {
  if (polygonNorm.length < 3) return 0;
  const [bx, by, bw, bh] = bboxNorm;
  if (bw <= 0 || bh <= 0) return 0;

  const minX = Math.min(...polygonNorm.map(p => p.x));
  const maxX = Math.max(...polygonNorm.map(p => p.x));
  const minY = Math.min(...polygonNorm.map(p => p.y));
  const maxY = Math.max(...polygonNorm.map(p => p.y));
  const polyW = maxX - minX;
  const polyH = maxY - minY;

  if (polyW <= 0 || polyH <= 0) return 0;

  // Verificação rápida de colisão AABB (Axis-Aligned Bounding Box)
  if (bx + bw < minX || bx > maxX || by + bh < minY || by > maxY) {
    return 0;
  }

  let totalPolygonPoints = 0;
  let coveredPoints = 0;

  for (let ix = 0; ix < gridResolution; ix++) {
    for (let iy = 0; iy < gridResolution; iy++) {
      const px = minX + (ix + 0.5) * (polyW / gridResolution);
      const py = minY + (iy + 0.5) * (polyH / gridResolution);

      if (isPointInPolygon({ x: px, y: py }, polygonNorm)) {
        totalPolygonPoints++;
        if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
          coveredPoints++;
        }
      }
    }
  }

  return totalPolygonPoints > 0 ? coveredPoints / totalPolygonPoints : 0;
}

/**
 * Avalia se o caminhão está dentro do Boxe com alta precisão
 * Suporta tanto câmeras amplas (veículo inteiro) quanto câmeras próximas (caminhão maior que o enquadramento)
 */
export function isTruckInsideDockBox(
  detection: TruckDetection,
  dockBox: DockBox
): { isInside: boolean; overlap: number; dockCoverage: number; reason: string } {
  const { groundContact, centroid, normalizedBbox } = detection;
  const points = dockBox.points;

  if (points.length < 3) {
    return { isInside: false, overlap: 0, dockCoverage: 0, reason: 'Polígono incompleto' };
  }

  const [bx, by, bw, bh] = normalizedBbox;
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  // Filtro rápido AABB: se a caixa do caminhão sequer toca o retângulo envolvente do boxe
  if (bx + bw < minX || bx > maxX || by + bh < minY || by > maxY) {
    return { isInside: false, overlap: 0, dockCoverage: 0, reason: 'Fora da área do boxe' };
  }

  const truckOverlap = calculateBoxOverlapRatio(normalizedBbox, points, 8);
  const dockCoverage = calculateDockCoverageRatio(normalizedBbox, points, 8);
  const isGroundInside = isPointInPolygon(groundContact, points);
  const isCentroidInside = isPointInPolygon(centroid, points);

  // 1. TRATAMENTO ESPECÍFICO PARA MOVIMENTO
  if (detection.class === 'motion') {
    return {
      isInside: true,
      overlap: 1.0,
      dockCoverage: detection.score,
      reason: `Movimento detectado: ${(detection.score * 100).toFixed(0)}% de intensidade`
    };
  }

  // 2. TRATAMENTO ESPECÍFICO PARA PESSOAS / PEDESTRES
  // Pessoas ocupam pequena área em relação a uma vaga de doca.
  // Testamos múltiplos pontos de referência anatômicos (pés no solo, centroide, cabeça/ombros, cintura) ou sobreposição >= 10%.
  if (detection.class === 'person') {
    const headPoint = { x: centroid.x, y: Math.max(0, by + bh * 0.15) };
    const waistPoint = { x: centroid.x, y: by + bh * 0.60 };
    const feetPoint = groundContact;

    const isHeadInside = isPointInPolygon(headPoint, points);
    const isWaistInside = isPointInPolygon(waistPoint, points);
    const isFeetInside = isPointInPolygon(feetPoint, points);
    const isCentroidIn = isPointInPolygon(centroid, points);

    // Se qualquer ponto anatômico ou pelo menos 10% da caixa da pessoa estiver dentro do boxe
    const isPersonInside = isFeetInside || isCentroidIn || isHeadInside || isWaistInside || truckOverlap >= 0.10;

    // Garante que 'overlap' seja positivo e substancial (> 0) para vencer comparações no DockContext
    const effectiveOverlap = isPersonInside ? Math.max(0.60, truckOverlap, detection.score) : 0;

    return {
      isInside: isPersonInside,
      overlap: effectiveOverlap,
      dockCoverage,
      reason: isPersonInside
        ? `Pessoa identificada dentro da vaga (${(Math.max(truckOverlap, 0.10) * 100).toFixed(0)}% sobreposição)`
        : 'Pessoa fora da vaga'
    };
  }

  const criteria = dockBox.detectionCriteria || 'auto';
  const threshold = dockBox.overlapThreshold ?? 0.20;

  let isInside = false;
  let reason = '';

  switch (criteria) {
    case 'close_dock': {
      // Modo Doca Próxima: O caminhão cobriu a área da doca/vaga (mesmo que cabine/rodas estejam fora)
      isInside = dockCoverage >= threshold;
      reason = isInside
        ? `Doca ocupada: ${(dockCoverage * 100).toFixed(0)}% da vaga coberta`
        : `Doca livre (cobertura ${(dockCoverage * 100).toFixed(0)}% < ${(threshold * 100).toFixed(0)}%)`;
      break;
    }
    case 'ground': {
      // Modo Pátio Amplo: Rodas no solo da vaga e sobreposição
      isInside = isGroundInside && (truckOverlap >= threshold || isCentroidInside);
      reason = isInside
        ? `Rodas na vaga (${(truckOverlap * 100).toFixed(0)}% overlap)`
        : isGroundInside
        ? 'Rodas na vaga, aguardando alinhamento'
        : 'Veículo fora da vaga (rodas fora)';
      break;
    }
    case 'centroid': {
      isInside = isCentroidInside;
      reason = isInside ? 'Centro do veículo dentro do boxe' : 'Centro do veículo fora';
      break;
    }
    case 'overlap': {
      const maxRatio = Math.max(truckOverlap, dockCoverage);
      isInside = maxRatio >= threshold;
      reason = isInside
        ? `Sobreposição ${(maxRatio * 100).toFixed(0)}% >= ${(threshold * 100).toFixed(0)}%`
        : 'Sobreposição insuficiente';
      break;
    }
    case 'auto':
    default: {
      // MODO INTELIGENTE HÍBRIDO (Recomendado):
      // 1. Doca próxima: Veículo cobre >= 20% da vaga (ideal para câmeras de doca onde caminhão é enorme)
      const isCoveringDock = dockCoverage >= threshold;
      // 2. Câmera ampla: Rodas no solo da vaga
      const isParkedInside = isGroundInside && (truckOverlap >= 0.15 || isCentroidInside);
      // 3. Centroide dentro com qualquer cobertura substancial
      const isCentroidDocked = isCentroidInside && (dockCoverage >= 0.15 || truckOverlap >= 0.15);

      isInside = isCoveringDock || isParkedInside || isCentroidDocked;

      reason = isCoveringDock
        ? `Doca ocupada: ${(dockCoverage * 100).toFixed(0)}% da vaga coberta`
        : isParkedInside
        ? `Veículo estacionado: ${(truckOverlap * 100).toFixed(0)}% na vaga`
        : isCentroidDocked
        ? 'Veículo centralizado na vaga'
        : isGroundInside
        ? 'Rodas na vaga, alinhando...'
        : 'Fora da vaga';
      break;
    }
  }

  return {
    isInside,
    overlap: Math.max(truckOverlap, dockCoverage),
    dockCoverage,
    reason
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
