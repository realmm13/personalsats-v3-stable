import { ReactNode } from "react";

export default function FullPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] flex-col">
      {children}
    </div>
  );
}
