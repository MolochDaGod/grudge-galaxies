/**
 * Scriptable object templates (the Core3 pattern, in TypeScript).
 *
 * Core3:  idl + Implementation  ->  game object type  ->  ObjectManager::registerObjectTypes
 *         C++ template class (readObject)  ->  TemplateManager::registerTemplateObjects / registerGlobals
 *         bin/scripts/object/*.lua  (templateType = X, ...fields)  ->  ObjectTemplates:addTemplate(t, "path.iff")
 *         SceneObject::loadTemplateData(templateData)
 *
 * Here:   registerObjectType('creature', CreatureTemplate)        (type -> template class with readObject)
 *         defineTemplate('object/creature/beast/dire_wolf', { templateType: 'creature', extends: '...', ...fields })
 *         instantiate('object/creature/...', target)  -> template.loadTemplateData(target)
 *
 * Templates are plain data, so they can come from code, JSON files, the database or a modding script, and are
 * validated by the template class's readObject. Inheritance (`extends`) is resolved field by field at definition time,
 * like Lua `:new {}` on a shared template.
 */

export type TemplateData = Record<string, unknown> & { templateType: string; extends?: string };

export abstract class ObjectTemplate {
  id = '';
  templateType = '';
  /** read and validate fields from script data (Core3 readObject(LuaObject*)) */
  readObject(d: TemplateData): void {
    this.templateType = d.templateType;
  }
  /** copy defaults onto a live object (Core3 SceneObject::loadTemplateData) */
  loadTemplateData(_target: Record<string, unknown>): void {}
}

type TemplateCtor = new () => ObjectTemplate;
const types = new Map<string, TemplateCtor>();
const raw = new Map<string, TemplateData>();
const built = new Map<string, ObjectTemplate>();

export function registerObjectType(type: string, ctor: TemplateCtor) {
  if (types.has(type)) throw new Error(`object type "${type}" already registered`);
  types.set(type, ctor);
}

function resolve(id: string, seen = new Set<string>()): TemplateData {
  const d = raw.get(id);
  if (!d) throw new Error(`unknown template "${id}"`);
  if (!d.extends) return d;
  if (seen.has(id)) throw new Error(`template inheritance cycle at "${id}"`);
  seen.add(id);
  const base = resolve(d.extends, seen);
  const merged: TemplateData = { ...base, ...d };
  // nested plain objects merge one level deep (e.g. ai: { aggro } overrides only aggro)
  for (const [k, v] of Object.entries(d)) {
    const b = (base as Record<string, unknown>)[k];
    if (v && b && typeof v === 'object' && typeof b === 'object' && !Array.isArray(v)) merged[k] = { ...(b as object), ...(v as object) };
  }
  return merged;
}

export function defineTemplate(id: string, data: TemplateData) {
  raw.set(id, data);
  built.delete(id);
  // children of a redefined template rebuild lazily too
  for (const [k, v] of raw) if (v.extends === id) built.delete(k);
}

export function getTemplate<T extends ObjectTemplate = ObjectTemplate>(id: string): T {
  let t = built.get(id);
  if (!t) {
    const d = resolve(id);
    const C = types.get(d.templateType);
    if (!C) throw new Error(`template "${id}" has unregistered templateType "${d.templateType}"`);
    t = new C();
    t.id = id;
    t.readObject(d);
    built.set(id, t);
  }
  return t as T;
}

export function hasTemplate(id: string) {
  return raw.has(id);
}

export function instantiate<T extends Record<string, unknown>>(id: string, target: T): T {
  getTemplate(id).loadTemplateData(target);
  return target;
}

export function listTemplates(prefix = '') {
  return [...raw.keys()].filter((k) => k.startsWith(prefix)).sort();
}

/* small field readers with defaults, used by template classes */
export const num = (d: Record<string, unknown>, k: string, def: number) => (typeof d[k] === 'number' && Number.isFinite(d[k] as number) ? (d[k] as number) : def);
export const str = (d: Record<string, unknown>, k: string, def: string) => (typeof d[k] === 'string' ? (d[k] as string) : def);
export const bool = (d: Record<string, unknown>, k: string, def: boolean) => (typeof d[k] === 'boolean' ? (d[k] as boolean) : def);
