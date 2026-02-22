import { AppLayout } from "@/components/layout/AppLayout";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function Chat() {
  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)]">
        <ChatPanel className="h-full rounded-lg border" />
      </div>
    </AppLayout>
  );
}
