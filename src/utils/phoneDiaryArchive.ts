import type { CharacterPhoneData, PhoneIcityDiary } from '../apps/PhoneExplorerApp';

export function collectPastDiaries(past: PhoneIcityDiary[] = [], diaries: PhoneIcityDiary[] = []): PhoneIcityDiary[] {
  const ids = new Set<string>(), contents = new Set<string>();
  return [...diaries, ...past].filter(diary => {
    if (!diary || typeof diary.id !== 'string' || typeof diary.content !== 'string' || !diary.content.trim()) return false;
    const signature = JSON.stringify([diary.dateStr, diary.timeStr, diary.content]);
    if (ids.has(diary.id) || contents.has(signature)) return false;
    ids.add(diary.id); contents.add(signature); return true;
  });
}

/** Archive the previous diary only after a validated generation succeeds. */
export function applyPhoneGeneratedPatch(current: CharacterPhoneData, patch: Partial<CharacterPhoneData>): CharacterPhoneData {
  return { ...current, ...patch, diaryArchive: patch.icityDiaries ? collectPastDiaries(current.diaryArchive, current.icityDiaries.filter(diary => !(current.deletedDiaryIds ?? []).includes(diary.id))) : current.diaryArchive ?? [] };
}
