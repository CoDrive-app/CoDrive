import type { StopCategory } from './types';

export const IMG = {
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70',
  surf: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=900&q=70',
  coast: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&w=900&q=70',
  snorkel: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=70',
  sunset: 'https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?auto=format&fit=crop&w=900&q=70',
  resort: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=900&q=70',
  road: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=900&q=70',
  falls: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=70',
  hills: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=70',
  lake: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=70',
  peak: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=70',
};

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;

/** Three free Unsplash pictures for each kind of stop, so stops of one kind don't all look the same. */
export const STOP_IMAGES: Record<StopCategory, [string, string, string]> = {
  food: [photo('1712669079274-57e5de8aca9e'), photo('1775750219087-2c4023d007a9'), photo('1767769354536-bf79c6881687')],
  gas: [photo('1786108503363-4829ff5754c5'), photo('1768784210790-7630d85c059a'), photo('1654334036171-e01e52b2ce8e')],
  beach: [photo('1771002382315-9be24abde4e4'), photo('1503756234508-e32369269deb'), photo('1645225693761-614162c39c89')],
  sights: [photo('1759994174698-1730cdc74e3d'), photo('1515844038156-9ed1275916fb'), photo('1760683599799-925d8f6196b7')],
  lodging: [photo('1761538087574-41254b89f252'), photo('1785304968591-077766b38d74'), photo('1421790735934-58176b8292a7')],
};

/**
 * The picture for a stop of this kind, or null when the kind is unknown. Which of the three is picked comes from the
 * stop's id, so a stop keeps the same picture every time and for everyone.
 */
export function imageFor(category: StopCategory | null | undefined, stopId: string): string | null {
  if (!category) return null;
  let hash = 0;
  for (let i = 0; i < stopId.length; i += 1) hash = (hash * 31 + stopId.charCodeAt(i)) >>> 0;
  return STOP_IMAGES[category][hash % 3];
}

export function money(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function slug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'trip';
}
