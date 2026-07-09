import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser, PenLine, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const INK = '#000000';
const PAPER = '#ffffff';
const BW_THRESHOLD = 210;

/** Exporta o canvas como PNG preto e branco nítido (ideal para recibo/impressão). */
export function canvasToSharpBW(sourceCanvas, threshold = BW_THRESHOLD) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = gray < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return off.toDataURL('image/png');
}

/**
 * Quadro de assinatura à mão — checkout e confirmação de entrega.
 * Exporta imagem P&B nítida para o recibo.
 */
const SignaturePad = forwardRef(function SignaturePad(
  {
    label = 'Assinatura',
    hint = 'Assine com o dedo ou caneta no quadro abaixo.',
    className = '',
    height = 'h-36',
    disabled = false,
  },
  ref,
) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
  }, []);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const startDraw = (e) => {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  };

  const endDraw = () => { drawing.current = false; };

  const clear = useCallback(() => {
    setupCanvas();
    setHasStroke(false);
  }, [setupCanvas]);

  useImperativeHandle(ref, () => ({
    getDataURL: () => {
      if (!hasStroke || !canvasRef.current) return null;
      return canvasToSharpBW(canvasRef.current);
    },
    hasStroke: () => hasStroke,
    clear,
  }), [hasStroke, clear]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center gap-2">
        <Label className="flex items-center gap-1.5">
          <PenLine className="h-4 w-4 text-[#0ea5c9]" />
          {label}
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-8 text-xs shrink-0" disabled={disabled}>
          <Eraser className="h-3 w-3 mr-1" /> Limpar
        </Button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`w-full ${height} border-2 rounded-xl touch-none cursor-crosshair bg-white ${
            hasStroke ? 'border-green-500/40' : 'border-dashed border-[#0ea5c9]/40'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          onTouchCancel={endDraw}
        />
        {hasStroke && (
          <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-green-600 pointer-events-none" />
        )}
        {!hasStroke && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/30">
            <PenLine className="h-8 w-8" strokeWidth={1} />
          </div>
        )}
      </div>

      <p className={`text-[11px] transition-colors ${hasStroke ? 'text-green-700 font-medium' : 'text-muted-foreground'}`}>
        {hasStroke ? 'Assinatura registada — será anexada ao recibo em preto e branco.' : hint}
      </p>
    </div>
  );
});

export default SignaturePad;
