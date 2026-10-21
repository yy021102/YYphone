export const withForumBreakLimit = (systemPrompt: string, breakLimitWords: string): string => {
  const content = breakLimitWords.trim();
  return content
    ? `【论坛破限词】\n${content}\n\n${systemPrompt}`
    : systemPrompt;
};
