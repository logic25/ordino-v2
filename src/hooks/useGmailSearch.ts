import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GmailSearchResult {
  id: string | null;
  gmail_message_id: string;
  subject: string;
  from_email: string;
  from_name: string;
  date: string;
  snippet: string;
  has_attachments: boolean;
  is_read: boolean;
  source: "synced" | "gmail";
}

export function useGmailSearch() {
  const [results, setResults] = useState<GmailSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const search = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-search", {
        body: { query, maxResults: 30 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResults(data.results || []);
    } catch (err: any) {
      toast({
        title: "Search failed",
        description: err.message,
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setResults([]);
    setHasSearched(false);
  };

  return { results, isSearching, hasSearched, search, clearSearch };
}
