import React, { useEffect, useRef, useState } from 'react';
import { BirthdayScene } from './BirthdayScene';
import { BIRTHDAY_PREVIEW_EVENT, type BirthdayPreviewRequest } from './BirthdaySettings';
import {
  BIRTHDAY_CHANGE, BIRTHDAY_SEEN_KEY, birthdayDaysAway, birthdayIsDue, birthdayPreparationKey, birthdayUser, localBirthdayDate,
  nextBirthday, prepareBirthdayLetter, readBirthdayCharacters, readBirthdayLetters, readBirthdaySeen, readBirthdaySettings,
} from '../utils/birthday';
import { setStorageItemsAtomically } from '../utils/dbStorage';

export function BirthdayRuntime({ unlocked, atHome, onOpenChat }: { unlocked: boolean; atHome: boolean; onOpenChat: (chatId: string) => void }) {
  const [scene, setScene] = useState<BirthdayPreviewRequest | null>(null);
  const [revision, setRevision] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef<AbortController | null>(null), mounted = useRef(true);
  const attempted = useRef(new Set<string>()), opening = useRef(false);
  const settings = readBirthdaySettings();
  const configKey = JSON.stringify(settings);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => setRevision(v => v + 1);
    const preview = (e: Event) => { const request = (e as CustomEvent<BirthdayPreviewRequest>).detail; if (request) { setError(''); setScene(request); } };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(refresh, 30_000);
    window.addEventListener(BIRTHDAY_CHANGE, refresh);
    window.addEventListener(BIRTHDAY_PREVIEW_EVENT, preview);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; inFlight.current?.abort(); clearInterval(timer); window.removeEventListener(BIRTHDAY_CHANGE, refresh); window.removeEventListener(BIRTHDAY_PREVIEW_EVENT, preview); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  // Leaving the desktop cancels background work; an explicitly opened birthday remains interactive.
  useEffect(() => { if (!atHome && !scene || !unlocked) inFlight.current?.abort(); }, [atHome, unlocked, scene]);
  useEffect(() => { inFlight.current?.abort(); setError(''); }, [configKey]);
  useEffect(() => {
    if (!unlocked || !atHome || scene || opening.current || document.visibilityState === 'hidden') return;
    const current = readBirthdaySettings();
    if (!birthdayIsDue(current, readBirthdaySeen())) return;
    opening.current = true;
    const date = localBirthdayDate();
    void setStorageItemsAtomically({ [BIRTHDAY_SEEN_KEY]: [...readBirthdaySeen().filter(d => d !== date), date].slice(-20) })
      .then(() => { if (mounted.current) setScene({ settings: current, date, preview: false }); })
      .catch(err => { console.warn('Birthday appearance could not be recorded.', err); })
      .finally(() => { opening.current = false; });
  }, [unlocked, atHome, scene, revision, configKey]);

  const prepare = async (automatic: boolean) => {
    if (inFlight.current && !inFlight.current.signal.aborted) return;
    const current = !automatic && scene ? scene.settings : readBirthdaySettings(), date = !automatic && scene ? scene.date : nextBirthday(current.monthDay);
    if (!date || !current.characterIds.length) return;
    const ready = readBirthdayLetters(date, current), characters = readBirthdayCharacters();
    const ids = [...new Set(current.characterIds)].filter(id => characters.some(c => c.id === id) && !ready.some(l => l.characterId === id));
    const task = new AbortController(); inFlight.current = task;
    if (mounted.current) { setPreparing(true); setError(''); }
    const failures: string[] = [];
    try {
      for (const id of ids) {
        if (task.signal.aborted) break;
        const key = JSON.stringify([birthdayPreparationKey(date, id), configKey]);
        if (automatic && attempted.current.has(key)) continue;
        attempted.current.add(key);
        try { await prepareBirthdayLetter(id, date, task.signal); }
        catch (err) {
          if (task.signal.aborted) { attempted.current.delete(key); break; }
          failures.push(err instanceof Error ? err.message : '来信暂未准备好');
        }
      }
      if (mounted.current && !automatic && !task.signal.aborted) setError([...new Set(failures)].join('\n'));
    } finally {
      if (inFlight.current === task) { inFlight.current = null; if (mounted.current) { setPreparing(false); setRevision(v => v + 1); } }
    }
  };
  useEffect(() => {
    const current = readBirthdaySettings();
    if (unlocked && atHome && document.visibilityState !== 'hidden' && current.enabled && current.autoPrepare && birthdayDaysAway(current.monthDay) <= 7) {
      const characters = readBirthdayCharacters();
      const missing = current.characterIds.filter(id => characters.some(c => c.id === id) && !readBirthdayLetters(nextBirthday(current.monthDay), current).some(l => l.characterId === id));
      if (missing.some(id => !attempted.current.has(JSON.stringify([birthdayPreparationKey(nextBirthday(current.monthDay), id), configKey])))) void prepare(true);
    }
  }, [unlocked, atHome, revision, configKey]);
  if (!unlocked || !scene) return null;
  const letters = readBirthdayLetters(scene.date, scene.settings);
  const selected = readBirthdayCharacters().filter(c => scene.settings.characterIds.includes(c.id));
  return <BirthdayScene key={`${scene.date}:${scene.preview}`} date={scene.date} userName={birthdayUser().name} letters={letters}
    music={scene.settings.music} preview={scene.preview} preparing={preparing} error={error}
    onPrepare={!scene.preview && selected.length > letters.length ? () => void prepare(false) : undefined}
    onClose={() => { setScene(null); setError(''); }} onOpenChat={onOpenChat}/>;
}
