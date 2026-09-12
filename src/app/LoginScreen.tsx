import type { ReactNode } from "react";

export function LoginScreen({ children }: { children: ReactNode }) {
  return (
    <div className="ecra-entrada">
      {children}
    </div>
  );
}
