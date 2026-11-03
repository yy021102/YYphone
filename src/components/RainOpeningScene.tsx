import { useEffect, useRef, useState } from 'react';
import { openingMedia } from '../utils/phoneOpening';

export function RainOpeningScene({ reducedMotion, leaving, onReady, onEnded }: {
  reducedMotion: boolean;
  leaving: boolean;
  onReady: (mode: 'playing' | 'static') => void;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const deadlineRef = useRef<number | undefined>(undefined);
  const leavingRef = useRef(leaving); leavingRef.current = leaving;
  const readyRef = useRef(onReady); readyRef.current = onReady;
  const endedRef = useRef(onEnded); endedRef.current = onEnded;
  const [mode, setMode] = useState<'loading' | 'playing' | 'static'>('loading');
  const [notice, setNotice] = useState('');
  const [posterFailed, setPosterFailed] = useState(false);
  const media = openingMedia();

  useEffect(() => {
    if (!leaving) return;
    window.clearTimeout(deadlineRef.current);
    controllerRef.current?.abort();
    videoRef.current?.pause();
  }, [leaving]);

  useEffect(() => {
    setNotice('');
    if (reducedMotion) {
      setMode('static'); readyRef.current('static');
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    let disposed = false, failed = false, objectUrl: string | undefined;
    setMode('loading');
    const release = () => {
      video.pause(); video.removeAttribute('src'); video.load();
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = undefined; }
    };
    const fail = (error: unknown) => {
      if (disposed || failed || leavingRef.current) return;
      failed = true; window.clearTimeout(deadlineRef.current); controller.abort();
      console.error('Could not play the rain opening video.', error);
      release(); setMode('static');
      setNotice('雨窗视频暂时无法播放，已显示静态封面。');
      readyRef.current('static');
    };
    const playing = () => {
      if (disposed || failed || leavingRef.current) return;
      window.clearTimeout(deadlineRef.current);
      setMode('playing'); readyRef.current('playing');
    };
    const ended = () => { if (!disposed && !failed) endedRef.current(); };
    const error = () => fail(new Error(video.error?.message || '浏览器无法解码雨窗视频。'));
    const visibility = () => {
      if (document.hidden) video.pause();
      else if (!disposed && !failed && !leavingRef.current && video.src) void video.play().catch(fail);
    };
    video.addEventListener('playing', playing);
    video.addEventListener('ended', ended);
    video.addEventListener('error', error);
    document.addEventListener('visibilitychange', visibility);
    deadlineRef.current = window.setTimeout(() => fail(new Error('Rain opening media readiness timed out.')), 4500);
    void (async () => {
      try {
        // A full response can be cached for offline playback; blob URLs avoid partial-range cache issues.
        const response = await fetch(media.video, { signal: controller.signal, cache: 'force-cache' });
        if (!response.ok) throw new Error(`Rain opening request failed (${response.status}).`);
        const blob = await response.blob();
        if (disposed || failed || leavingRef.current) return;
        if (!blob.size || !['video/mp4', 'application/octet-stream'].includes(blob.type.split(';')[0])) throw new Error('雨窗视频文件无效。');
        objectUrl = URL.createObjectURL(blob);
        video.muted = true; video.src = objectUrl;
        if (document.hidden) {
          window.clearTimeout(deadlineRef.current);
          setMode('static'); readyRef.current('static');
        } else await video.play();
      } catch (caught) {
        if (!disposed && !leavingRef.current && !failed) fail(caught);
      }
    })();
    return () => {
      disposed = true; window.clearTimeout(deadlineRef.current); controller.abort();
      controllerRef.current = null;
      video.removeEventListener('playing', playing);
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', error);
      document.removeEventListener('visibilitychange', visibility);
      release();
    };
  }, [reducedMotion, media.video]);

  return <div className="yy-rain-scene" data-mode={mode}>
    <img className="yy-rain-poster" src={media.poster} alt="" aria-hidden="true" onError={() => {
      console.error('Could not load the rain opening poster.');
      setPosterFailed(true);
    }} />
    {!reducedMotion && <video ref={videoRef} className="yy-rain-video" muted playsInline preload="auto" disablePictureInPicture aria-hidden="true" />}
    <div className="yy-rain-vignette" aria-hidden="true" />
    {(notice || posterFailed && mode === 'static') && <p className="yy-rain-notice" role="status">
      {posterFailed ? '开场素材暂时无法加载，可轻点画面进入。' : notice}
    </p>}
  </div>;
}
