import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Send, Sparkles, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';

export interface CallLine {
  id: string;
  mine: boolean;
  name: string;
  text: string;
  narration?: boolean;
}

interface CallScreenProps {
  incoming?: boolean;
  onMissed?: () => void;
  mode: 'voice' | 'video';
  peerName: string;
  peerAvatar: string;
  myName: string;
  myAvatar: string;
  lines: CallLine[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onGenerate: () => void;
  generating: boolean;
  canSend: boolean;
  error: string;
  /** 对方“接听”的那一刻，用来计算通话时长 */
  onConnected: (at: number) => void;
  onEnd: () => void;
}

const formatDuration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/** 语音 / 视频通话页：先“呼叫”，对方接听后开始计时；对话仍然是文字，会记进聊天。 */
export const CallScreen: React.FC<CallScreenProps> = ({
  incoming = false,
  onMissed,
  mode,
  peerName,
  peerAvatar,
  myName,
  myAvatar,
  lines,
  draft,
  onDraftChange,
  onSend,
  onGenerate,
  generating,
  canSend,
  error,
  onConnected,
  onEnd,
}) => {
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [showConnectedHint, setShowConnectedHint] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const missedHandler = useRef(onMissed);
  useEffect(() => { missedHandler.current = onMissed; }, [onMissed]);

  // 呼叫 1.5~2.5 秒后“对方接听”
  useEffect(() => {
    if (incoming) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setConnectedAt(now);
      setShowConnectedHint(true);
      onConnected(now);
    }, 1500 + Math.random() * 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!incoming || connectedAt !== null) return;
    const timer = window.setTimeout(() => missedHandler.current?.(), 45_000);
    return () => window.clearTimeout(timer);
  }, [incoming, connectedAt]);

  useEffect(() => {
    if (connectedAt === null) return undefined;
    const tick = window.setInterval(() => setSeconds(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    const hint = window.setTimeout(() => setShowConnectedHint(false), 3800);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hint);
    };
  }, [connectedAt]);

  const connected = connectedAt !== null;
  const video = mode === 'video';
  const hintText = !connected
    ? incoming ? `${peerName}邀请你${video ? '视频' : '语音'}通话` : `正在等待${peerName}接听…`
    : showConnectedHint
      ? `${peerName}已接听`
      : formatDuration(seconds);
  const hintClass = video ? 'bg-black/25 text-white/85' : 'bg-white/45 text-slate-400';

  const peerPicture = (size: string, rounded: string) =>
    peerAvatar ? (
      <img src={peerAvatar} alt="" className={`${size} ${rounded} object-cover shadow-xl ring-4 ring-white/70`} />
    ) : (
      <div className={`flex ${size} ${rounded} items-center justify-center bg-white/70 text-4xl font-bold text-[#7E9BB3] shadow-xl ring-4 ring-white/70`}>
        {peerName.charAt(0) || '?'}
      </div>
    );

  return (
    <div className={`absolute inset-0 z-[80] flex flex-col overflow-hidden ${video ? 'text-white' : 'text-slate-600'} bg-gradient-to-b from-[#d9e8f7] via-[#ece2f4] to-[#fadde8]`}>
      {peerAvatar && <img src={peerAvatar} alt="" className={`pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-2xl ${video ? 'opacity-70' : 'opacity-25'}`} />}
      {video && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45" />}

      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top,0px),16px)]">
        <div>
          <h2 className="text-sm font-bold">{video ? '视频通话' : '语音通话'}</h2>
          <p className={`text-[10px] ${video ? 'text-white/70' : 'text-slate-400'}`}>
            {connected ? `通话中 ${formatDuration(seconds)}` : incoming ? '来电邀请' : '呼叫中'}
          </p>
        </div>
        {video && (
          <div className="flex h-28 w-20 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/60 bg-white/25 shadow-lg backdrop-blur-md">
            {!cameraOff && myAvatar ? (
              <img src={myAvatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-base font-bold text-[#6F8CA0]">
                  {myName.charAt(0) || '我'}
                </span>
                <span className="mt-1 text-[9px] text-white/80">{cameraOff ? '摄像头已关' : '我'}</span>
              </>
            )}
          </div>
        )}
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-6">
        <div className="relative">
          {!connected && <span className="absolute inset-0 animate-ping rounded-full bg-white/50" />}
          {peerPicture(video ? 'h-32 w-32' : 'h-28 w-28', video ? 'rounded-[34%]' : 'rounded-full')}
        </div>
        <p className="text-lg font-semibold">{peerName}</p>
        <p className={`rounded-full px-3 py-1 text-[11px] transition-all ${hintClass}`}>{hintText}</p>
        {connected && !showConnectedHint && (
          <p className={`text-[10px] ${video ? 'text-white/55' : 'text-slate-300'}`}>文字模拟通话 · 对话会记进聊天</p>
        )}
      </div>

      <div className="relative z-10 max-h-[30%] space-y-1.5 overflow-y-auto px-4 pb-2">
        {lines.map((line) => (
          <p
            key={line.id}
            className={`max-w-[82%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed backdrop-blur-md ${
              line.narration
                ? `mx-auto bg-white/25 text-center italic ${video ? 'text-white/80' : 'text-slate-500'}`
                : line.mine
                ? 'ml-auto bg-[#fbd5e3]/85 text-[#7a5568]'
                : video ? 'bg-black/30 text-white' : 'bg-white/75 text-slate-600'
            }`}
          >
            {line.narration && <span className="mr-1 font-semibold not-italic">【旁白】</span>}
            {line.text}
          </p>
        ))}
      </div>

      {error && <p role="alert" className="relative z-10 px-4 pb-1 text-center text-[10px] text-rose-400">{error}</p>}

      {canSend && (!incoming || connected) && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (connected) onSend();
          }}
          className="relative z-10 flex items-center gap-2 px-4 pb-2"
        >
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={!connected}
            placeholder={connected ? '说点什么…' : '等待接通…'}
            aria-label="通话中输入消息"
            className={`min-w-0 flex-1 rounded-full border px-4 py-2.5 text-xs outline-none disabled:opacity-60 ${
              video ? 'border-white/40 bg-black/25 text-white placeholder:text-white/60' : 'border-white bg-white/75 text-slate-600 placeholder:text-slate-300'
            }`}
          />
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            aria-label="发送"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f5c6d6] to-[#bfd9f0] text-[#5f6f7e] shadow disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!connected || generating}
            onClick={onGenerate}
            aria-label="让对方回复"
            className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-white bg-white/70 px-3 text-[11px] font-semibold text-[#6F8CA0] disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />{generating ? '回复中' : '回复'}
          </button>
        </form>
      )}

      <div className="relative z-10 flex items-center justify-center gap-7 pb-[max(env(safe-area-inset-bottom,0px),18px)] pt-2">
        {(!incoming || connected) && <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? '取消静音' : '静音'}
          className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md ${muted ? 'border-white bg-white text-slate-500' : video ? 'border-white/40 bg-black/25 text-white' : 'border-white bg-white/60 text-slate-500'}`}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>}
        {incoming && !connected && (
          <button
            type="button"
            aria-label="接通来电"
            onClick={() => {
              const now = Date.now();
              setConnectedAt(now);
              setShowConnectedHint(true);
              onConnected(now);
            }}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full bg-emerald-400 text-white shadow-lg shadow-emerald-400/30 active:scale-95"
          >
            {video ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            <span className="text-[10px]">接通</span>
          </button>
        )}
        <button
          type="button"
          onClick={onEnd}
          aria-label={incoming && !connected ? '拒绝来电' : '挂断'}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f26f86] text-white shadow-lg active:scale-95"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
        {(!incoming || connected) && (video ? (
          <button
            type="button"
            onClick={() => setCameraOff((value) => !value)}
            aria-label={cameraOff ? '打开摄像头' : '关闭摄像头'}
            className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md ${cameraOff ? 'border-white bg-white text-slate-500' : 'border-white/40 bg-black/25 text-white'}`}
          >
            {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSpeakerOn((value) => !value)}
            aria-label={speakerOn ? '关闭免提' : '打开免提'}
            className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md ${speakerOn ? 'border-white bg-white text-[#6F8CA0]' : 'border-white bg-white/60 text-slate-500'}`}
          >
            {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        ))}
      </div>
    </div>
  );
};
