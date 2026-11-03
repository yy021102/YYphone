import { useMemo } from 'react';
import { builtinThoughtLayout, isThoughtSnapshot, thoughtDocument, type ThoughtSnapshot } from '../utils/thoughtPresets';

export function ThoughtCard({ snapshot }: { snapshot: ThoughtSnapshot }) {
  const document = useMemo(() => {
    try {
      if (!isThoughtSnapshot(snapshot)) throw new Error('心声内容或模板格式无效。');
      const layout = builtinThoughtLayout(snapshot.preset);
      return { html: layout ? '' : thoughtDocument(snapshot), layout, error: '' };
    }
    catch (error) {
      console.error('Could not render thought template.', error);
      return { html: '', error: error instanceof Error ? error.message : '心声模板无法显示。' };
    }
  }, [snapshot]);
  return document.error ? <div className="space-y-3">
    <p role="alert" className="text-xs text-rose-500">{document.error}</p>
    {typeof snapshot.values?.thought === 'string' && <p className="whitespace-pre-wrap text-sm leading-relaxed">{snapshot.values.thought}</p>}
  </div> : document.layout ? <article className="yy-thought-native" data-layout={document.layout} aria-label={`${snapshot.characterName}的心声状态`}>
    <header>
      <span className="yy-thought-native-time">此刻 · {new Date(snapshot.at).toLocaleString('zh-CN', { hour12: false })}</span>
      <h2>{snapshot.characterName}的心声</h2>
    </header>
    <div className="yy-thought-native-fields">
      {snapshot.preset.fields.map(field => <section key={field.key} className="yy-thought-native-field">
        <div className="yy-thought-native-label">{field.label}</div>
        <div className="yy-thought-native-value">{snapshot.values[field.key]}</div>
      </section>)}
    </div>
  </article> : <iframe title={`${snapshot.characterName}的心声状态`} sandbox="" referrerPolicy="no-referrer"
    srcDoc={document.html} className="w-full rounded-2xl border-0" style={{ height: snapshot.preset.height }} />;
}
