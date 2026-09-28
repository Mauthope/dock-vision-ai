import { NextResponse } from 'next/server';

// Estado compartilhado em memória no servidor Next.js
let globalSyncState = {
  boxes: [],
  records: [],
  activeCameraId: 'cam-main',
  lastUpdated: Date.now(),
  connectedDevices: 1,
};

export async function GET() {
  return NextResponse.json(globalSyncState, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.boxes && Array.isArray(body.boxes)) {
      globalSyncState.boxes = body.boxes;
    }
    if (body.records && Array.isArray(body.records)) {
      globalSyncState.records = body.records;
    }
    if (body.activeCameraId) {
      globalSyncState.activeCameraId = body.activeCameraId;
    }

    globalSyncState.lastUpdated = Date.now();

    return NextResponse.json({
      success: true,
      lastUpdated: globalSyncState.lastUpdated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Sync error' },
      { status: 500 }
    );
  }
}
