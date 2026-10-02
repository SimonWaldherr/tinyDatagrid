import { CalendarDate } from './temporal-values.js';
// History retains only changed values. Full comparison states are temporary and
// released at the end of each action, including nested/bulk actions.
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const kind = value => value instanceof Map ? 'map' : value instanceof Set ? 'set' : Array.isArray(value) ? 'array' : plain(value) ? 'object' : null;
const entries = value => value instanceof Map ? value : Object.entries(value);
const has = (value, key) => value instanceof Map ? value.has(key) : Object.hasOwn(value, key);
const get = (value, key) => value instanceof Map ? value.get(key) : value[key];

export function difference(before, after) {
  if (Object.is(before, after)) return null;
  if (before instanceof Date && after instanceof Date && Object.is(+before, +after)) return null;
  const type = kind(before);
  if (!type || type !== kind(after)) return { type: 'value', before, after };
  if (type === 'set') {
    const removed = [...before].filter(value => !after.has(value));
    const added = [...after].filter(value => !before.has(value));
    return removed.length || added.length ? { type, removed, added } : null;
  }
  if (type === 'array') {
    const changes=[];
    for(let index=0;index<Math.max(before.length,after.length);index++){
      const was=index in before,now=index in after;
      if(was===now&&Object.is(before[index],after[index]))continue;
      const patch=was&&now?difference(before[index],after[index]):{type:'value',before:before[index],after:after[index]};
      if(patch)changes.push({key:index,was,now,patch});
    }
    return changes.length||before.length!==after.length?{type,changes,...(before.length!==after.length?{lengths:[before.length,after.length]}:{})}:null;
  }
  const changes = [];
  for (const key of new Set([...entries(before), ...entries(after)].map(([key]) => key))) {
    const was = has(before, key), now = has(after, key);
    const patch = was && now ? difference(get(before, key), get(after, key)) : { type: 'value', before: get(before, key), after: get(after, key) };
    if (patch) changes.push({ key, was, now, patch });
  }
  const resized = type === 'array' && before.length !== after.length;
  return changes.length || resized ? { type, changes, ...(resized ? { lengths: [before.length, after.length] } : {}) } : null;
}

export function applyDifference(value, patch, forward) {
  if (patch.type === 'value') return copy(forward ? patch.after : patch.before);
  if (patch.type === 'set') {
    const result = new Set(value);
    for (const item of forward ? patch.removed : patch.added) result.delete(item);
    for (const item of forward ? patch.added : patch.removed) result.add(item);
    return result;
  }
  const result = patch.type === 'map' ? new Map(value) : patch.type === 'array' ? [...value] : { ...value };
  for (const { key, was, now, patch: child } of patch.changes) {
    if (forward ? now : was) {
      const next = applyDifference(get(result, key), child, forward);
      if (result instanceof Map) result.set(key, next);
      else Object.defineProperty(result, key, { value: next, enumerable: true, writable: true, configurable: true });
    } else if (result instanceof Map) result.delete(key);
    else delete result[key];
  }
  if (patch.lengths) result.length = patch.lengths[forward ? 1 : 0];
  return result;
}

function copy(value) {
  if(value instanceof CalendarDate)return new CalendarDate(value.getFullYear(),value.getMonth()+1,value.getDate());
  if (value instanceof Date) return new Date(value);
  if (value instanceof Map) return new Map([...value].map(([key, item]) => [key, copy(item)]));
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return value.map(copy);
  if (plain(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  return value;
}
