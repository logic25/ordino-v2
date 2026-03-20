import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { UniversalDocument } from "@/hooks/useUniversalDocuments";

interface Props {
  documents: UniversalDocument[];
  isLoading: boolean;
  emptyMessage?: string;
}

export function EntityDocumentsTab({ documents, isLoading, emptyMessage = "No documents linked" }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  const handleDownload = async (doc: UniversalDocument) => {
    const { data } = await supabase.storage
      .from("universal-documents")
      .createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead className="w-[80px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-medium text-sm">{doc.title}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs capitalize">{doc.category}</Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {format(new Date(doc.created_at), "MMM d, yyyy")}
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
