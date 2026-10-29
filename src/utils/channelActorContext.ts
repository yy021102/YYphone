import type { ChannelPerson } from './channelLife';
import { channelPerson, type ChannelSettings } from './channelProfile';
import { getWorldBookEntriesForContacts } from './worldBookPrompt';
import { readDirectMessages, buildJournalInjection, buildGrowthInjection } from './journalData';
import { buildMemoryInjection } from './memoryData';

export function channelWorldContext(settings: ChannelSettings, scanMessages: readonly string[] = []): string {
  return [...new Set([...getWorldBookEntriesForContacts([], undefined, scanMessages), ...getWorldBookEntriesForContacts([], settings.worldBookIds, scanMessages)])].join('\n');
}
/** Always read character settings fresh; optional personal context stays labelled by its owner. */
export async function buildChannelActorContext(actors: ChannelPerson[], contacts: ChannelPerson[], settings: ChannelSettings, query: string) {
  const ids = [...new Set(actors.map(actor => actor.id))];
  return Promise.all(ids.flatMap(id => {
    const source = contacts.find(contact => contact.id === id);
    if (!source) return [];
    return [(async () => {
      const person = channelPerson(source, settings);
      const role = settings.roles.find(role => role.contactId === id);
      const history = role?.injectChatContext === true ? readDirectMessages(id, { configuredHistory: true })
        .filter(message => message.senderId === 'user' || message.senderId === id || message.note).slice(-32) : [];
      const memories = role?.injectMemory === true ? await buildMemoryInjection([id], 'direct', query || role.persona || source.persona || '', () => person.name, { localOnly: true }) : undefined;
      const memory = role?.injectMemory === true ? [memories?.text, buildJournalInjection([id], 'direct', history[0]?.createdAt), buildGrowthInjection([id], 'direct')]
        .filter(Boolean).join('\n').slice(0, 14000) : undefined;
      return { id, name: person.name, originalPersona: source.persona?.slice(0, 8000) || '',
        worldBook: getWorldBookEntriesForContacts([id], undefined, [...history.map(message => message.text), query]).join('\n'),
        ...(role?.injectChatContext === true ? { privateChatContext: history.map(message => ({ from: message.senderId === 'user' ? '玩家' : person.name, date: message.createdAt, text: message.text })) } : {}),
        ...(role?.injectMemory === true ? { privateMemory: memory || '' } : {}) };
    })()];
  }));
}
