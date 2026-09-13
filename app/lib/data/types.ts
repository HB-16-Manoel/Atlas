export type CloudId = string;
export type LegacyId = number | string;

export type CloudRecord = {
  id: CloudId;
  userId: CloudId;
  legacyId: LegacyId | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AtlasDataSource = "legacy-local" | "cloud";
