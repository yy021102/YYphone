import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Heart, MoreHorizontal, Plus, Send, Smile, Volume2 } from 'lucide-react';
import type { ChatAppearance } from '../utils/chatAppearance';
import { avatarFrameWrapStyle } from '../utils/avatarFrame';
import { hexToRgba } from './ColorWheel';
import { ChatPaymentCard } from './ChatPaymentCard';

const BASE = `
* { box-sizing: border-box; } html,body,#preview-root { margin: 0; width: 100%; height: 100%; }
body { font-family: "PingFang SC","Microsoft YaHei",sans-serif; font-size: 14px; }
button,input { font: inherit; } button { border: 0; cursor: default; } p { margin: 0; } svg { flex-shrink: 0; }
.wechat-app { --font-scale: 1; --yy-chat-avatar-size: var(--yy-theme-avatar-size,40px); display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden; background: #ededed; color: #111; }
.yy-wechat-header { display: flex; align-items: center; gap: 12px; padding: 12px; flex-shrink: 0; }
.yy-header-title { flex: 1; text-align: center; font-size: 17px; font-weight: 600; }
.yy-header-back,.yy-header-action button { display: flex; padding: 0; background: transparent; color: inherit; }
.yy-chat-surface { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.yy-chat-history { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; padding: 16px 12px; background-image: var(--yy-chat-wallpaper,none); background-size: cover; background-position: center; background-attachment: scroll; }
.yy-chat-history > * + * { margin-top: 20px; } .yy-chat-timestamp { font-size: 10px; text-align: center; color: #999; }
.yy-chat-quote { align-self: flex-start; width: max-content; max-width: 100%; margin-top: 5px; padding: 6px 10px; border: 1px solid #e1e1e1b3; border-radius: 4px; background: #f5f5f5e0; color: #888; font-size: 12px; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .yy-chat-quote.is-user { align-self: flex-end; }
.wechat-app[data-wechat-theme="dark"] .yy-chat-quote { background: #282828; color: #aaa; border-color: #353535; }
.yy-chat-message-row { display: flex; gap: 12px; align-items: flex-start; } .flex-row-reverse { flex-direction: row-reverse; }
.yy-chat-avatar { display: flex; align-items: center; justify-content: center; width: var(--yy-chat-avatar-size); height: var(--yy-chat-avatar-size); border-radius: 4px; flex-shrink: 0; background: #dce9ef; color: #657c90; overflow: hidden; font-size: 14px; }
.yy-chat-avatar > span { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: inherit; overflow: hidden; } .yy-chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
.yy-chat-message-content { display: flex; flex-direction: column; min-width: 0; max-width: calc(100% - var(--yy-chat-avatar-size) * 2 - 24px); }
.yy-chat-message-bubble { position: relative; padding: 8px 12px; font-size: 16px; line-height: 1.5; border-radius: 4px; overflow-wrap: anywhere; color: #111; }
.yy-chat-message-bubble:not(.is-special) { background-color: var(--yy-character-bubble-color); } .yy-chat-message-bubble.is-user:not(.is-special) { background-color: var(--yy-user-bubble-color); }
.yy-chat-message-bubble.is-plain::before { content: ''; position: absolute; top: 14px; left: -5px; width: 10px; height: 10px; background: inherit; transform: rotate(45deg); border-radius: 1px; } .yy-chat-message-bubble.is-user::before { left: auto; right: -5px; }
.yy-chat-voice-message { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-width: 105px; } .yy-chat-voice-duration { font-size: 12px; }
.yy-chat-message-bubble.is-payment { width: 244px; max-width: 100%; padding: 0; }
.yy-chat-payment-card { --payment-color: #fa9d3b; display: block; position: relative; width: 100%; border-radius: 4px; background: var(--payment-color); color: #fff; text-align: left; padding: 0; }
.yy-chat-payment-card.is-settled { --payment-color: #f5c795; } .yy-chat-payment-card::before { content: ''; position: absolute; top: 16px; left: -5px; width: 10px; height: 10px; background: var(--payment-color); transform: rotate(45deg); } .is-user > .yy-chat-payment-card::before { left: auto; right: -5px; }
.yy-chat-payment-main { display: flex; align-items: center; gap: 10px; padding: 12px; min-height: 76px; } .yy-chat-payment-icon { width: 40px; height: 44px; flex-shrink: 0; } .yy-chat-payment-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.yy-chat-payment-title { font-size: 16px; line-height: 1.4; } .yy-chat-payment-title.is-amount { font-size: 19px; } .yy-chat-payment-status { font-size: 12px; opacity: .9; } .yy-chat-payment-footer { display: block; border-top: 1px solid #ffffff26; padding: 4px 10px; font-size: 10px; opacity: .85; }
.yy-chat-composer { display: flex; align-items: center; flex-shrink: 0; background: #f7f7f7; color: #191919; border-top: 1px solid #dcdcdc; padding: 8px; gap: 8px; }
.yy-chat-composer button { display: flex; align-items: center; justify-content: center; width: 28px; height: 32px; padding: 0; flex-shrink: 0; background: transparent; color: inherit; }
.yy-chat-input { min-width: 0; width: 100%; flex: 1; background: white; border: 0; border-radius: 5px; padding: 8px 12px; font-size: 16px; }
.yy-chat-attachments { order: 0; } .yy-chat-input { order: 1; } .yy-chat-emoji { order: 2; } .yy-chat-generate,.yy-chat-send { order: 3; } .yy-chat-composer img { width: 24px; height: 24px; object-fit: contain; }
.wechat-app[data-wechat-theme=dark] { background: #181818; color: #eee; }
.wechat-app[data-wechat-theme=dark] .yy-wechat-header,.wechat-app[data-wechat-theme=dark] .yy-chat-composer { background: #202020; color: #ddd; border-color: #333; }
.wechat-app[data-wechat-theme=dark] .yy-chat-message-bubble { color: #eee; } .wechat-app[data-wechat-theme=dark] .yy-chat-input { background: #303030; color: #eee; }
`;
const DOCUMENT = `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${BASE}</style></head><body><div id="preview-root"></div></body></html>`;

export function WeChatAppearancePreview({ appearance, compiledCss, dark, tall = false, userAvatar, userName = '我' }: {
  appearance: ChatAppearance; compiledCss: string; dark: boolean; tall?: boolean; userAvatar?: string; userName?: string;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [input, setInput] = useState('');
  const userColor = dark ? '#20b565' : hexToRgba(appearance.userBubbleColor, appearance.userBubbleOpacity ?? 1);
  const charColor = dark ? '#2c2c2c' : hexToRgba(appearance.characterBubbleColor, appearance.characterBubbleOpacity ?? 1);
  const avatar = (own: boolean) => <span className="yy-chat-avatar" style={avatarFrameWrapStyle(dark ? undefined : own ? appearance.userAvatarFrame : appearance.characterAvatarFrame)}><span>{own && userAvatar ? <img src={userAvatar} alt="" /> : own ? userName.slice(0, 1) : 'TA'}</span></span>;
  const row = (id: string, own: boolean, content: React.ReactNode, kind = 'is-plain', quote?: string) => <div key={id} className={`yy-chat-message-row flex ${own ? 'flex-row-reverse' : ''}`}>
    {avatar(own)}<div className="yy-chat-message-content" style={{ alignItems: own ? 'flex-end' : 'flex-start' }}><div className={`yy-chat-message-bubble ${own ? 'is-user' : 'is-character'} ${kind}`}>{content}</div>{quote && <div className={`yy-chat-quote ${own ? 'is-user' : 'is-character'}`}>{quote}</div>}</div>
  </div>;
  return <div className="wechat-workshop-preview">
    <iframe title="聊天美化实时预览" sandbox="allow-same-origin" srcDoc={DOCUMENT} style={{ height: tall ? 560 : 300 }}
      onLoad={e => setTarget(e.currentTarget.contentDocument?.getElementById('preview-root') ?? null)} />
    {target && createPortal(<>
      <style>{dark ? '' : compiledCss}</style>
      <div className="wechat-app wechat-chat-open" data-wechat-theme={dark ? 'dark' : 'light'}>
        <header className="yy-wechat-header"><button className="yy-header-back" aria-label="预览返回"><ArrowLeft size={22} /></button><span className="yy-header-title">聊天预览</span><span className="yy-header-action"><button aria-label="预览设置"><MoreHorizontal size={22} /></button></span></header>
        <div className="yy-chat-surface" style={{ '--yy-user-bubble-color': userColor, '--yy-character-bubble-color': charColor,
          '--yy-chat-wallpaper': !dark && appearance.backgroundUrl ? `linear-gradient(rgba(243,246,250,.38),rgba(243,246,250,.38)),url("${appearance.backgroundUrl.replaceAll('"', '%22')}")` : 'none' } as React.CSSProperties}>
          <div className="yy-chat-history">
            <p className="yy-chat-timestamp">今天 16:20</p>
            {row('short', false, '今天也想和你说说话')}
            {row('reply', true, '好呀，慢慢说 🌷', 'is-plain', 'TA：今天也想和你说说话')}
            {row('long', false, '有些好看的风景，想留给你一起看。长一点的消息也要好好换行，留出对面头像的位置。')}
            {row('voice', true, <span className="yy-chat-voice-message"><span className="yy-chat-voice-duration">12″</span><Volume2 size={23} /></span>, 'is-plain is-voice')}
            {row('packet', false, <ChatPaymentCard kind="red-packet" text="把今天的好运分给你" outgoing={false} group={false} onOpen={() => {}} />, 'is-special is-payment')}
            {row('transfer', true, <ChatPaymentCard kind="transfer" text="" amount="52.00" status="received" outgoing group={false} onOpen={() => {}} />, 'is-special is-payment')}
          </div>
          <div className="yy-chat-composer"><button className="yy-chat-attachments" aria-label="预览加号"><Plus size={25} /></button><input className="yy-chat-input" aria-label="预览输入框" value={input} maxLength={100} onChange={e => setInput(e.target.value)} placeholder="输入消息" /><button className="yy-chat-emoji" aria-label="预览表情"><Smile size={25} /></button>{input.trim() ? <button className="yy-chat-send" aria-label="预览发送" onClick={() => setInput('')}>{!dark && appearance.sendIconUrl ? <img src={appearance.sendIconUrl} alt="" /> : <Send size={23} />}</button> : <button className="yy-chat-generate" aria-label="预览生成">{!dark && appearance.generateIconUrl ? <img src={appearance.generateIconUrl} alt="" /> : <Heart size={23} />}</button>}</div>
        </div>
      </div>
    </>, target)}
  </div>;
}
