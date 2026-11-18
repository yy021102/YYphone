export function NurtureStatusNote({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return <aside className="nurture-status-note"><small>留言</small><p>{text}</p></aside>;
}
