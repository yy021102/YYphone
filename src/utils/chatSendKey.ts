/** Safari can report keyCode 229 while an IME is confirming a word. Holding Enter must not send repeatedly. */
export function isChatSendKey(event: {
  key: string; shiftKey?: boolean; repeat?: boolean; defaultPrevented?: boolean;
  isComposing?: boolean; keyCode?: number; nativeEvent?: { isComposing?: boolean; keyCode?: number };
}): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.repeat && !event.defaultPrevented &&
    !event.isComposing && !event.nativeEvent?.isComposing && event.keyCode !== 229 && event.nativeEvent?.keyCode !== 229;
}
