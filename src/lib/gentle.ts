/** The "_gentle" variant of a message key when gentle mode is on and the variant exists. */
export function gentleKey<K extends string>(key: K, gentle: boolean, has: (key: string) => boolean): K {
  const soft = `${key}_gentle`;
  return (gentle && has(soft) ? soft : key) as K;
}
