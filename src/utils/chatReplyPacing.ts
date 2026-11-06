export interface ReplyPacingRange { min: number; max: number }

/** Bounds are chosen by the player; the model chooses the actual count, never a random quota. */
export function chatReplyPacing(range: ReplyPacingRange, group = false) {
  const quantity = range.min === range.max ? `恰好 ${range.min} 条` : `${range.min}～${range.max} 条`;
  return `【本轮消息数量】reply 使用${quantity}独立消息组成的数组。${group ? '这是全群消息总数，不是每位成员各发这么多条；不要求全员轮流发言。' : ''}${range.min === range.max
    ? '这是玩家明确设置的固定条数，在这些消息中自然表达，不塞入无关关心或新话题。'
    : `在这个范围内，根据角色本轮确实想说的内容自行决定条数，上限不是目标，不预先凑一个条数再填内容。${range.min === 1 ? '一句、单独一个符号或一个贴切的表情包就足够时，reply 只放一条即可。' : '遵守玩家设置的最少条数，但不要靠无关话题填充。'}有新的想法、分享欲或值得展开的讨论时可以自然多说，不把简短当作固定任务。`}
每条消息可以是几个字的反应，也可以有一两句话，长短可以错落，不按固定字数切割，不固定安排一短一长。按意思的转折与确实想补充的内容分条，不为增加条数硬拆一句话，也不为减少条数堆进一个大气泡。消息条数不等于句数或段数；深聊中的连贯长文可在同一条 text 内自然分段、正常使用标点，不按玩家上一条的字数机械匹配，也不为写长凑字。`;
}

export const CHAT_THOUGHT_STYLE = '独立 thought 是角色此刻第一人称、未说出口的内心活动，独立于 reply，不能写成旁白、对玩家的发言或复述台词。保留符合人设的真实想法，长短随当下：简单互动可以只是简短念头，确实触动时再细腻展开；不规定每次都揭示阴暗面、不安、脆弱或深层依恋，不为凑字数把轻松互动分析成复杂心理事件。心声仅供玩家查看，不因此把本可简短的台词扩写。';
