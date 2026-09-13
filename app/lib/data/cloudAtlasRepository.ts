import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Phase 2 boundary only. No Atlas component calls this repository yet, so
 * signing in cannot replace or mutate the legacy localStorage dataset.
 */
export function createCloudAtlasRepository(supabase: SupabaseClient) {
  return {
    async getAccountStatus() {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  };
}
