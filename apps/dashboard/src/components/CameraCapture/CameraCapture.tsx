import {
  useEffect,
  useRef,
  useState
} from "react";

import "./CameraCapture.css";

type CameraCaptureProps = {
  value?: string;
  onCapture: (photoDataUrl: string) => void;
  onClear?: () => void;
};

export function CameraCapture({
  value,
  onCapture,
  onClear
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
    setIsCameraOpen(false);
  }

  async function startCamera() {
    setError(null);
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is not supported by this browser."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraOpen(true);
    } catch (cameraError) {
      const message =
        cameraError instanceof Error
          ? cameraError.message
          : "Unable to access the camera.";

      setError(message);
      stopCamera();
    } finally {
      setIsStarting(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setError("Camera capture is not ready.");
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setError("Camera image is not available yet.");
      return;
    }

    const targetWidth = 720;
    const aspectRatio =
      video.videoHeight / video.videoWidth;
    const targetHeight = Math.round(
      targetWidth * aspectRatio
    );

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Photo processing is unavailable.");
      return;
    }

    context.drawImage(
      video,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const photoDataUrl = canvas.toDataURL(
      "image/jpeg",
      0.86
    );

    onCapture(photoDataUrl);
    stopCamera();
  }

  function clearPhoto() {
    onClear?.();
    setError(null);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  return (
    <section className="camera-capture">
      <div className="camera-capture__surface">
        {value ? (
          <img
            className="camera-capture__photo"
            src={value}
            alt="Captured visitor"
          />
        ) : (
          <video
            ref={videoRef}
            className={[
              "camera-capture__video",
              isCameraOpen
                ? "camera-capture__video--visible"
                : ""
            ].join(" ")}
            playsInline
            muted
          />
        )}

        {!value && !isCameraOpen && (
          <div className="camera-capture__empty">
            <div className="camera-capture__icon">
              ◎
            </div>

            <strong>No visitor photo</strong>

            <span>
              Start the camera and capture a clear
              front-facing image.
            </span>
          </div>
        )}

        <div className="camera-capture__badge">
          {value
            ? "Photo captured"
            : isCameraOpen
              ? "Camera live"
              : "Camera inactive"}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="camera-capture__canvas"
      />

      {error && (
        <div className="camera-capture__error">
          {error}
        </div>
      )}

      <div className="camera-capture__actions">
        {!value && !isCameraOpen && (
          <button
            type="button"
            className="camera-capture__button camera-capture__button--primary"
            onClick={startCamera}
            disabled={isStarting}
          >
            {isStarting
              ? "Starting camera..."
              : "Open Camera"}
          </button>
        )}

        {!value && isCameraOpen && (
          <>
            <button
              type="button"
              className="camera-capture__button camera-capture__button--secondary"
              onClick={stopCamera}
            >
              Cancel
            </button>

            <button
              type="button"
              className="camera-capture__button camera-capture__button--primary"
              onClick={capturePhoto}
            >
              Capture Photo
            </button>
          </>
        )}

        {value && (
          <>
            <button
              type="button"
              className="camera-capture__button camera-capture__button--secondary"
              onClick={clearPhoto}
            >
              Remove
            </button>

            <button
              type="button"
              className="camera-capture__button camera-capture__button--primary"
              onClick={() => {
                clearPhoto();
                void startCamera();
              }}
            >
              Retake Photo
            </button>
          </>
        )}
      </div>
    </section>
  );
}