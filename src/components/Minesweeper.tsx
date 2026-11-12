import { useEffect, useRef, useState } from 'react';
import { Clock3, Flag, Flower2, MousePointer2, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import { adjacentMines, isSavedMines, mineDifficulty, MINE_LEVELS, MINESWEEPER_KEY, mineSeconds, newMineGame, revealMineCell, toggleMineFlag, type MineDifficulty, type MineGame, type SavedMines } from '../utils/minesweeper';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import './minesweeper.css';

function FluffyMine({ happy = false }: { happy?: boolean }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="mine-fluffy">
    <path d="M23 8V4M35 13l4-4M39 24h5M35 35l4 4M24 39v5M13 35l-4 4M9 24H4M13 13L9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="24" cy="24" r="16" fill="currentColor"/><ellipse cx="18" cy="17" rx="5" ry="3" fill="white" opacity=".35"/>
    <circle cx="18" cy="25" r="1.5" fill="#766579"/><circle cx="30" cy="25" r="1.5" fill="#766579"/>
    <ellipse cx="14" cy="29" rx="3" ry="1.6" fill="#eab4c7"/><ellipse cx="34" cy="29" rx="3" ry="1.6" fill="#eab4c7"/>
    <path d={happy ? 'M21 29q3 4 6 0' : 'M22 30q2-2 4 0'} stroke="#766579" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M30 10c-4-4-2-7 1-5 1-4 5-3 4 1 4 0 4 4 0 5" fill="#f6e7bb"/>
  </svg>;
}
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export function Minesweeper() {
  const [saved, setSaved] = useState<SavedMines>(() => readStoredValue(MINESWEEPER_KEY, null, (value): value is SavedMines | null => value === null || isSavedMines(value)) ?? { version: 1, game: newMineGame(), best: {} });
  const current = useRef(saved), press = useRef<{ index: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressed = useRef({ index: -1, until: 0 });
  const [flagMode, setFlagMode] = useState(false), [now, setNow] = useState(Date.now), [error, setError] = useState('');
  const game = saved.game, level = MINE_LEVELS[game.difficulty], finished = game.status === 'won' || game.status === 'lost';
  const seconds = mineSeconds(game, now), best = saved.best[game.difficulty];
  const cancelPress = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
  useEffect(() => () => cancelPress(), []);
  useEffect(() => {
    if (game.status !== 'playing') return;
    setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [game.status, game.id]);
  const commit = (next: MineGame) => {
    if (next === current.current.game) return;
    const best = { ...current.current.best }, duration = mineSeconds(next);
    if (next.status === 'won' && (best[next.difficulty] === undefined || duration < best[next.difficulty]!)) best[next.difficulty] = duration;
    const value: SavedMines = { version: 1, game: next, best };
    try { writeStoredValue(MINESWEEPER_KEY, value); current.current = value; setSaved(value); setNow(Date.now()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '本局保存失败，请重试。'); }
  };
  const flag = (index: number) => commit(toggleMineFlag(current.current.game, index));
  const restart = (difficulty: MineDifficulty = game.difficulty) => {
    if (!finished && (game.revealed.length || game.flags.length) && !window.confirm('要放下这一局，开始新一局吗？')) return;
    cancelPress(); suppressed.current = { index: -1, until: 0 }; commit(newMineGame(difficulty)); setFlagMode(false);
  };
  return <section className="mines-game" aria-label="扫雷小游戏">
    <header className="mines-heading"><div className="mines-mascot"><FluffyMine happy/></div><div><span className="mines-eyebrow">LITTLE GARDEN</span><h2>花园扫雷</h2></div><button type="button" className="mines-reset" onClick={() => restart()}><RotateCcw size={14}/>新一局</button></header>
    <div className="mines-levels" role="group" aria-label="扫雷难度">{(['normal', 'hard'] as const).map(difficulty => <button type="button" key={difficulty} aria-pressed={game.difficulty === difficulty} onClick={() => { if (mineDifficulty(difficulty) && difficulty !== game.difficulty) restart(difficulty); }}><span>{MINE_LEVELS[difficulty].label}</span><small>{MINE_LEVELS[difficulty].columns} × {MINE_LEVELS[difficulty].rows}</small></button>)}</div>
    <div className="mines-stats"><div><Flag size={15}/><span>剩余标记</span><strong aria-label="剩余标记数">{level.count - game.flags.length}</strong></div><div><Clock3 size={15}/><span>用时</span><strong aria-label="扫雷用时">{timeLabel(seconds)}</strong></div></div>
    <div className="mines-tools" role="group" aria-label="扫雷操作模式"><button type="button" aria-pressed={!flagMode} onClick={() => setFlagMode(false)}><MousePointer2 size={15}/>翻开</button><button type="button" aria-pressed={flagMode} onClick={() => setFlagMode(true)}><Flag size={15}/>插旗</button></div>
    <div className={`mines-board-wrap ${finished ? `is-${game.status}` : ''}`}>
      <div className="mines-board" role="group" aria-label="扫雷棋盘" data-no-swipe-back style={{ gridTemplateColumns: `repeat(${level.columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: level.columns * level.rows }, (_, index) => {
          const open = game.revealed.includes(index), marked = game.flags.includes(index), mine = game.mines.includes(index);
          const exposed = finished && mine, wrongFlag = game.status === 'lost' && marked && !mine, number = open && !mine ? adjacentMines(game, index) : 0;
          const label = `第${Math.floor(index / level.columns) + 1}行第${index % level.columns + 1}列，${wrongFlag ? '标错了' : exposed ? '小雷' : marked ? '已插旗' : open ? number ? `周围${number}颗雷` : '空白' : '未翻开'}`;
          return <button type="button" key={index} data-cell={index} data-revealed={open} data-number={number || undefined} disabled={finished} aria-label={label} className={`mines-cell ${open ? 'is-open' : ''} ${marked ? 'is-flagged' : ''} ${open && mine ? 'is-hit' : ''} ${exposed ? 'is-mine' : ''}`}
            onPointerDown={event => {
              if (event.button !== 0 || finished) return;
              cancelPress(); suppressed.current = { index: -1, until: 0 }; const { clientX: x, clientY: y } = event;
              press.current = { index, x, y, timer: setTimeout(() => {
                press.current = null; suppressed.current = { index, until: Date.now() + 1200 }; flag(index);
              }, 450) };
            }}
            onPointerMove={event => { if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) cancelPress(); }}
            onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
            onContextMenu={event => { event.preventDefault(); cancelPress(); const touchMenu = (event.nativeEvent as PointerEvent).pointerType === 'touch'; if (!touchMenu || suppressed.current.index !== index || Date.now() > suppressed.current.until) flag(index); }}
            onKeyDown={event => { if (event.key.toLowerCase() === 'f') { event.preventDefault(); flag(index); } }}
            onClick={() => {
              if (suppressed.current.index === index && Date.now() < suppressed.current.until) { suppressed.current = { index: -1, until: 0 }; return; }
              cancelPress(); if (flagMode) flag(index); else commit(revealMineCell(current.current.game, index));
            }}>
            {wrongFlag ? <X size={16}/> : exposed ? <FluffyMine happy={game.status === 'won'}/> : marked ? <Flag size={16} fill="currentColor"/> : open ? number || <span className="mines-empty-dot"/> : <span className="mines-cell-glint"/>}
          </button>;
        })}
      </div>
    </div>
    <div className={`mines-message ${finished ? 'is-result' : ''}`} role="status">
      {game.status === 'won' ? <><Sparkles size={20}/><strong>花园安全啦！</strong><span>{timeLabel(seconds)} · 所有小雷都找到家了</span></> : game.status === 'lost' ? <><Flower2 size={20}/><strong>碰到一只小雷</strong><span>再来一局，慢慢找也没关系</span></> : <span>{game.status === 'ready' ? '任选一格开始，第一下是安全的' : `已翻开 ${game.revealed.length} / ${level.columns * level.rows - level.count} 格`}</span>}
    </div>
    <div className="mines-best"><Trophy size={14}/><span>{level.label}最佳</span><strong>{best === undefined ? '—' : timeLabel(best)}</strong></div>
    <details className="mines-rules"><summary>怎么玩</summary><p>数字表示周围八格中的雷数。点格子翻开，长按或右键插旗，也可以切换上方「插旗」模式。标记数与数字相同时，再点该数字可翻开周围未标记的格子。翻开所有安全格就赢了。</p></details>
    {error && <p role="alert" className="mines-error">{error}</p>}
  </section>;
}
