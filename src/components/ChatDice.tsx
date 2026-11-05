import { useEffect, useState } from 'react';
import { CHAT_DICE_FACE_IMAGES, CHAT_DICE_IMAGES, CHAT_DICE_ROLL_MS, chatDiceRollRemaining, type ChatDiceValue } from '../utils/chatDice';

const rotations = ['', 'rotateY(-90deg)', 'rotateX(-90deg)', 'rotateX(90deg)', 'rotateY(90deg)', 'rotateY(180deg)'];
const faces = [
  { value: 1, transform: 'translateZ(19px)' },
  { value: 6, transform: 'rotateY(180deg) translateZ(19px)' },
  { value: 2, transform: 'rotateY(90deg) translateZ(19px)' },
  { value: 5, transform: 'rotateY(-90deg) translateZ(19px)' },
  { value: 3, transform: 'rotateX(90deg) translateZ(19px)' },
  { value: 4, transform: 'rotateX(-90deg) translateZ(19px)' },
];

export function ChatDice({ value, createdAt }: { value: ChatDiceValue; createdAt: string }) {
  const [now, setNow] = useState(Date.now);
  const remaining = chatDiceRollRemaining(createdAt, now);
  useEffect(() => {
    const time = Date.now();
    setNow(time);
    const delay = chatDiceRollRemaining(createdAt, time);
    if (!delay) return;
    const timer = window.setTimeout(() => setNow(Math.max(Date.now(), time + delay)), delay);
    return () => window.clearTimeout(timer);
  }, [createdAt]);
  const rolling = remaining > 0;
  return <span className={`yy-chat-dice${rolling ? ' is-rolling' : ''}`} role="img"
    aria-label={rolling ? '骰子正在转动' : `骰子：${value}点`} data-dice-value={rolling ? undefined : value}>
    <img className="yy-chat-dice-image" src={CHAT_DICE_IMAGES[value - 1]} alt="" draggable={false}/>
    {rolling && <span className="yy-chat-dice-cube" style={{
      transform: `rotateX(-18deg) rotateY(-26deg) ${rotations[value - 1]}`,
      animationDelay: `${remaining - CHAT_DICE_ROLL_MS}ms`,
    }}>
      {faces.map(face => <img key={face.value} src={CHAT_DICE_FACE_IMAGES[face.value - 1]} alt="" draggable={false}
        className="yy-chat-dice-face" style={{ transform: face.transform }}/>)}
    </span>}
  </span>;
}
