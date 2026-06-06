import { BdPlaceholder } from "@/components/bd/BdPlaceholder";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  sprint: number;
  description: string;
  icon?: LucideIcon;
}

export function BdPlaceholderSettings(props: Props) {
  return <BdPlaceholder {...props} />;
}
