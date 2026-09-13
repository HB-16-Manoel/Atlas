export const LEGACY_ATLAS_KEYS = {
  tasks: "atlas-tasks",
  habits: "atlas-habits",
  events: "atlas-events",
  journal: "atlas-journal",
  taskHistory: "atlas-task-history",
} as const;

export type LegacyAtlasKey =
  (typeof LEGACY_ATLAS_KEYS)[keyof typeof LEGACY_ATLAS_KEYS];

export type LegacyAtlasBackup = Record<LegacyAtlasKey, string | null>;

function browserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export const legacyAtlasRepository = {
  getRaw(key: LegacyAtlasKey) {
    return browserStorage()?.getItem(key) ?? null;
  },

  setRaw(key: LegacyAtlasKey, value: string) {
    browserStorage()?.setItem(key, value);
  },

  createRawBackup(): LegacyAtlasBackup {
    return Object.values(LEGACY_ATLAS_KEYS).reduce(
      (backup, key) => ({ ...backup, [key]: this.getRaw(key) }),
      {} as LegacyAtlasBackup
    );
  },
};
