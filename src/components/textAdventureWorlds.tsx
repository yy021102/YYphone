import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Backpack, BookOpen, Compass, Flame, RotateCcw, ScrollText, Shield, Sparkles } from 'lucide-react';

export type WorldId = string;
export type Choice = { title: string; detail: string; courage?: number; insight?: number; fate?: number; item?: string };
export type Scene = { chapter: string; place: string; title: string; text: string; choices: Choice[] };
export type World = { id: WorldId; title: string; subtitle: string; tag: string; accent: string; card: string; scenes: Scene[]; ending: string };
type Props = { userName: string; contacts: Array<{ id: string; name: string }> };

export const worlds: World[] = [
  { id: 'fantasy', title: '烬冠之境', subtitle: '龙焰熄灭后的王国，仍有人在寻找最后一枚王冠。', tag: '西方奇幻', accent: '#eecba1', card: 'from-[#493644] via-[#75607a] to-[#b88870]', ending: '在钟声的余韵里，你拿到了那枚仍带余温的星铁钥匙。王国真正的门，才刚刚出现。', scenes: [
    { chapter: '序章 · 灰烬来信', place: '雾港 / 旧钟楼', title: '钟声在午夜之后响了十三下', text: '你醒在陌生的石阶上。海风带着盐、铁锈和火烧过的味道。钟楼门缝里夹着一封写着你名字的信，而远处的骑士正朝这里赶来。', choices: [
      { title: '拆开那封信', detail: '先弄清是谁知道你的名字', insight: 1, item: '烧焦的信纸' },
      { title: '藏进钟楼的阴影', detail: '观察骑士的来意', courage: 1, item: '旧钟楼徽记' },
      { title: '直接迎向骑士', detail: '赌一次坦诚', fate: 1, courage: 1 },
    ] },
    { chapter: '第一幕 · 无火之城', place: '雾港 / 王城大道', title: '所有火把都在同一瞬间熄灭', text: '街道陷入黑暗，唯有王宫塔尖亮着一点苍白的光。人群仓皇逃散，一名披斗篷的旅人将一枚冰冷的硬币塞进你手中。', choices: [
      { title: '追上披斗篷的旅人', detail: '答案也许在他身上', courage: 1, item: '星纹硬币' },
      { title: '去塔尖寻找光源', detail: '顺着异常追查', insight: 1 },
      { title: '留下帮助街上的人', detail: '先守住眼前的人', fate: 1 },
    ] },
    { chapter: '第二幕 · 王冠的影子', place: '雾港 / 断桥', title: '桥下传来龙的呼吸', text: '断桥另一侧是封闭多年的王室秘库。桥下的黑暗缓慢起伏，像有什么庞然之物仍在沉睡。你只有一次机会，决定从哪条路过去。', choices: [
      { title: '踩着残桥冲过去', detail: '快，但没有退路', courage: 2 },
      { title: '破解桥头的古符', detail: '寻找更稳妥的通道', insight: 2, item: '星铁钥匙' },
      { title: '唤醒桥下的存在', detail: '向未知请求帮助', fate: 2 },
    ] },
  ] },
  { id: 'xianxia', title: '问云录', subtitle: '凡人误入仙门，命数从第一场落雪开始偏移。', tag: '仙侠', accent: '#c6e5db', card: 'from-[#163c45] via-[#537a7b] to-[#b7d4be]', ending: '山门的云雾向两侧散开。你没有得到答案，却得到了进入下一座山的资格。', scenes: [
    { chapter: '序章 · 入山', place: '青梧山 / 石阶', title: '落雪停在你肩头，却没有融化', text: '山门前悬着一面无字铜镜，镜中却映出一座燃烧的城。守门弟子说，每个人只能带一样东西入山。你掌心里正握着三样来历不明的物件。', choices: [
      { title: '留下刻字的木簪', detail: '它像是某人的旧物', fate: 1, item: '刻字木簪' },
      { title: '留下半卷残谱', detail: '也许能读懂铜镜', insight: 1, item: '半卷残谱' },
      { title: '留下生锈的短剑', detail: '至少可以自保', courage: 1, item: '旧短剑' },
    ] },
    { chapter: '第一幕 · 镜中雨', place: '青梧山 / 照心台', title: '铜镜里开始下雨', text: '雨水从镜面溢出，顺着石台流向你的脚边。师兄师姐们纷纷退开，只有你听见镜中有人轻声叫出了你的名字。', choices: [
      { title: '伸手触碰镜面', detail: '回应那个声音', fate: 1, courage: 1 },
      { title: '记下雨水的纹路', detail: '先找出术法规律', insight: 2 },
      { title: '唤身旁的人一起看', detail: '不独自承担异象', fate: 1 },
    ] },
    { chapter: '第二幕 · 禁地灯', place: '青梧山 / 后山', title: '夜里，禁地亮起了一盏灯', text: '那盏灯本该在百年前就熄灭。山风送来一段熟悉的曲调，与残谱上缺失的一页恰好相合。巡山弟子的脚步声越来越近。', choices: [
      { title: '翻墙进入禁地', detail: '趁巡山之前行动', courage: 2 },
      { title: '循曲调寻找阵眼', detail: '按线索走', insight: 2, item: '灯影拓印' },
      { title: '等巡山弟子一起去', detail: '让真相见光', fate: 2 },
    ] },
  ] },
  { id: 'horror', title: '槐巷夜话', subtitle: '雨夜返乡，整条老街都在假装认识你。', tag: '中式恐怖', accent: '#dfb4ad', card: 'from-[#302c35] via-[#6a4649] to-[#9a6b60]', ending: '巷尾的红灯终于熄了。天还没亮，但你已经知道，明晚它会为谁再次点燃。', scenes: [
    { chapter: '序章 · 回乡', place: '槐巷 / 末班车站', title: '末班车上多了一张空白车票', text: '雨下得很密。司机从后视镜里看了你一眼，说“到站后不要回头”。车窗外，早已拆掉的槐巷牌楼正在缓慢接近。', choices: [
      { title: '收起空白车票', detail: '也许它能证明什么', insight: 1, item: '空白车票' },
      { title: '问司机他看见了什么', detail: '不装作一切正常', courage: 1 },
      { title: '盯住窗外的牌楼', detail: '记住它出现的方式', fate: 1 },
    ] },
    { chapter: '第一幕 · 借伞', place: '槐巷 / 青石路', title: '一把红伞从无人处递了过来', text: '伞柄温热，伞下却空无一人。青石路两边的门缝里有目光在移动，整条巷子安静得只剩你的呼吸声。', choices: [
      { title: '接过红伞', detail: '看看是谁在等你', fate: 2, item: '红伞' },
      { title: '绕开伞继续走', detail: '不碰来历不明的东西', courage: 1 },
      { title: '查看伞下的影子', detail: '先确认异常从何而来', insight: 2 },
    ] },
    { chapter: '第二幕 · 门牌', place: '槐巷 / 旧宅', title: '门牌上刻着你没用过的名字', text: '老宅的木门虚掩着。门后有人在敲碗，三轻一重，正是你小时候听过的节奏。雨水却在门槛外停住，一滴都不肯进去。', choices: [
      { title: '推门走进去', detail: '面对屋里的人', courage: 2 },
      { title: '先看门牌背面', detail: '找出名字的来历', insight: 2, item: '旧门牌' },
      { title: '照着节奏敲门', detail: '让里面的人先回答', fate: 2 },
    ] },
  ] },
  { id: 'wasteland', title: '第七避难所', subtitle: '电台停止播报那天，废土上出现了一个不该存在的坐标。', tag: '末世', accent: '#e1c799', card: 'from-[#293b43] via-[#5e6b62] to-[#b99c75]', ending: '你将坐标抄在掌心。下一段路没有人替你规划，但它终于有了方向。', scenes: [
    { chapter: '序章 · 信号', place: '废土 / 旧收费站', title: '收音机里有人报出了明天的天气', text: '旧世界已经没有天气预报。沙尘暴正逼近收费站，锈掉的广播杆却忽然亮起绿灯，一段重复的坐标从杂音里浮出。', choices: [
      { title: '记录那段坐标', detail: '也许是幸存者留下的路', insight: 1, item: '异常坐标' },
      { title: '爬上广播杆', detail: '寻找信号来源', courage: 1 },
      { title: '先关闭收音机', detail: '避免暴露当前位置', fate: 1 },
    ] },
    { chapter: '第一幕 · 车队', place: '废土 / 断裂公路', title: '车队只剩最后一辆还能发动', text: '驾驶座上有一张写着“第七避难所”的地图，但目的地被黑笔涂掉。后座传来轻微的金属碰撞声，不像是风。', choices: [
      { title: '检查后座', detail: '确认车里还有谁', courage: 1, item: '旧式识别牌' },
      { title: '研究被涂掉的路线', detail: '找地图留下的痕迹', insight: 2 },
      { title: '先发动汽车离开', detail: '风暴比秘密更近', fate: 1 },
    ] },
    { chapter: '第二幕 · 闸门', place: '废土 / 地下入口', title: '避难所闸门从里面被锁上', text: '门上的屏幕亮着：“识别到一名未登记访客。”可你听见门后的脚步不止一个。风暴已经压到背后，你得决定怎样让这扇门打开。', choices: [
      { title: '用识别牌尝试开门', detail: '借旧世界的身份', insight: 2 },
      { title: '大声回应门后的人', detail: '让他们知道你还活着', courage: 2 },
      { title: '寻找备用通风井', detail: '另找一条路', fate: 2, item: '避难所通行图' },
    ] },
  ] },
];

export function SceneArtwork({ world }: { world: WorldId }) {
  const moon = world === 'horror';
  const sky = world === 'fantasy' ? ['#241f36', '#6b5172'] : world === 'xianxia' ? ['#123d4b', '#72a7a2'] : moon ? ['#191d2a', '#594047'] : world === 'wasteland' ? ['#1e3238', '#77746a'] : ['#1b273f', '#7f6d83'];
  return <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label={`${worlds.find(item => item.id === world)?.tag ?? '自定义世界'}场景插画`}>
    <defs><linearGradient id={`sky-${world}`} x2="0" y2="1"><stop stopColor={sky[0]}/><stop offset="1" stopColor={sky[1]}/></linearGradient><radialGradient id={`glow-${world}`}><stop stopColor={moon ? '#d7897e' : '#e8d1a5'} stopOpacity=".8"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient></defs>
    <rect width="400" height="220" fill={`url(#sky-${world})`}/><circle cx={world === 'xianxia' ? 296 : 305} cy="63" r="75" fill={`url(#glow-${world})`}/><circle cx={world === 'xianxia' ? 296 : 305} cy="63" r="27" fill={moon ? '#c6877c' : '#e7d8bd'} opacity=".88"/>
    {world === 'xianxia' ? <><path d="M0 180 88 89 135 138 191 42 260 153 323 72 400 160V220H0Z" fill="#204953"/><path d="M0 202 78 155 145 178 212 113 300 186 400 133V220H0Z" fill="#173c47"/><path d="M162 86h65l-11-12h-43zM178 87h33v37h-33zM167 123h55v5h-55z" fill="#d7e2cf" opacity=".85"/></>
      : world === 'fantasy' ? <><path d="M0 180 56 129 103 164 175 92 238 178 322 114 400 177V220H0Z" fill="#42394d"/><path d="M136 186h114V91h-17V60h-17V91h-28V45h-18V91h-18V68h-16v118z" fill="#2b2939"/><path d="M162 113h15v28h-15zm53 0h15v28h-15z" fill="#d8af8a" opacity=".7"/><path d="M0 202Q83 171 180 203T400 189V220H0Z" fill="#272735"/></>
      : moon ? <><path d="M0 190Q106 144 199 183T400 164V220H0Z" fill="#292a32"/><path d="M143 207V98h114v109zm12-110 45-40 45 40z" fill="#211f2a"/><path d="M182 201v-58a18 18 0 0 1 36 0v58z" fill="#6b4548"/><path d="M118 91q35-65 65 0M218 91q35-65 65 0" fill="none" stroke="#28252d" strokeWidth="8"/><path d="M0 216Q140 185 400 216" fill="none" stroke="#b27c73" strokeOpacity=".3" strokeWidth="14"/></>
      : world === 'wasteland' ? <><path d="M0 166h34V96h21v70h19V72h25v94h28V115h22v51h29V58h24v108h27v-37h28v37h17V83h25v83h30V110h20v56h31v54H0Z" fill="#263c40"/><path d="M0 192 94 180 147 196 250 174 400 188V220H0Z" fill="#354c4c"/><path d="M214 111h12m-12 16h12M82 92h12m186 42h12" stroke="#c4b992" strokeWidth="5" opacity=".55"/></>
      : <><path d="M0 203Q100 143 200 198T400 178V220H0Z" fill="#26334b"/><path d="M129 206V105Q200 27 271 105V206" fill="none" stroke="#e7cba9" strokeOpacity=".55" strokeWidth="13"/><path d="M157 206v-92q43-49 86 0v92" fill="#223450"/><path d="M200 107v99" stroke="#e7cba9" strokeOpacity=".35" strokeWidth="2"/><circle cx="200" cy="91" r="5" fill="#eedbbc"/><path d="M40 58h2m310 45h2M80 118h2" stroke="#fff" strokeWidth="3"/></>}
    <path d="M0 213Q100 197 195 212T400 200" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="17"/>
  </svg>;
}



