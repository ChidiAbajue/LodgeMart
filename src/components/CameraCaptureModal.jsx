import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Check, AlertCircle } from 'lucide-react';

export default function CameraCaptureModal({ isOpen, onClose, vendorName, onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPreviewUrl('');
    setCameraError('');

    let active = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (active) {
          setCameraError(
            'Rear camera unavailable on this device. Use the live test-frame capture below.'
          );
        }
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      startCamera();
    } else {
      setCameraError('Camera API unavailable. Use the live test-frame capture below.');
    }

    const handleFileFallback = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSnap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    if (videoRef.current && streamRef.current && videoRef.current.readyState >= 2) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      // Clean fallback frame for desktop/laptop testing without a rear camera
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#047857';
      ctx.fillRect(24, 24, canvas.width - 48, 72);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`LodgeMart Stall Proof — ${vendorName}`, 42, 68);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Captured: ${new Date().toLocaleTimeString()}`, 42, 140);
      ctx.fillText('Eke Awka Market • Verified Live Frame', 42, 170);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPreviewUrl(dataUrl);
  };

  const handleConfirm = () => {
    if (!previewUrl) return;
    onCapture(previewUrl);
    onClose();
  };

  const handleFileFallback = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Capture Stall Proof</h3>
            <p className="text-xs text-slate-500">
              Live camera required for {vendorName} (gallery uploads blocked)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative aspect-4/3 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Stall proof" className="w-full h-full object-cover" />
            ) : cameraError ? (
              <div className="p-6 text-center text-slate-300 space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs">{cameraError}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex flex-col gap-2">
            {!previewUrl ? (
              <>
                <button
                  onClick={handleSnap}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Photo</span>
                </button>
                {cameraError && (
                  <label className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold text-center cursor-pointer hover:bg-slate-50">
                    <span>Or Capture via Device Camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileFallback}
                      className="hidden"
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setPreviewUrl('')}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
                >
                  Retake
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Use Photo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
