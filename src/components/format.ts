/** "A", "A and B", "A, B and C" using the user's locale. */
export const formatList = (items: string[], locale?: string) =>
  new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items)
