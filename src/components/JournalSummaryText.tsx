export function JournalSummaryText({ content }: { content: string }) {
  if (content.length <= 220) return <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">{content}</p>;
  return <details className="group text-[13px] leading-relaxed text-slate-700">
    <summary className="list-none cursor-pointer">
      <p className="line-clamp-4 whitespace-pre-wrap break-words group-open:hidden">{content}</p>
      <span className="mt-1 block text-[10px] text-slate-400"><span className="group-open:hidden">展开全文</span><span className="hidden group-open:inline">收起全文</span> · {content.length} 字</span>
    </summary>
    <p className="mt-1 whitespace-pre-wrap break-words">{content}</p>
  </details>;
}
