import { useRef, useEffect } from 'react';

export default function SignaturePad({ value, onChange, disabled = false, height = 200 }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const restoredKey = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const width = Math.max(Math.floor(container.clientWidth), 480);
    canvas.width = Math.min(width, 1000);
    canvas.height = height;
  }, [height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    if (restoredKey.current === value) return;
    restoredKey.current = value;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const scale = canvas.height / img.height;
      const w = img.width * scale;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, (canvas.width - w) / 2, 0, w, canvas.height);
      hasStroke.current = true;
    };
    img.src = value;
  }, [value, height]);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.beginPath();
    const { x, y } = point(e);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    drawing.current = true;
    hasStroke.current = true;
  };

  const onPointerMove = (e) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endStroke = () => {
    if (!drawing.current || disabled) return;
    drawing.current = false;
    if (hasStroke.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = (e) => {
    e.preventDefault();
    if (disabled) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasStroke.current = false;
    restoredKey.current = null;
    onChange(null);
  };

  return (
    <div>
      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%' }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height,
            border: '1px dashed #94a3b8',
            borderRadius: '8px',
            background: '#ffffff',
            touchAction: 'none',
            cursor: disabled ? 'not-allowed' : 'crosshair',
            display: 'block',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
        {!value && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: 13,
              pointerEvents: 'none',
            }}
          >
            Draw your signature here
          </div>
        )}
      </div>
      <div className="flex justify-between items-center flex-wrap gap-2 mt-2">
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="text-xs font-semibold text-primary underline"
        >
          Clear
        </button>
        <span className="text-xs text-muted">
          Uses mouse or touch.
        </span>
      </div>
    </div>
  );
}