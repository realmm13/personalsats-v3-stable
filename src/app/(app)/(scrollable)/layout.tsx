import { HEADER_HEIGHT } from "@/config/config";
import { ReactNode } from "react";

export default function ScrollableLayout({ children }: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[var(--container-max-width)] px-4"
      style={{ paddingTop: `${HEADER_HEIGHT}px` }}
    >
      {children}
    </div>
  );
}
