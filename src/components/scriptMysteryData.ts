export type MysteryRole = {
  id: string;
  title: string;
  publicStatement: string;
  privateBrief: string;
  goal: string;
};

export type MysteryClue = {
  id: string;
  act: 1 | 2;
  place: string;
  title: string;
  teaser: string;
  detail: string;
  key: boolean;
};

export type MysteryScript = {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  actTwo: string;
  truth: string;
  playerRoleTitle: string;
  playerBrief: string;
  culpritRoleId: string;
  roles: MysteryRole[];
  clues: MysteryClue[];
};

export const BUILTIN_SCRIPT: MysteryScript = {
  id: 'builtin-glass-gallery',
  title: '玻璃展厅的空画框',
  subtitle: '一幅真迹在停电的三分钟里变成了复制品。',
  content: '雾港美术馆的夜间预展即将结束。前厅的直播还亮着，工作人员正准备将镇馆画作《潮汐来信》送回恒温库。21:10，展厅灯光突然熄灭。三分钟后照明恢复，画仍挂在原处，安保人员也没有发现有人带着画框通过出口。\n\n修复师却在收尾检查时摸到尚未干透的背胶：墙上的画是预展复制品。策展人说自己始终在前厅，修复师承认复制品由她制作，档案管理员则说那幅复制品早已被送去登记。三人的话单独听都有道理，放在一起却缺了一段关键时间。在场的人需要在封馆前厘清调包过程与真迹的去向。',
  actTwo: '第一轮勘查后，可以核对的时间线逐渐清晰。馆内并非所有设备都在停电时停止工作：前厅直播留下了连续画面，后廊门禁保留了刷卡时间，配电室的检修单也没有被销毁。\n\n与此同时，档案室的一辆蓝色推车停得比平时更靠里。调查从“谁有机会接触复制品”转向“谁能同时安排停电、进入展厅并搬走真迹”。在场的人可以再次核对说法与新发现的线索。',
  truth: '档案管理员利用自己申请的短暂停电，凭后廊门禁进入展厅。他此前从修复师手中领走预展复制品，用档案推车把真迹运回档案室，再将复制品挂上墙。策展人当时一直在前厅直播，修复师只负责制作复制品。',
  playerRoleTitle: '调查者',
  playerBrief: '你是本次预展临时请来的调查者。馆方希望在媒体得知真迹失踪前弄清真相，因此给了你查看直播、门禁、修复记录和档案室的权限。你没有参与调包，也不知道谁在说谎。你的目标是厘清 20:52 到 21:13 的时间线，找出真迹去向，并用两条互相支持的证据完成结案。',
  culpritRoleId: 'archivist',
  roles: [
    {
      id: 'curator', title: '策展人',
      publicStatement: '“停电时我正在前厅直播。那幅画的安保流程是我定的，我也想知道哪里出了问题。”',
      privateBrief: '你无罪，但安保流程由你制定，真迹失踪会直接影响你的职业声誉。21:05 至 21:19，你一直在前厅使用电池设备直播，观众画面可以证明这一点。你知道档案管理员白天提过后廊湿度传感器异常，却没有仔细过问检修时间。你起初怀疑修复师，因为她制作了复制品；但她的正式委托书由你签发，不能把猜测说成事实。',
      goal: '说明自己的时间线，同时尽量保护美术馆声誉；被追问流程漏洞时会有些防备。',
    },
    {
      id: 'archivist', title: '档案管理员',
      publicStatement: '“我只是按规定领走复制品作档案登记。停电很突然，我没有碰真迹。”',
      privateBrief: '你是真正的调包者，手头有难以公开的债务，打算把真迹转卖。20:52，你从修复师手中领取预展复制品并签收；随后以检查湿度传感器为由申请 21:10 的短暂停电。21:11，你用自己的门禁卡进入后廊，趁黑用蓝色档案推车把真迹运到档案室深处，再挂上复制品。你的谎言是“停电很突然，我没有碰真迹”。被问到复制品、停电或门禁时可以承认每一项手续存在，但要把它们分别解释成正常工作；结案前不要主动认罪，也不要捏造与固定线索冲突的新事实。',
      goal: '把各项手续解释成彼此无关的正常工作，避免别人串起完整的调包链条。',
    },
    {
      id: 'restorer', title: '修复师',
      publicStatement: '“复制品确实出自我手，但它是预展排练用的。我在停电前就交给档案室登记了。”',
      privateBrief: '你无罪。你按策展人的正式委托制作预展复制品，原本只用于灯光排练。20:52，你把复制品交给档案管理员并取得签收，此后没有再碰那幅画。停电时你独自在修复室整理工具，没有可靠的人证。你注意到档案管理员后来推着蓝色推车离开，但没有亲眼看见真迹被装进去。你担心人们只因“复制品出自你手”就认定你有罪，所以说话容易急。',
      goal: '解释复制品的合法来源，并请调查者核对签收时间；不要夸大自己未亲眼看见的事。',
    },
  ],
  clues: [
    { id: 'livestream', act: 1, place: '前厅', title: '直播存档', teaser: '一段未中断的直播视频', detail: '策展人在 21:05—21:19 始终出现在前厅直播画面中。展厅停电时，直播设备靠电池继续工作。', key: false },
    { id: 'handover', act: 1, place: '修复室', title: '复制品签收单', teaser: '一张压在颜料盒下的纸', detail: '20:52，修复师把《潮汐来信》的预展复制品交给档案管理员；签收栏写着他的名字。', key: true },
    { id: 'frame', act: 1, place: '展厅', title: '画框背胶', teaser: '一处刚被动过的细节', detail: '画框背面的封条重新粘贴过，胶尚未干透。现在挂在墙上的画是预展复制品。', key: false },
    { id: 'power', act: 2, place: '配电室', title: '停电申请', teaser: '计划外的三分钟检修', detail: '档案管理员以“后廊湿度传感器检修”为由，申请在 21:10—21:13 暂停展厅照明。', key: true },
    { id: 'access', act: 2, place: '后廊', title: '门禁记录', teaser: '电子门留下的时间戳', detail: '21:11，档案管理员的门禁卡从后廊进入展厅；当时策展人仍在直播。', key: true },
    { id: 'cart', act: 2, place: '档案室', title: '蓝色推车', teaser: '轮子上有新鲜的灰白粉末', detail: '档案室蓝色推车的车轮沾有展厅地面的灰白保护粉，推车内衬上还夹着一小片与真迹背板相同的麻布纤维。', key: false },
  ],
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown) => typeof value === 'string' ? value : '';
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const newMysteryDraft = (): MysteryScript => ({
  id: newId('custom-script'), title: '', subtitle: '', content: '', actTwo: '', truth: '',
  playerRoleTitle: '', playerBrief: '', culpritRoleId: '',
  roles: [
    { id: newId('role'), title: '', publicStatement: '', privateBrief: '', goal: '' },
    { id: newId('role'), title: '', publicStatement: '', privateBrief: '', goal: '' },
  ],
  clues: [
    { id: newId('clue'), act: 1, place: '', title: '', teaser: '', detail: '', key: true },
    { id: newId('clue'), act: 2, place: '', title: '', teaser: '', detail: '', key: true },
  ],
});

export const isMysteryScript = (value: unknown): value is MysteryScript => {
  if (!record(value) || !Array.isArray(value.roles) || !Array.isArray(value.clues)) return false;
  return typeof value.id === 'string' && typeof value.title === 'string' && typeof value.subtitle === 'string' &&
    typeof value.content === 'string' && typeof value.actTwo === 'string' && typeof value.truth === 'string' &&
    typeof value.playerRoleTitle === 'string' && typeof value.playerBrief === 'string' && typeof value.culpritRoleId === 'string' &&
    value.roles.every(role => record(role) && typeof role.id === 'string' && typeof role.title === 'string' &&
      typeof role.publicStatement === 'string' && typeof role.privateBrief === 'string' && typeof role.goal === 'string') &&
    value.clues.every(clue => record(clue) && typeof clue.id === 'string' && (clue.act === 1 || clue.act === 2) &&
      typeof clue.place === 'string' && typeof clue.title === 'string' && typeof clue.teaser === 'string' &&
      typeof clue.detail === 'string' && typeof clue.key === 'boolean');
};
export const isMysteryScriptList = (value: unknown): value is MysteryScript[] => Array.isArray(value) && value.every(isMysteryScript);

export const mysteryScriptError = (script: MysteryScript): string => {
  if (!script.title.trim()) return '请填写剧本名。';
  if (!script.content.trim()) return '请填写第一幕的公开剧情。';
  if (!script.actTwo.trim()) return '请填写第二幕的剧情。';
  if (!script.truth.trim()) return '请填写结案真相。';
  if (script.roles.length < 2 || script.roles.length > 6) return '剧本需要 2–6 个角色。';
  if (script.roles.some(role => !role.title.trim() || !role.privateBrief.trim())) return '每个角色都需要名字和专属剧本。';
  if (new Set(script.roles.map(role => role.title.trim())).size !== script.roles.length) return '角色名称不能重复。';
  if (new Set(script.roles.map(role => role.id)).size !== script.roles.length) return '角色编号不能重复。';
  if (!script.roles.some(role => role.id === script.culpritRoleId)) return '请选择真相对应的角色。';
  if (script.clues.length < 2 || !script.clues.some(clue => clue.act === 1) || !script.clues.some(clue => clue.act === 2)) return '两幕都至少需要一条线索。';
  if (script.clues.some(clue => !clue.title.trim() || !clue.detail.trim())) return '每条线索都需要名称和完整内容。';
  if (new Set(script.clues.map(clue => clue.id)).size !== script.clues.length) return '线索编号不能重复。';
  if (!script.clues.some(clue => clue.key)) return '至少标记一条关键证据。';
  return '';
};

/** JSON files may be exported scripts or shorter hand-written objects; plain text stays intact for editing. */
export const importMysteryScript = (text: string, filename: string): MysteryScript => {
  const draft = newMysteryDraft();
  draft.title = filename.replace(/\.(json|txt|md|markdown)$/i, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown; } catch { parsed = null; }
  if (!record(parsed)) { draft.content = text; return draft; }
  draft.title = str(parsed.title) || str(parsed.name) || draft.title;
  draft.subtitle = str(parsed.subtitle) || str(parsed.summary);
  draft.content = str(parsed.content) || str(parsed.premise) || str(parsed.story) || text;
  draft.actTwo = str(parsed.actTwo) || str(parsed.midpoint) || str(parsed.secondAct);
  draft.truth = str(parsed.truth) || str(parsed.solution) || str(parsed.ending);
  draft.playerRoleTitle = str(parsed.playerRoleTitle);
  draft.playerBrief = str(parsed.playerBrief);
  const sourceRoles = Array.isArray(parsed.roles) ? parsed.roles.slice(0, 6).filter(record) : [];
  if (sourceRoles.length > 0) {
    draft.roles = sourceRoles.map(role => ({
      id: newId('role'), title: str(role.title) || str(role.name),
      publicStatement: str(role.publicStatement) || str(role.publicIntro),
      privateBrief: str(role.privateBrief) || str(role.script) || str(role.secret), goal: str(role.goal),
    }));
  }
  if (Array.isArray(parsed.clues) && parsed.clues.length > 0) {
    draft.clues = parsed.clues.slice(0, 30).filter(record).map(clue => ({
      id: newId('clue'), act: clue.act === 2 || clue.act === '2' ? 2 : 1,
      place: str(clue.place), title: str(clue.title) || str(clue.name),
      teaser: str(clue.teaser), detail: str(clue.detail) || str(clue.content), key: clue.key === true,
    }));
  }
  const culprit = str(parsed.culpritRoleId);
  const culpritIndex = typeof parsed.culpritRoleId === 'number' ? parsed.culpritRoleId
    : culprit ? sourceRoles.findIndex(role => str(role.id) === culprit || str(role.title) === culprit || str(role.name) === culprit) : -1;
  draft.culpritRoleId = culpritIndex >= 0 ? draft.roles[culpritIndex]?.id ?? '' : '';
  return draft;
};
