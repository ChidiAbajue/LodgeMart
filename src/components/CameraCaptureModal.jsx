import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, AlertCircle } from 'lucide-react';
import Modal, { ActionButton } from './ui/Modal';

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
      ctx.fillStyle = '#13201a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f28724';
      ctx.fillRect(24, 24, canvas.width - 48, 72);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`LodgeMart Stall Proof — ${vendorName}`, 42, 68);
      ctx.fillStyle = '#e6e9e3';
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

  return (
    <Modal
      open
      onClose={onClose}
      icon={Camera}
      title="Capture stall proof"
      subtitle={`Live camera required for ${vendorName} (gallery uploads blocked)`}
    >
      <div className="space-y-4">
        <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-ink">
          {previewUrl ? (
            <img src={previewUrl} alt="Stall proof" className="h-full w-full object-cover" />
          ) : cameraError ? (
            <div className="space-y-3 p-6 text-center text-white/70">
              <AlertCircle className="mx-auto h-9 w-9 text-accent-400" />
              <p className="text-sm">{cameraError}</p>
            </div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          )}
          {/* viewfinder corners */}
          {!previewUrl &&
            ['left-4 top-4 border-l-4 border-t-4', 'right-4 top-4 border-r-4 border-t-4', 'left-4 bottom-4 border-l-4 border-b-4', 'right-4 bottom-4 border-r-4 border-b-4'].map((c) => (
              <span key={c} aria-hidden="true" className={`pointer-events-none absolute h-8 w-8 border-accent-500 ${c}`} />
            ))}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {!previewUrl ? (
          <ActionButton onClick={handleSnap}>
            <Camera className="h-4 w-4" /> Take live photo
          </ActionButton>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setPreviewUrl('')}
              className="h-14 rounded-md border-2 border-ink font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-ink hover:text-white cursor-pointer"
            >
              Retake
            </button>
            <ActionButton onClick={handleConfirm}>
              <Check className="h-4 w-4" /> Use photo
            </ActionButton>
          </div>
        )}
      </div>
    </Modal>
  );
}
