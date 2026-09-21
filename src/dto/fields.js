// Lista positiva: agregar campos internos al modelo no los publica automáticamente.
export function pick(source, keys) {
  const result = {};
  for (const key of keys) if (source[key] !== undefined) result[key] = source[key];
  return result;
}
export function referenceId(value) {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (typeof value.toHexString === 'function') return value.toHexString();
  return referenceId(value._id ?? value.id);
}
