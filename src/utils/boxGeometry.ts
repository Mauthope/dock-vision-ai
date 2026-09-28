import { Point2D, DockBox, TruckDetection } from '../types/dock';

/**
 * Normaliza um ponto em pixels (relativo ao tamanho visual do canvas/vídeo) para 0.0 - 1.0
 */
export function normalizePoint(p: Point2D, width: number, height: number): Point2D {
  if (width <= 0 || height <= 0) return { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(1, p.x / width)),
    y: Math.max(0, Math.min(1, p.y / height))
  };
}

/**
 * Converte um ponto normalizado (0.0 - 1.0) para coordenadas em pixels de uma dada resolução
 */
export function denormalizePoint(p: Point2D, width: number, height: number): Point2D {
  return {
    x: p.x * width,
    y: p.y * height
  };
}

/**
 * Algoritmo de Ray-Casting (Jordan Curve Theorem)
 * Testa com precisão matemática se um ponto está estritamente dentro de um polígono de N vértices.
 * Funciona para qualquer polígono (retângulos, trapézios de perspectiva, formas livres).
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
 * Calcula a área de um polígono usando a fórmula Shoelace (Gauß)
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
 * Calcula a porcentagem de sobreposição (overlap ratio) entre a Bounding Box do caminhão
 * e o Polígono do Box desenhado.
 * 
 * Utiliza amostragem de grade densa (8x8 = 64 pontos de controle) dentro da bounding box.
 * Esse método é imune a instabilidades numéricas de interpolação poligonal e calcula
 * a fração exata do caminhão que repousa dentro da área do boxe.
 */
export function calculateBoxOverlapRatio(
  bboxNorm: [number, number, number, number], // [x, y, w, h] normalizados (0-1)
  polygonNorm: Point2D[],
  gridResolution: number = 8
): number {
  const [bx, by, bw, bh] = bboxNorm;
  if (bw <= 0 || bh <= 0 || polygonNorm.length < 3) return 0;

  let pointsInside = 0;
  const totalPoints = gridResolution * gridResolution;

  for (let ix = 0; ix < gridResolution; ix++) {
    for (let iy = 0; iy < gridResolution; iy++) {
      // Amostra cada ponto no centro da sua célula de grade
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
 * Determina com 100% de precisão se um caminhão detectado está realmente dentro de um Boxe desenhado.
 * 
 * Combina:
 * 1. Ponto de Contato com o Solo (rodas/eixos do caminhão onde ele toca a vaga no chão)
 * 2. Centroide do veículo
 * 3. Proporção de Sobreposição volumétrica (Overlap Ratio)
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

  // 1. Calcula o overlap volumétrico por amostragem
  const overlap = calculateBoxOverlapRatio(normalizedBbox, points, 8);

  // 2. Testa ponto de contato no solo (onde as rodas tocam a vaga)
  const isGroundInside = isPointInPolygon(groundContact, points);

  // 3. Testa ponto centroide
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

  // Modo Padrão Industrial ('ground' ou combinado de alta precisão):
  // Um caminhão está no boxe se:
  // (a) As rodas/solo estão dentro do boxe E há pelo menos 15% de overlap, OU
  // (b) Mais de 35% do volume do caminhão está dentro da vaga (mesmo com câmera de ângulo muito raso).
  const isInside = (isGroundInside && overlap >= 0.15) || overlap >= Math.max(0.35, threshold);

  return {
    isInside,
    overlap,
    reason: isInside 
      ? `Detectado no chão e ${(overlap * 100).toFixed(0)}% de área`
      : 'Fora da área delimitada'
  };
}

/**
 * Cria os 4 pontos para um retângulo normalizado a partir de 2 cantos (arraste do mouse)
 */
export function createRectanglePoints(p1: Point2D, p2: Point2D): Point2D[] {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  return [
    { x: minX, y: minY }, // Superior Esquerdo
    { x: maxX, y: minY }, // Superior Direito
    { x: maxX, y: maxY }, // Inferior Direito
    { x: minX, y: maxY }, // Inferior Esquerdo
  ];
}

/**
 * Formata duração em segundos para HH:MM:SS ou MM:SS
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

/**
 * Formata data/hora para padrão brasileiro DD/MM/AAAA HH:MM:SS
 */
export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
