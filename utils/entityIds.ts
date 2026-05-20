type EntityWithIds = {
  id?: unknown;
  _id?: unknown;
};

const toCleanId = (value: unknown) => String(value || '').trim();

export const getEntityId = (entity?: EntityWithIds | null) => toCleanId(entity?.id || entity?._id);

export const getEntityIds = (entity?: EntityWithIds | null) => {
  const ids = [toCleanId(entity?.id), toCleanId(entity?._id)].filter(Boolean);
  return Array.from(new Set(ids));
};

export const matchesEntityId = (entity: EntityWithIds | null | undefined, id: unknown) => {
  const targetId = toCleanId(id);
  return Boolean(targetId && getEntityIds(entity).includes(targetId));
};

export const findByEntityId = <T extends EntityWithIds>(items: T[], id: unknown) =>
  items.find((item) => matchesEntityId(item, id));

export const normalizeIdList = (values?: unknown[]) => (Array.isArray(values) ? values.map(toCleanId).filter(Boolean) : []);
