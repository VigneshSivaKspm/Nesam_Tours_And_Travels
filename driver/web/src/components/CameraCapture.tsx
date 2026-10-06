import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, AlertTriangle } from 'lucide-react';

interface CameraCaptureProps {
  /** Called with the JPEG and the moment it was taken. */
  onCapture: (blob: Blob, capturedAtMs: number) => void;
  disabled?: boolean;
}

const MAX_EDGE = 1600;

function explain(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  if (!window.isSecureContext) return 'The camera needs a secure (https) connection. Open the app from its https address.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return 'The camera could not be started. Try again.';
}

/**
 * A live camera view. There is deliberately no file picker or gallery option:
 * the only way to produce a photo here is to take it now with the camera.
 */
export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, disabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'starting' | 'live' | 'error'>('starting');
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState('starting');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'NotFoundError' });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => undefined);
      }
      setState('live');
    } catch (err) {
      setError(explain(err));
      setState('error');
    }
  }, []);

  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const at = Date.now();
    canvas.toBlob((b) => b && onCapture(b, at), 'image/jpeg', 0.88);
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" aria-label="Camera preview" />
        {state === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-black/60" role="status">
            <Loader2 className="w-7 h-7 animate-spin" /> <span className="text-sm font-semibold">Starting camera…</span>
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/80 p-5 text-center" role="alert">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-semibold">{error}</p>
            <button type="button" onClick={() => void start()} className="px-4 py-2 bg-white text-gray-900 text-sm font-bold rounded-lg">
              Try again
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={snap}
        disabled={disabled || state !== 'live'}
        className="w-full py-3.5 bg-[#E21E26] hover:bg-[#C9141B] text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Camera className="w-5 h-5" /> Capture photo
      </button>
      <p className="text-xs text-gray-600 text-center">Photos must be taken now with the camera. Gallery or file uploads are not accepted.</p>
    </div>
  );
};
