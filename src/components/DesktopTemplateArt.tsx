import { useId } from 'react';
import { Heart, Music2, Sparkles } from 'lucide-react';
import type { DesktopWidgetTemplate } from '../utils/freeDesktop';

const heartPath = 'M100 177C85 164 10 121 10 66C10 12 74 7 100 48C126 7 190 12 190 66C190 121 115 164 100 177Z';
const cloudPath = 'M49 149C-8 150-10 73 43 65C37 10 111 2 132 43C173 13 219 47 211 84C258 102 244 151 204 149Z';

export function TemplateBow() {
  return <svg className="free-template-bow" viewBox="0 0 110 72" aria-hidden="true">
    <path d="M47 29 30 67 46 58 55 68 60 32M60 29 71 67 81 56 96 62 68 26" fill="#dca8b7" stroke="#fff4f5" strokeWidth="2"/>
    <path d="M52 24C30-2 4 4 11 32 14 48 38 40 54 29M60 24C84-2 108 4 100 32 96 48 74 40 59 29" fill="#edc6d0" stroke="#fff4f5" strokeWidth="3"/>
    <path d="M19 19 47 27M92 19 66 27" fill="none" stroke="#d4a0b2" strokeWidth="2"/>
    <rect x="48" y="19" width="17" height="19" rx="6" fill="#dca8b7" stroke="#fff4f5" strokeWidth="2"/>
  </svg>;
}

export function TemplateHeart({ image, backgroundImage }: { image?: string; backgroundImage?: string }) {
  const id = `heart-${useId()}`;
  return <svg className="free-template-heart" viewBox="0 0 200 185" aria-hidden="true">
    <defs><clipPath id={id}><path d={heartPath}/></clipPath></defs>
    <path d={heartPath} fill="var(--template-paper,#fff8f4)"/>
    {backgroundImage && <image href={backgroundImage} x="0" y="0" width="200" height="185" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/>}
    {image ? <image href={image} x="0" y="0" width="200" height="185" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/> :
      <g fill="#d7aabb"><path d="M100 116C94 110 75 99 75 85C75 68 94 68 100 79C107 68 125 68 125 85C125 99 106 110 100 116Z"/><text x="100" y="139" textAnchor="middle" fontSize="8" letterSpacing="2">YOUR PHOTO</text></g>}
    <path d={heartPath} fill="none" stroke="#fffdfb" strokeWidth="7"/>
    <path d={heartPath} fill="none" stroke="#d8b8c0" strokeWidth="1.5" strokeDasharray="2 5"/>
  </svg>;
}

export function TemplateCloud({ backgroundImage }: { backgroundImage?: string }) {
  const id = `cloud-${useId()}`;
  return <svg className="free-template-cloud" viewBox="0 0 240 160" preserveAspectRatio="none" aria-hidden="true">
    <defs><clipPath id={id}><path d={cloudPath}/></clipPath></defs>
    <path d={cloudPath} fill="var(--template-paper,#f0f5fa)"/>
    {backgroundImage && <image href={backgroundImage} width="240" height="160" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`}/>}
    <path d={cloudPath} fill="none" stroke="#fff" strokeWidth="3"/>
  </svg>;
}

export function DesktopTemplateThumbnail({ template }: { template: DesktopWidgetTemplate }) {
  return <span className="free-template-thumbnail" data-template={template} aria-hidden="true">
    {template === 'heart' ? <TemplateHeart/> : template === 'bow' ? <><span className="free-thumb-polaroid"><Sparkles size={24}/></span><TemplateBow/></> :
      template === 'ticket' ? <span className="free-thumb-ticket"><i/><Heart size={12}/><i/></span> :
      template === 'vinyl' ? <span className="free-thumb-record"><Music2 size={20}/></span> :
      <><TemplateCloud/><span className="free-thumb-clock">10:24</span></>}
  </span>;
}
