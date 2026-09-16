export const CONFIG = Object.freeze({
  title: '七宗罪 | 七美德',
  accessCode: 'SEVEN2026',
  version: 2,
  storageKey: 'seven-spectrum-v2',
});

export function acceptsCode(value) {
  return typeof value === 'string' && value.trim().toUpperCase() === CONFIG.accessCode.toUpperCase();
}
