import { Download } from "lucide-react";

import { Button } from "../ui/Button";

export function ExportButton({ children = "Export", ...props }) {
  return (
    <Button variant="secondary" {...props}>
      <Download size={16} /> {children}
    </Button>
  );
}

