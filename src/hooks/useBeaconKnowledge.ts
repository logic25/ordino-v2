import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBeaconKnowledgeList, FOLDER_TO_SOURCE_TYPE } from "@/services/beaconApi";

const BEACON_API_URL = import.meta.env.VITE_BEACON_API_URL || 'https://beaconrag.up.railway.app';

export function useBeaconKnowledge() {
  return useQuery({
    queryKey: ["beacon-knowledge"],
    queryFn: fetchBeaconKnowledgeList,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useUploadToBeaconKB() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, folder }: { file: File; folder: string }) => {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("source_type", FOLDER_TO_SOURCE_TYPE[folder] || "reference");
      formData.append("folder", folder);

      const res = await fetch(`${BEACON_API_URL}/api/ingest`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Ingest error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beacon-knowledge"] });
    },
  });
}
