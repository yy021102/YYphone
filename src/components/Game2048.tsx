import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Share2, X } from 'lucide-react';
import { continue2048, finish2048, GAME_2048_KEY, isSaved2048, move2048, new2048, report2048, type Direction2048, type Game2048State, type Saved2048 } from '../utils/game2048';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import './game2048.css';

export function Game2048({ people, onShare }: {
  people: Array<{ id: string; name: string }>;
  onShare: (game: Game2048State, detail: string, recipients: string[]) => void | Promise<void>;
}) {
  const [saved, setSaved] = useState<Saved2048>(() => readStoredValue(GAME_2048_KEY, null, (value): value is Saved2048 | null => value === null || isSaved2048(value)) ?? { version: 1, game: new2048(), best: 0 });
  const current = useRef(saved), board = useRef<HTMLDivElement>(null), alive = useRef(true);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const [sharingOpen, setSharingOpen] = useState(false), [selected, setSelected] = useState<string[]>([]), [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState<Record<string, string[]>>({}), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const game = saved.game, done = game.status !== 'playing', snapshotKey = `${game.id}:${game.moves}:${game.status}`;
  const sent = shared[snapshotKey] ?? [], recipients = selected.filter(id => people.some(person => person.id === id) && !sent.includes(id));
  useEffect(() => { alive.current = true; writeStoredValue(GAME_2048_KEY, current.current); board.current?.focus({ preventScroll: true }); return () => { alive.current = false; }; }, []);
  const commit = (next: Game2048State) => {
    if (next === current.current.game) return;
    const nextSaved: Saved2048 = { version: 1, game: next, best: Math.max(current.current.best, next.score) };
    writeStoredValue(GAME_2048_KEY, nextSaved); current.current = nextSaved; setSaved(nextSaved); setNotice(''); setError('');
  };
  const move = (direction: Direction2048) => { if (!sharingOpen && !sharing) commit(move2048(current.current.game, direction)); };
  const restart = () => {
    if (game.status === 'playing' && game.moves > 0 && !window.confirm('重新开始会放弃当前这一局，继续吗？')) return;
    commit(new2048()); setSelected([]); setSharingOpen(false); board.current?.focus({ preventScroll: true });
  };
  return <section className="game2048" aria-label="2048小游戏" onKeyDown={event => {
    if ((event.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]') || sharingOpen || sharing) return;
    const directions: Record<string, Direction2048> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (directions[event.key]) { event.preventDefault(); move(directions[event.key]); }
  }}>
    <div className="game2048-heading"><div><h2>2048</h2><p>相同的数字，再靠近一点</p></div><button type="button" disabled={sharing} onClick={restart}><RotateCcw size={14} />新一局</button></div>
    <div className="game2048-scores"><div><span>得分</span><strong aria-label="2048当前得分">{game.score}</strong></div><div><span>最高分</span><strong>{saved.best}</strong></div></div>
    <div ref={board} tabIndex={0} role="group" aria-label="2048棋盘" data-no-swipe-back className={`game2048-board ${done ? 'is-finished' : ''}`}
      onPointerDown={event => { if (event.button !== 0 || pointer.current || done || sharingOpen) return; pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); }}
      onPointerCancel={() => { pointer.current = null; }}
      onPointerUp={event => {
        const start = pointer.current; if (!start || start.id !== event.pointerId) return; pointer.current = null;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
      }}>
      {game.board.map((value, index) => <div key={index} className="game2048-cell"><span key={value} data-tile-value={value} data-level={value ? Math.min(11, Math.log2(value)) : 0} className={value >= 10000 ? 'is-large' : ''}>{value || ''}</span></div>)}
      {done && <div className="game2048-result" role="status"><h3>{game.status === 'won' ? '合成 2048！' : game.status === 'over' ? '这局到这里' : '本局已结束'}</h3><p>{game.score} 分 · 最大方块 {Math.max(...game.board)}</p>{game.status === 'won' && <button type="button" disabled={sharing} onClick={() => commit(continue2048(game))}>继续挑战</button>}</div>}
    </div>
    <div className="game2048-meta"><span>最大方块 {Math.max(...game.board)}</span><span>{game.moves} 步</span></div>
    <p className="game2048-hint">滑动棋盘，或使用方向键</p>
    {!done && <div className="game2048-directions" aria-label="移动方向">{([
      ['up', '向上移动', ArrowUp], ['left', '向左移动', ArrowLeft], ['down', '向下移动', ArrowDown], ['right', '向右移动', ArrowRight],
    ] as const).map(([direction, label, Icon]) => <button type="button" key={direction} aria-label={label} onClick={() => move(direction)}><Icon size={20} /></button>)}</div>}
    {done ? <button type="button" className="game2048-share" onClick={() => { setSharingOpen(true); setSelected([]); setError(''); }}><Share2 size={15} />分享记录</button>
      : <button type="button" className="game2048-finish" disabled={!game.moves} onClick={() => commit(finish2048(game))}>结束本局</button>}
    {notice && <p role="status" className="game2048-notice">{notice}</p>}
    {error && <p role="alert" className="game2048-error">{error}</p>}
    {sharingOpen && <div className="game2048-share-mask" onClick={event => { if (!sharing && event.target === event.currentTarget) setSharingOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="分享2048记录" onKeyDown={event => { if (event.key === 'Escape' && !sharing) { event.stopPropagation(); setSharingOpen(false); } }}>
        <header><strong>分享游戏记录</strong><button type="button" aria-label="关闭2048分享" disabled={sharing} onClick={() => setSharingOpen(false)}><X size={18} /></button></header>
        <p>{game.score} 分 · 最大方块 {Math.max(...game.board)}</p>
        <div className="game2048-recipients">{people.map(person => <label key={person.id}><input type="checkbox" checked={selected.includes(person.id)} disabled={sharing || sent.includes(person.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id))} /><span>{person.name}</span>{sent.includes(person.id) && <small>已分享</small>}</label>)}{!people.length && <p>还没有可分享的角色</p>}</div>
        {error && <p role="alert" className="game2048-error">{error}</p>}
        <button type="button" className="game2048-share" disabled={!recipients.length || sharing} onClick={async () => {
          setSharing(true); setError('');
          try {
            await onShare(game, report2048(game), recipients);
            if (alive.current) { setShared(values => ({ ...values, [snapshotKey]: [...new Set([...(values[snapshotKey] ?? []), ...recipients])] })); setSharingOpen(false); setNotice('记录已分享。'); }
          } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '分享失败，请重试。'); }
          finally { if (alive.current) setSharing(false); }
        }}>{sharing ? '正在分享…' : '发送给角色'}</button>
      </section>
    </div>}
  </section>;
}
