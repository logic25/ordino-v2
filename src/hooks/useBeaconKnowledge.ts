import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBeaconKnowledgeList, syncDocumentToBeacon, FOLDER_TO_SOURCE_TYPE } from "@/services/beaconApi";

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
      return syncDocumentToBeacon(file, file.name, folder);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beacon-knowledge"] });
    },
  });
}
