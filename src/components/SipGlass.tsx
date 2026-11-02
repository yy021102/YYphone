import { useId } from 'react';
import { sipCup, sipIce, sipIngredient, sipMixedColor, sipPartsAtStage, type SipCupId, type SipRecipe } from '../utils/littleSip';

const cupShapes:Record<SipCupId,{x:number;y:number;w:number;h:number;path:string;stem?:boolean;straw?:boolean;handle?:boolean}>={
  tall:{x:76,y:65,w:148,h:230,path:'M76 65H224L211 281Q210 296 196 296H104Q90 296 89 281Z',straw:true},
  round:{x:62,y:108,w:176,h:187,path:'M62 108H238L229 258Q224 293 191 295H109Q76 293 71 258Z',straw:true},
  goblet:{x:66,y:65,w:168,h:162,path:'M66 65H234C233 154 211 215 150 227C89 215 67 154 66 65Z',stem:true},
  martini:{x:40,y:80,w:220,h:145,path:'M40 80H260L150 225Z',stem:true},
  rocks:{x:65,y:130,w:170,h:165,path:'M65 130H235L229 277Q228 295 210 295H90Q72 295 71 277Z'},
  coffee:{x:65,y:125,w:150,h:160,path:'M65 125H215L209 259Q207 285 182 285H98Q73 285 71 259Z',handle:true},
};

export default function SipGlass({ recipe, stage = 5, pouring = '' }: { recipe:SipRecipe; stage?:number; pouring?:string }) {
  const uid=useId().replace(/:/g,''), clip=`sip-clip-${uid}`, glass=`sip-glass-${uid}`;
  const {x,y,w,h,path,stem,straw,handle}=cupShapes[recipe.cupId],center=x+w/2;
  const parts=sipPartsAtStage(recipe,stage);
  const liquids=parts.filter(p=>sipIngredient(p.id).unit==='ml'), solids=parts.filter(p=>sipIngredient(p.id).unit==='g'&&sipIngredient(p.id).group!=='garnish');
  const garnishes=parts.filter(p=>sipIngredient(p.id).group==='garnish'),rimFruit=garnishes.filter(p=>p.id!=='ice-cream');
  const capacity=sipCup(recipe.cupId).capacity, liquid=liquids.reduce((n,p)=>n+p.amount,0);
  const solid=solids.reduce((n,p)=>n+p.amount,0), ice=stage>=3?sipIce(recipe):0;
  const fill=Math.min(.94,(liquid+solid+ice)/capacity)*h, top=y+h-fill;
  let bottom=y+h;
  return <figure className={`sip-glass ${pouring?'sip-is-pouring':''} ${stage>=5&&recipe.finish==='stirred'?'sip-is-stirred':''}`}>
    <svg viewBox="0 0 300 355" role="img" aria-label={`${sipCup(recipe.cupId).name}中的${recipe.name||'制作中饮品'}，${stage>=2?liquid:0}ml饮料${stage>=1?`，${solid}g小料`:''}${stage>=3?`，${recipe.ice==='none'?'不加冰':recipe.ice==='light'?'少冰':'正常冰'}`:''}${garnishes.length?`，顶部装饰：${garnishes.map(p=>sipIngredient(p.id).name).join('、')}`:''}`}>
      <defs><clipPath id={clip}><path d={path}/></clipPath><linearGradient id={glass} x1="0" x2="1"><stop stopColor="#ffffff" stopOpacity=".5"/><stop offset=".25" stopColor="#fff" stopOpacity=".04"/><stop offset=".9" stopColor="#d1e4dc" stopOpacity=".12"/><stop offset="1" stopColor="#fff" stopOpacity=".5"/></linearGradient></defs>
      <ellipse cx="150" cy="324" rx="91" ry="12" fill="#b9cbbd" opacity=".23"/>
      {stem&&<><path d="M150 225V305M117 315Q150 297 183 315" fill="none" stroke="#adbfba" strokeWidth="5" strokeLinecap="round"/><ellipse cx="150" cy="317" rx="36" ry="5" fill="#edf4ee" stroke="#adbfba"/></>}
      {handle&&<><ellipse cx="140" cy="306" rx="98" ry="9" fill="#f3e7dd" stroke="#cfbcb0"/><path d="M215 155C278 141 279 230 212 235" fill="none" stroke="#b5c5b9" strokeWidth="13"/><path d="M215 155C278 141 279 230 212 235" fill="none" stroke="#f7faf1" strokeWidth="8"/></>}
      <g clipPath={`url(#${clip})`}>
        <path d={path} fill="#ffffff" fillOpacity=".2"/>
        {liquid>0&&(stage>=5&&recipe.finish==='stirred'?<rect className="sip-fluid" x="24" y={top} width="252" height={fill} fill={sipMixedColor(liquids)} opacity=".88"/>:
          liquids.map(p=>{const amount=fill*p.amount/liquid;bottom-=amount;return <rect className="sip-fluid" key={p.id} x="24" y={bottom} width="252" height={amount+1} fill={sipIngredient(p.id).color} opacity=".87"/>;}))}
        {solids.map((p,index)=>{const item=sipIngredient(p.id),count=Math.max(2,Math.min(25,Math.round(p.amount/2)));
          return <g key={p.id}>{Array.from({length:count},(_,i)=>{const py=y+h-16-Math.floor(i/6)*10-index*4;
            const half=recipe.cupId==='martini'?Math.max(3,(y+h-py)/h*w/2-6):recipe.cupId==='goblet'?Math.max(8,Math.sqrt(Math.max(0,1-((py-y)/h)**2))*w/2-12):w/2-20;
            const px=center-half+((i*37+index*17)%(half*2));
            if(item.shape==='leaf')return <ellipse key={i} cx={px} cy={py-10} rx="5" ry="11" fill={item.color} transform={`rotate(${i*29} ${px} ${py-10})`}/>;
            if(item.shape==='fruit')return item.id==='lemon'?<g key={i} transform={`translate(${px} ${py-8}) rotate(${i*23})`}><circle r="11" fill={item.color}/><circle r="8" fill="#f8efbc"/><path d="M-7 0H7M0-7V7M-5-5L5 5M-5 5L5-5" stroke={item.color}/></g>:<g key={i}><path d={`M${px-8} ${py-9}Q${px} ${py+12} ${px+8} ${py-9}Z`} fill={item.color}/><path d={`M${px-3} ${py-4}H${px-1}M${px+2} ${py}H${px+4}`} stroke="#f8e1ae" strokeWidth="1.5"/></g>;
            return item.shape==='cube'?<rect key={i} x={px-5} y={py-6} width="11" height="10" rx={item.id==='rice-mochi'?5:2} fill={item.color} stroke="#fff" strokeOpacity=".3" transform={`rotate(${i*17} ${px} ${py})`}/>:item.id==='purple-rice'?<ellipse key={i} cx={px} cy={py} rx="2" ry="4" fill={item.color} transform={`rotate(${i*31} ${px} ${py})`}/>:<g key={i}><circle cx={px} cy={py} r={item.id==='red-bean'?4:6} fill={item.color}/><circle cx={px-1.5} cy={py-2} r="1.5" fill="#fff" opacity=".28"/></g>;
          })}</g>;
        })}
        {ice>0&&liquid>0&&Array.from({length:recipe.ice==='light'?4:7},(_,i)=><rect key={i} className="sip-ice" x={x+16+(i*39)%(w-55)} y={Math.max(y+5,top+6+Math.floor(i/3)*17)} width="25" height="23" rx="5" fill="#f5fffb" fillOpacity=".45" stroke="#fff" strokeOpacity=".8" transform={`rotate(${i*13-20} ${x+30+(i*39)%(w-55)} ${Math.max(y+18,top+17+Math.floor(i/3)*17)})`}/>)}
        {liquids.some(p=>p.id==='soda')&&Array.from({length:13},(_,i)=><circle className="sip-bubble" key={i} cx={x+14+(i*31)%(w-28)} cy={top+14+(i*23)%Math.max(20,fill-25)} r={1.5+i%3} fill="#fff" opacity=".6"/>)}
        {liquid>0&&<ellipse className="sip-surface" cx={center} cy={top+2} rx={w/2} ry="4" fill="#fff" opacity=".22"/>}
      </g>
      <path d={path} fill={`url(#${glass})`} stroke="#a9bcb7" strokeWidth="2"/>
      <g clipPath={`url(#${clip})`}><path d={`M${x+9} ${y+16}L${x+18} ${y+h-34}`} stroke="#fff" strokeWidth="5" opacity=".65" strokeLinecap="round"/>
        <path d={`M${x+w-10} ${y+16}L${x+w-18} ${y+h-37}`} stroke="#fff" strokeWidth="2" opacity=".6" strokeLinecap="round"/>
        {recipe.cupId==='rocks'&&<path d="M83 146L88 281M109 146L112 281M135 146V281M162 146V281M189 146L186 281M215 146L209 281" stroke="#fff" strokeOpacity=".35" strokeWidth="3"/>}</g>
      <ellipse cx={center} cy={y} rx={w/2} ry="6" fill="#f9fcf8" fillOpacity=".2" stroke="#afc0bb"/>
      {straw&&<><path d={`M181 ${y+h-27}L222 30L241 23`} fill="none" stroke="#d3a7b3" strokeWidth="9" strokeLinecap="round"/><path d={`M179 ${y+h-27}L220 30L240 23`} fill="none" stroke="#f7e5e9" strokeWidth="2" opacity=".7"/></>}
      {garnishes.filter(p=>p.id==='ice-cream').map(p=><g key={p.id} data-sip-garnish={p.id} transform={`translate(${center} ${y-8}) scale(${.7+p.amount/100})`}>
        <ellipse rx="39" ry="10" cy="7" fill="#e1cfb1"/><path d="M-38 4C-42-10-25-25-12-22C-15-43 16-47 21-25C39-24 47-3 35 6Z" fill="#fff0d6" stroke="#dcc9a4" strokeWidth="1.5"/>
        <path d="M-25-7Q-8-16 5-6M-3-26Q9-31 16-20M11 1Q23-7 32-1" fill="none" stroke="#e9d8b8" strokeWidth="3" strokeLinecap="round"/>
      </g>)}
      {rimFruit.map((p,index)=>{const gx=[x+16,x+w-16,center-25,center+25][index],item=sipIngredient(p.id);
        return <g key={p.id} data-sip-garnish={p.id} transform={`translate(${gx} ${y-5})`}>
          {p.id==='lemon-peel'?<path d="M-10-20C23-30 20-7-2-9C-24-11-17 10 5 5C24 0 23 19 9 23" fill="none" stroke={item.color} strokeWidth="5" strokeLinecap="round"/>:
            Array.from({length:Math.min(3,Math.max(1,Math.ceil(p.amount/15)))},(_,i)=><g key={i} transform={`translate(${i*6} ${-i*4}) rotate(${i*12-12})`}>
              {p.id==='garnish-lemon'?<><circle r="19" fill={item.color} stroke="#cdb94d"/><circle r="15" fill="#faf0bd"/><path d="M-14 0H14M0-14V14M-10-10L10 10M-10 10L10-10" stroke={item.color} strokeWidth="2"/><path d="M0 4V20" stroke="#adbfba" strokeWidth="2"/></>:
                p.id==='apple-slice'?<><path d="M-20 8Q0-35 22 5Q0 24-20 8Z" fill="#fff0d3" stroke={item.color} strokeWidth="3"/><path d="M0-5L2 5" stroke="#a57e59" strokeWidth="2"/></>:
                  <><path d="M-15-10Q-23 4 0 26Q25 4 15-10Q0-19-15-10Z" fill={item.color} stroke="#bc6c78"/><path d="M-13-10L-6-18L0-12L7-20L13-10L0-7Z" fill="#7e9c69"/><path d="M-8 0L-6 3M5-1L7 2M0 10L2 13" stroke="#ffe5ab" strokeWidth="2"/></>}
            </g>)}
        </g>;
      })}
      {pouring&&<g key={pouring} className="sip-pour-stream"><path d={`M130 0V${y+25}`} stroke={sipIngredient(pouring).color} strokeWidth="9" strokeLinecap="round"/><circle cx="130" cy={y+30} r="7" fill={sipIngredient(pouring).color}/></g>}
      <path d="M45 73L48 82L57 85L48 88L45 97L42 88L33 85L42 82ZM252 235L254 241L260 243L254 245L252 251L250 245L244 243L250 241Z" fill="#c6bc96" opacity=".7"/>
    </svg>
    <figcaption>{stage===0?'挑一只喜欢的杯子':stage===1?'小料，先铺进杯底':stage===2?'把喜欢的风味，慢慢倒进来':stage===3?'加一点冰，留一点甜':stage===4?'在杯口，放一点漂亮心情':recipe.finish==='stirred'?'轻轻搅匀，风味相拥':'保留分层，慢慢品尝'}</figcaption>
  </figure>;
}
