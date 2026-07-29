import { useAppStore } from '@/store/useAppStore';
import { AppShell } from './layout/AppShell';
import { ChatView } from './views/ChatView';
import { WorkspaceView } from './views/WorkspaceView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const activeView = useAppStore((s) => s.activeView);

  return (
    <AppShell>
      {activeView === 'chat' && <ChatView />}
      {activeView === 'workspace' && <WorkspaceView />}
      {activeView === 'settings' && <SettingsView />}
    </AppShell>
  );
}
