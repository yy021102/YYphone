import type { CharacterPhoneData } from '../apps/PhoneExplorerApp';

export interface PhoneVisit {
  id: string;
  location: string;
  dateStr: string;
  timeStr: string;
  duration: string;
  companion: string;
  activity: string;
  detail: string;
  note: string;
}

/** Older phones can show the details already present in their public photos. */
export const readPhoneVisits = (phone: CharacterPhoneData): PhoneVisit[] =>
  phone.visits ?? phone.photos.filter(photo => !photo.isPrivate && photo.location).slice(0, 5).map(photo => ({
    id: `photo-${photo.id}`, location: photo.location, dateStr: photo.dateStr,
    timeStr: '', duration: '', companion: '', activity: '',
    detail: photo.sceneDesc, note: photo.charThought,
  }));
