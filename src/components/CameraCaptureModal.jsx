import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, AlertCircle, ImageUp } from 'lucide-react';
import Modal, { ActionButton } from './ui/Modal';

const MAX_SIDE = 1280; // keep uploads small on market data connections

// Draw a source (video frame or loaded image) onto a canvas, scaled down, as JPEG.
function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function fileToJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(toJpeg(img, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not a photo we can read. Try again.'));
    };
    img.src = url;
  });
}

/**
 * Stall proof photo. Uses the live rear camera when the browser allows it;
 * otherwise falls back to the phone's own camera app through a file input
 * (`capture="environment"`), which still works on older Android browsers and
 * over plain http on a LAN.
 */
export default function CameraCaptureModal({ isOpen, onClose, vendorName, onCapture }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [ready, setReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    setPreviewUrl('');
    setCameraError('');
    setFileError('');
    setReady(false);

    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is not available in this browser. Use your phone camera instead.');
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {
          if (active) setCameraError('Camera blocked or not found. Use your phone camera instead.');
        });
    }

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const snap = () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    setPreviewUrl(toJpeg(v, v.videoWidth, v.videoHeight));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError('');
    try {
      setPreviewUrl(await fileToJpeg(file));
    } catch (err) {
      setFileError(err.message);
    }
  };

  const confirm = () => {
    if (!previewUrl) return;
    onCapture(previewUrl);
    onClose();
  };

  return (
    <Modal open onClose={onClose} icon={Camera} title="Stall proof photo" subtitle={`Photograph the packed bags at ${vendorName}`}>
      <div className="space-y-4">
        <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-ink">
          {previewUrl ? (
            <img src={previewUrl} alt="Stall proof preview" className="h-full w-full object-cover" />
          ) : cameraError ? (
            <div className="space-y-3 p-6 text-center text-white/75">
              <AlertCircle className="mx-auto h-9 w-9 text-accent-400" />
              <p className="text-sm">{cameraError}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedData={() => setReady(true)}
              className="h-full w-full object-cover"
            />
          )}
          {!previewUrl &&
            ['left-4 top-4 border-l-4 border-t-4', 'right-4 top-4 border-r-4 border-t-4', 'left-4 bottom-4 border-l-4 border-b-4', 'right-4 bottom-4 border-r-4 border-b-4'].map((c) => (
              <span key={c} aria-hidden="true" className={`pointer-events-none absolute h-8 w-8 border-accent-500 ${c}`} />
            ))}
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} data-testid="stall-photo-input" />
        {fileError && <p role="alert" className="text-sm font-semibold text-red-600">{fileError}</p>}

        {previewUrl ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setPreviewUrl('')}
              className="h-14 rounded-md border-2 border-ink font-display text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors duration-300 hover:bg-ink hover:text-white cursor-pointer"
            >
              Retake
            </button>
            <ActionButton onClick={confirm}>
              <Check className="h-4 w-4" /> Use photo
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-2.5">
            {!cameraError && (
              <ActionButton onClick={snap} disabled={!ready}>
                <Camera className="h-4 w-4" /> {ready ? 'Take photo' : 'Starting camera...'}
              </ActionButton>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className={`flex h-14 w-full items-center justify-center gap-2 rounded-md font-display text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300 cursor-pointer ${
                cameraError ? 'bg-accent-500 text-ink hover:bg-ink hover:text-white' : 'border-2 border-ink/15 text-ink hover:border-ink'
              }`}
            >
              <ImageUp className="h-4 w-4" /> Use phone camera
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
