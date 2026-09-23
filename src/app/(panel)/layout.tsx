import PanelShell from "@/src/components/PanelShell";

// Every screen in this group is behind the partner session; the shell does the
// gate and the chrome.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
