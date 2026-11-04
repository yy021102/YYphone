interface ChatFeatureScene {
  type: 'direct' | 'group' | 'observer';
  callMode?: 'voice' | 'video' | null;
  regenerate: boolean;
  hasCharacter: boolean;
}

interface ChatFeatureOptions extends ChatFeatureScene {
  allowIncomingCall: boolean;
  narratorEnabled: boolean;
  canSendPayments: boolean;
  stickerCatalog: string;
  stickerPermissions: string;
}

export function chatGiftAvailable(scene: ChatFeatureScene): boolean {
  // Calls restrict reply attachments, not independently permitted cross-app actions.
  return scene.type !== 'observer' && !scene.regenerate && scene.hasCharacter;
}

export function chatPendingTransferInstructions(
  transfers: ReadonlyArray<{ messageId: string; recipientId: string; amount?: string; note: string }>,
  enabled: boolean
): string {
  if (!enabled || !transfers.length) return '本轮没有可处理的玩家转账，禁止 paymentActions。';
  return [
    '【处理玩家转账】可以按人设收取、退还或暂不处理玩家发给你的待收转账。决定收取或退还时，必须返回顶层 paymentActions:[{"messageId":"原转账ID","action":"received 或 returned"}]，action 只能写 received（收取）或 returned（退还）。仅顶层 speakerId 本人可操作；不要另发一笔 transfer 模拟退还。退还会原路退回余额或亲密付额度，并显示转账回执。',
    `可处理的转账：${JSON.stringify(transfers)}`,
  ].join('\n');
}

export function chatFeatureInstructions(options: ChatFeatureOptions): string {
  const giftRule = chatGiftAvailable(options)
    ? '可按人设与剧情主动送礼物或外卖，gift 字段和可送商品遵循上文礼物规则；仅本轮主要角色提供，NPC 不使用 gift。'
    : '本轮不执行 gift 礼物动作。';
  if (options.callMode) {
    return [
      `【本轮消息类型】当前为${options.callMode === 'video' ? '视频' : '语音'}通话，reply 仅使用 text${options.callMode === 'video' ? ' 或 narration' : ''}，不使用聊天附件。`,
      giftRule,
    ].join('\n');
  }
  const payments = options.type !== 'observer' && options.canSendPayments;
  const stickers = !!options.stickerCatalog;
  const incomingCall = options.type === 'direct' && options.allowIncomingCall;
  const types = ['text', 'image', 'voice', 'location', 'link'];
  if (options.type !== 'observer') types.push('pat');
  if (stickers) types.push('sticker');
  if (payments) types.push('red-packet', 'transfer');
  if (incomingCall) types.push('video-call');
  if (options.narratorEnabled || options.type === 'observer') types.push('narration');
  return [
    `【本轮消息类型】普通消息可写字符串，或按需写 {"kind":"消息类型","text":"正文"} 并补充所选类型需要的字段。支持类型：${types.join('、')}。请仅在剧情自然、确有必要时使用附件，普通文字聊天优先，不为凑数发送附件。`,
    '如果角色选择发送语音条，必须使用 {"kind":"voice","text":"完整的语音转写文字"}；不要只在普通正文前加“【语音】”。语音正文保留正常标点。',
    '不要编造图片 URL；image 使用文字图卡，开启生图时遵循本轮生图说明。链接提供 title/source/content。',
    ...(options.type !== 'observer' ? ['pat 表示角色拍了拍玩家，text 可留空或写简短后缀，仅在情境自然时偶尔使用。'] : []),
    ...(payments ? ['红包和转账必须给正数 amount，收款对象只能是玩家 user，群聊红包可提供 quantity；发出后仍需玩家手动领取或确认收款，待收转账可退回。'] : []),
    stickers ? [
      '【表情包】玩家导入了一批表情包，你可以像真人聊天一样，根据人设、性格和当下情绪，在合适的时候主动发表情包（比如开心、撒娇、无语、委屈、吐槽时），一般可单独作为一条 {"kind":"sticker","stickerId":"表情包ID"}，也可在文字消息后附带一条；偏活泼的人设可以更常用，内敛冷淡的人设就少用，不要每轮都发，也不要连发多个。表情包不只是表达情绪，也可以用来糊弄回复、反讽、玩梗、做社交缓冲（不知道说什么、尴尬、不想认真回答时）；但不要过度解读表情包的含义，也不要给它强加深意。根据当前对话氛围和人设选择性地发，同一个表情包不要反复发（回看历史，近期发过的就换一个或不发）。',
      `只能从下列目录选择，格式 分类：[ID|名称]：${options.stickerCatalog}。`,
      `每位角色只能从获准分类选择：${options.stickerPermissions}。`,
    ].join('\n') : '本轮无可用表情包，禁止返回 sticker。',
    incomingCall
      ? '可以在合适时机主动发起一次视频来电：{"kind":"video-call","text":"视频来电"}；玩家必须自行接通，不描述为已接听或正在通话。'
      : '本轮禁止返回 video-call，不得主动拨打电话。',
    ...(options.narratorEnabled || options.type === 'observer' ? ['本对话已开启旁白：可在 reply 中穿插 {"kind":"narration","text":"旁白内容"}，用第三人称简短描述动作、表情、神态、衣着或氛围，控制在 50 字以内，不含台词、不替玩家行动。旁白计入消息条数，通常最多 1 条，不能全是旁白。'] : []),
    giftRule,
    ...(options.type === 'observer' ? ['旁观群聊中 user 不在场，禁止发送给玩家的拍一拍、红包、转账或礼物。'] : []),
  ].join('\n');
}
