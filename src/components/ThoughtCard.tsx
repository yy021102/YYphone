import { useMemo } from 'react';
import { thoughtDocument, type ThoughtSnapshot } from '../utils/thoughtPresets';

export function ThoughtCard({ snapshot }: { snapshot: ThoughtSnapshot }) {
  const document = useMemo(() => {
    try { return { html: thoughtDocument(snapshot), error: '' }; }
    catch (error) {
      console.error('Could not render thought template.', error);
      return { html: '', error: error instanceof Error ? error.message : '心声模板无法显示。' };
    }
  }, [snapshot]);
  return document.error ? <div className="space-y-3">
    <p role="alert" className="text-xs text-rose-500">{document.error}</p>
    {typeof snapshot.values?.thought === 'string' && <p className="whitespace-pre-wrap text-sm leading-relaxed">{snapshot.values.thought}</p>}
  </div> : <iframe title={`${snapshot.characterName}的心声状态`} sandbox="" referrerPolicy="no-referrer"
    srcDoc={document.html} className="w-full rounded-2xl border-0" style={{ height: snapshot.preset.height }} />;
}
