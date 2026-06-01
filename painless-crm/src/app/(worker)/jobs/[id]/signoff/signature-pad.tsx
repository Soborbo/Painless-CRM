'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataUrl: () => string;
  clear: () => void;
}

// Finger-drawn signature capture (Phase 11 §1). Pointer-events based so it works
// for touch + mouse; exposes the PNG data URL to the parent form via ref.
export function SignaturePad({
  ref,
  label,
  clearLabel,
}: {
  ref: React.Ref<SignaturePadHandle>;
  label: string;
  clearLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const ctx = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Size the backing store to the displayed size for crisp lines.
    const rect = canvas.getBoundingClientRect();
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const context = canvas.getContext('2d');
    if (context) {
      context.scale(dpr, dpr);
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#111827';
    }
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const context = ctx();
    if (!context) return;
    drawing.current = true;
    const { x, y } = pos(e);
    context.beginPath();
    context.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = ctx();
    if (!context) return;
    const { x, y } = pos(e);
    context.lineTo(x, y);
    context.stroke();
    if (!dirty.current) {
      dirty.current = true;
      setHasInk(true);
    }
  }

  function end() {
    drawing.current = false;
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => !dirty.current,
    toDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? '',
    clear: () => {
      const canvas = canvasRef.current;
      const context = ctx();
      if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
      dirty.current = false;
      setHasInk(false);
    },
  }));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">{label}</span>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-40 w-full touch-none rounded-md border bg-white"
      />
      <button
        type="button"
        onClick={() => {
          const canvas = canvasRef.current;
          const context = ctx();
          if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
          dirty.current = false;
          setHasInk(false);
        }}
        disabled={!hasInk}
        className="self-start text-sm underline disabled:opacity-40"
      >
        {clearLabel}
      </button>
    </div>
  );
}
