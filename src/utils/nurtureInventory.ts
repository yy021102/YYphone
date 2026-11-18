import { defaultDesign, validProduct, type GameProduct } from './nurtureDesign';
import { readStoredValue } from './localStorage';
import type { Save } from './nurture';

export type OwnedProduct = { id: string; product: GameProduct; status: 'owned' | 'sent'; acquiredAt: string; sentAt?: string };
export function readNurtureIdentity() {
  const identity = readStoredValue<Record<string, unknown> | null>('pocketos:personas', null, (v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v));
  return { id: typeof identity?.activeProfileId === 'string' ? identity.activeProfileId : '', name: '我' };
}
export function ownedProducts(save: Save): OwnedProduct[] {
  if (save.items) return save.items;
  const catalog = save.design?.shop ?? defaultDesign().shop;
  return (save.inventory ?? []).map((id, index) => ({ id: `legacy-${index}-${id}`, product: structuredClone(catalog.find(p => p.id === id) ?? { id, name: '已下架物品', description: '', type: '道具', price: 0, currency: 'coins' }), status: 'owned', acquiredAt: '' }));
}
export function validOwnedProduct(v: unknown): v is OwnedProduct {
  if (!v || typeof v !== 'object') return false;
  const item = v as OwnedProduct;
  return typeof item.id === 'string' && !!item.id && validProduct(item.product) && ['owned', 'sent'].includes(item.status) && typeof item.acquiredAt === 'string' && (item.sentAt === undefined || typeof item.sentAt === 'string');
}
export const productContext = ({ image, ...product }: GameProduct) => product;
