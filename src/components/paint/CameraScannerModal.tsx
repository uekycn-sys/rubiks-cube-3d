import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Face } from '../../core/types';
import {
  LabColor,
  SCAN_ORDER,
  classifyLabAgainstCentroids,
  calibrateAndSolveColors,
  sampleGrid3x3FromCanvas,
} from '../../core/colorClassifier';
import { COLOR_TO_HEX_STRING, FACE_TO_COLOR_NAME } from '../../engine/themes';
import { soundManager } from '../../audio/SoundManager';

interface CameraScannerModalProps {
  onComplete: (facelets: string) => void;
  onClose: () => void;
}

interface ScanStepMeta {
  face: Face;
  label: string;
  centerColorZh: string;
  topEdgeColor: Face;
  bottomEdgeColor: Face;
  topHint: string;
  flipInstruction: string;
}

const SCAN_STEPS: ScanStepMeta[] = [
  {
    face: 'F',
    label: '正面 (F)',
    centerColorZh: '绿色中心',
    topEdgeColor: 'U',
    bottomEdgeColor: 'D',
    topHint: '白顶 ↑ / 黄底 ↓',
    flipInstruction: '第 1 步：保持【白心朝上】，让【绿心面】正对镜头框内',
  },
  {
    face: 'R',
    label: '右面 (R)',
    centerColorZh: '红色中心',
    topEdgeColor: 'U',
    bottomEdgeColor: 'D',
    topHint: '白顶 ↑ / 黄底 ↓',
    flipInstruction: '保持白顶不动，将魔方【向左横转 90°】，让【红心面】正对镜头',
  },
  {
    face: 'B',
    label: '背面 (B)',
    centerColorZh: '蓝色中心',
    topEdgeColor: 'U',
    bottomEdgeColor: 'D',
    topHint: '白顶 ↑ / 黄底 ↓',
    flipInstruction: '继续【向左横转 90°】，让【蓝心面】正对镜头',
  },
  {
    face: 'L',
    label: '左面 (L)',
    centerColorZh: '橙色中心',
    topEdgeColor: 'U',
    bottomEdgeColor: 'D',
    topHint: '白顶 ↑ / 黄底 ↓',
    flipInstruction: '继续【向左横转 90°】，让【橙心面】正对镜头',
  },
  {
    face: 'U',
    label: '顶面 (U)',
    centerColorZh: '白色中心',
    topEdgeColor: 'B',
    bottomEdgeColor: 'F',
    topHint: '蓝边 ↑ / 绿边 ↓',
    flipInstruction: '先回到绿面正对，再将魔方【向下翻转 90°】，让【白心面】朝向镜头（蓝在上、绿在下）',
  },
  {
    face: 'D',
    label: '底面 (D)',
    centerColorZh: '黄色中心',
    topEdgeColor: 'F',
    bottomEdgeColor: 'B',
    topHint: '绿边 ↑ / 蓝边 ↓',
    flipInstruction: '回到绿面正对，再将魔方【向上翻转 90°】，让【黄心面】朝向镜头（绿在上、蓝在下）',
  },
];

const AUTO_STABLE_MS = 800; // 0.8s continuous stability
const COOLDOWN_AFTER_CAPTURE_MS = 650;

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  onComplete,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIdx, setDeviceIdx] = useState<number>(-1);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Auto-capture state
  const [autoCapture, setAutoCapture] = useState(false);
  const [stabilityProgress, setStabilityProgress] = useState(0); // 0..100

  // Live preview data
  const [previewFaces, setPreviewFaces] = useState<Face[]>(new Array(9).fill('F'));
  const latestLabsRef = useRef<LabColor[]>([]);
  const capturedLabsRef = useRef<Partial<Record<Face, LabColor[]>>>({});
  const [capturedSummary, setCapturedSummary] = useState<Partial<Record<Face, Face[]>>>({});

  // Stability tracking refs
  const lastSignatureRef = useRef<string>('');
  const stableStartTimeRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const captureFlashRef = useRef<boolean>(false);
  const [flashActive, setFlashActive] = useState(false);

  const currentStep = SCAN_STEPS[stepIdx];

  // Stop active MediaStream tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize or switch camera
  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user', specificDeviceId?: string) => {
      stopStream();
      setCameraStatus('loading');
      setErrorMessage('');

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraStatus('error');
        setErrorMessage(
          '当前环境不支持浏览器摄像头调用（请确认使用 HTTPS 或 localhost 访问，并检查浏览器权限设置）。您也可以关闭此窗口直接手动点选填色。'
        );
        return;
      }

      try {
        const videoConstraint: MediaTrackConstraints = specificDeviceId
          ? { deviceId: { exact: specificDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: targetFacing }, width: { ideal: 1280 }, height: { ideal: 720 } };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Enumerate devices once permission is granted so "切换摄像头" works reliably on laptops/desktops too
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const cams = allDevices.filter((d) => d.kind === 'videoinput');
          setVideoDevices(cams);
        } catch {
          // Ignore enumerate failure
        }

        setCameraStatus('ready');
      } catch (err: any) {
        stopStream();
        setCameraStatus('error');
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setErrorMessage(
            '摄像头访问权限被拒绝。请点击浏览器地址栏左侧的权限图标允许访问摄像头后重试，或关闭此窗口使用手动点选填色。'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setErrorMessage(
            '未检测到可用的摄像头设备。请确认电脑或手机摄像头连接正常，或直接使用 2D/3D 手动填色。'
          );
        } else if (name === 'NotReadableError' || name === 'AbortError') {
          setErrorMessage(
            '摄像头正被其他应用占用或硬件读取异常，请关闭占用摄像头的软件后重试。'
          );
        } else {
          setErrorMessage(`无法启动摄像头：${err?.message || '未知错误'}。请尝试切换设备或手动填色。`);
        }
      }
    },
    [stopStream]
  );

  // Start initial rear camera on mount and guarantee cleanup on unmount
  useEffect(() => {
    startCamera('environment');
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  // Switch camera handler (cycles enumerated devices if multiple, otherwise toggles facingMode)
  const handleSwitchCamera = () => {
    if (videoDevices.length > 1) {
      const nextIdx = (deviceIdx + 1) % videoDevices.length;
      setDeviceIdx(nextIdx);
      startCamera(facingMode, videoDevices[nextIdx].deviceId);
    } else {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      startCamera(nextFacing);
    }
  };

  // Capture current face and advance (or finalize calibration on 6th face)
  const captureCurrentFace = useCallback(() => {
    if (cameraStatus !== 'ready' || latestLabsRef.current.length !== 9) return;
    if (captureFlashRef.current) return;

    captureFlashRef.current = true;
    setFlashActive(true);
    setTimeout(() => {
      captureFlashRef.current = false;
      setFlashActive(false);
    }, 180);

    const face = SCAN_ORDER[stepIdx];
    const clonedLabs = latestLabsRef.current.map((c) => ({ ...c }));
    capturedLabsRef.current[face] = clonedLabs;
    setCapturedSummary((prev) => ({
      ...prev,
      [face]: [...previewFaces],
    }));

    // Reset stability tracker with cooldown so user has time to flip the cube
    lastSignatureRef.current = '';
    stableStartTimeRef.current = 0;
    setStabilityProgress(0);
    cooldownUntilRef.current = performance.now() + COOLDOWN_AFTER_CAPTURE_MS;

    if (stepIdx < SCAN_ORDER.length - 1) {
      soundManager.playClick();
      setStepIdx((prev) => prev + 1);
    } else {
      // All 6 faces scanned! Run center-calibrated global 54-tile classification
      const fullSamples = capturedLabsRef.current as Record<Face, LabColor[]>;
      const solvedFacelets = calibrateAndSolveColors(fullSamples);
      soundManager.playPaint();
      stopStream();
      onComplete(solvedFacelets);
    }
  }, [cameraStatus, stepIdx, previewFaces, stopStream, onComplete]);

  // Retake previous face
  const handleRetakePrev = () => {
    if (stepIdx <= 0) return;
    const prevIdx = stepIdx - 1;
    const prevFace = SCAN_ORDER[prevIdx];
    delete capturedLabsRef.current[prevFace];
    setCapturedSummary((prev) => {
      const next = { ...prev };
      delete next[prevFace];
      return next;
    });
    lastSignatureRef.current = '';
    stableStartTimeRef.current = 0;
    setStabilityProgress(0);
    cooldownUntilRef.current = performance.now() + 400;
    setStepIdx(prevIdx);
  };

  // Spacebar shortcut for manual capture
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        captureCurrentFace();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        stopStream();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [captureCurrentFace, stopStream, onClose]);

  // Real-time 10x10px sampling loop
  useEffect(() => {
    if (cameraStatus !== 'ready') return;

    if (!offscreenCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 90;
      c.height = 90;
      offscreenCanvasRef.current = c;
    }

    let timerId: number | null = null;
    let isCancelled = false;

    const sampleFrame = () => {
      if (isCancelled) return;

      const video = videoRef.current;
      const gridEl = gridRef.current;
      const canvas = offscreenCanvasRef.current;

      if (
        video &&
        gridEl &&
        canvas &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const videoRect = video.getBoundingClientRect();
        const gridRect = gridEl.getBoundingClientRect();

        if (videoRect.width > 0 && videoRect.height > 0 && gridRect.width > 0) {
          // Account for CSS object-cover scaling to map the centered grid box accurately onto video pixels
          const scale = Math.max(
            videoRect.width / video.videoWidth,
            videoRect.height / video.videoHeight
          );
          const renderedW = video.videoWidth * scale;
          const renderedH = video.videoHeight * scale;
          const offsetX = (videoRect.width - renderedW) / 2;
          const offsetY = (videoRect.height - renderedH) / 2;

          const relLeft = gridRect.left - videoRect.left;
          const relTop = gridRect.top - videoRect.top;

          const sx = Math.max(0, (relLeft - offsetX) / scale);
          const sy = Math.max(0, (relTop - offsetY) / scale);
          const sw = Math.min(video.videoWidth - sx, gridRect.width / scale);
          const sh = Math.min(video.videoHeight - sy, gridRect.height / scale);

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx && sw > 0 && sh > 0) {
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 90, 90);
            const labs = sampleGrid3x3FromCanvas(ctx, 90);
            latestLabsRef.current = labs;

            const classified = labs.map((lab) => classifyLabAgainstCentroids(lab));
            setPreviewFaces(classified);

            // Auto-capture stability check
            const now = performance.now();
            if (autoCapture && now >= cooldownUntilRef.current) {
              const sig = classified.join('');
              if (sig === lastSignatureRef.current) {
                const elapsed = now - stableStartTimeRef.current;
                const pct = Math.min(100, Math.round((elapsed / AUTO_STABLE_MS) * 100));
                setStabilityProgress(pct);
                if (elapsed >= AUTO_STABLE_MS) {
                  captureCurrentFace();
                }
              } else {
                lastSignatureRef.current = sig;
                stableStartTimeRef.current = now;
                setStabilityProgress(0);
              }
            } else {
              setStabilityProgress(0);
            }
          }
        }
      }

      timerId = window.setTimeout(() => {
        if (!isCancelled) {
          requestAnimationFrame(sampleFrame);
        }
      }, 75);
    };

    const rafId = requestAnimationFrame(sampleFrame);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [cameraStatus, autoCapture, captureCurrentFace]);

  const handleSafeClose = () => {
    stopStream();
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[95dvh] overflow-y-auto rounded-3xl glass-panel border border-sky-500/30 shadow-2xl flex flex-col bg-slate-950/95">
        {/* Top Modal Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">📷</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                实景摄像头扫描自动填色
              </h2>
              <p className="text-[11px] text-slate-400">
                CIELAB 抗偏色引擎 • 6 中心块动态灯光校准
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="px-2.5 py-1.5 rounded-xl glass-button text-xs text-sky-300 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
              title="切换前后或外接摄像头"
            >
              <span>🔄</span>
              <span>切换镜头</span>
            </button>

            <button
              type="button"
              onClick={handleSafeClose}
              className="w-8 h-8 rounded-xl glass-button flex items-center justify-center text-slate-400 hover:text-white text-sm cursor-pointer"
              title="关闭扫描 (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 6-Step Progress Pills */}
        <div className="grid grid-cols-6 gap-1 px-4 py-2.5 bg-slate-900/70 border-b border-slate-800/80">
          {SCAN_STEPS.map((s, idx) => {
            const isDone = Boolean(capturedSummary[s.face]);
            const isCurrent = idx === stepIdx;
            return (
              <button
                key={s.face}
                type="button"
                disabled={idx > stepIdx && !isDone}
                onClick={() => {
                  if (idx <= stepIdx || isDone) {
                    lastSignatureRef.current = '';
                    stableStartTimeRef.current = 0;
                    setStabilityProgress(0);
                    setStepIdx(idx);
                  }
                }}
                className={`py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-semibold flex flex-col items-center gap-0.5 transition-all ${
                  isCurrent
                    ? 'bg-sky-500/25 text-sky-200 ring-2 ring-sky-400 font-bold'
                    : isDone
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/25'
                    : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-1">
                  <span
                    style={{ backgroundColor: COLOR_TO_HEX_STRING[s.face] }}
                    className="w-2 h-2 rounded-full border border-white/40 inline-block"
                  />
                  <span>{s.face}</span>
                </span>
                <span className="text-[9px] opacity-80">
                  {isDone ? '✓ 已录' : isCurrent ? '扫描中' : `${idx + 1}/6`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Orientation & Flip Diagram Banner */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/60 border-b border-slate-800 flex items-center gap-3">
          {/* Mini Cube Orientation Visual Diagram */}
          <div className="flex flex-col items-center shrink-0 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-700/70">
            <div className="flex items-center gap-1 text-[9px] text-slate-300 mb-0.5">
              <span
                style={{ backgroundColor: COLOR_TO_HEX_STRING[currentStep.topEdgeColor] }}
                className="w-2 h-2 rounded-sm border border-white/40"
              />
              <span>上:{FACE_TO_COLOR_NAME[currentStep.topEdgeColor]}</span>
            </div>
            <div
              style={{ backgroundColor: COLOR_TO_HEX_STRING[currentStep.face] }}
              className="w-7 h-7 rounded-md border-2 border-white shadow-md flex items-center justify-center text-[10px] font-black text-black/80"
            >
              {currentStep.face}
            </div>
            <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5">
              <span
                style={{ backgroundColor: COLOR_TO_HEX_STRING[currentStep.bottomEdgeColor] }}
                className="w-2 h-2 rounded-sm border border-white/40"
              />
              <span>下:{FACE_TO_COLOR_NAME[currentStep.bottomEdgeColor]}</span>
            </div>
          </div>

          {/* Step Direction Copy */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 rounded-md bg-sky-500 text-slate-950 font-bold text-[11px]">
                第 {stepIdx + 1}/6 面 · {currentStep.label}
              </span>
              <span className="text-xs font-semibold text-amber-300">
                {currentStep.centerColorZh}（{currentStep.topHint}）
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {currentStep.flipInstruction}
            </p>
          </div>
        </div>

        {/* Live Video Stream + Centered 3x3 Target Grid */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950 overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Capture Shutter Flash */}
          {flashActive && (
            <div className="absolute inset-0 bg-white/60 pointer-events-none z-30 transition-opacity" />
          )}

          {/* 3x3 Grid Sampler Overlay */}
          {cameraStatus === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div
                ref={gridRef}
                className="relative w-52 h-52 sm:w-64 sm:h-64 grid grid-cols-3 grid-rows-3 gap-1.5 p-1.5 rounded-2xl border-2 border-cyan-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.55),0_0_25px_rgba(34,211,238,0.5)]"
              >
                {Array.from({ length: 9 }).map((_, idx) => {
                  const previewFace = previewFaces[idx] || 'U';
                  const hex = COLOR_TO_HEX_STRING[previewFace];
                  const isCenterCell = idx === 4;

                  return (
                    <div
                      key={idx}
                      className={`relative rounded-lg border flex items-center justify-center ${
                        isCenterCell
                          ? 'border-white/90 bg-white/5 ring-1 ring-cyan-300/60'
                          : 'border-white/55'
                      }`}
                    >
                      {/* Corner Live Detected Color Preview Dot */}
                      <span
                        style={{ backgroundColor: hex }}
                        className="absolute top-1 left-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md"
                        title={`识别预览: ${FACE_TO_COLOR_NAME[previewFace]}`}
                      />

                      {/* Tiny Center Sampling Reticle */}
                      <span className="w-1.5 h-1.5 rounded-full bg-white/75 shadow" />

                      {isCenterCell && (
                        <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-cyan-200 drop-shadow">
                          中心
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Stability Auto-Capture Progress Bar */}
              {autoCapture && (
                <div className="mt-3 w-52 sm:w-64 bg-slate-900/90 rounded-full p-1 border border-cyan-400/40 shadow-lg">
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${stabilityProgress}%` }}
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-75"
                    />
                  </div>
                  <div className="text-[10px] text-center text-cyan-200 mt-0.5 font-medium">
                    {stabilityProgress > 15
                      ? `保持稳定自动录入中 ${stabilityProgress}%`
                      : '请将魔方色块对准 9 个方格保持 0.8s'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {cameraStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 z-20">
              <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-300">正在唤醒摄像头，请允许浏览器访问权限...</span>
            </div>
          )}

          {/* Error State */}
          {cameraStatus === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-20">
              <div className="text-3xl mb-2">📷❌</div>
              <h3 className="text-sm font-bold text-rose-300 mb-1.5">无法打开摄像头</h3>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed mb-4">
                {errorMessage}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs cursor-pointer hover:brightness-110"
                >
                  🔁 重试连接
                </button>
                <button
                  type="button"
                  onClick={handleSafeClose}
                  className="px-4 py-2 rounded-xl glass-button text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  返回手动点选涂色
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls Bar */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col gap-2.5">
          {/* Auto-capture Toggle & Shortcut Hint */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={autoCapture}
                onChange={(e) => {
                  setAutoCapture(e.target.checked);
                  lastSignatureRef.current = '';
                  stableStartTimeRef.current = 0;
                  setStabilityProgress(0);
                }}
                className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
              />
              <span className="font-medium">稳定后自动录入</span>
              <span className="text-[10px] text-slate-400">(连续 0.8s 不变自动拍照)</span>
            </label>

            <span className="hidden sm:inline text-[11px] text-slate-400">
              快捷键：<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">空格</kbd> 拍照
            </span>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleRetakePrev}
              disabled={stepIdx === 0}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 glass-button ${
                stepIdx === 0
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : 'text-slate-200 hover:text-white cursor-pointer'
              }`}
            >
              <span>↩️</span>
              <span>重拍上一面</span>
            </button>

            <button
              type="button"
              onClick={captureCurrentFace}
              disabled={cameraStatus !== 'ready'}
              className={`col-span-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg ${
                cameraStatus === 'ready'
                  ? 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 cursor-pointer active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>📸</span>
              <span>
                {stepIdx === 5 ? '拍照录入最后一面并完成识别' : `拍照录入 ${currentStep.label} (空格)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
