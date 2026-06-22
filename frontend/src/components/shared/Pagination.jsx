import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../ui/Button";

export function Pagination({ page, totalPages, onPageChange }) {
  return (
    <div className="pagination">
      <Button variant="secondary" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
        <ChevronLeft size={16} /> Previous
      </Button>
      <span>Page {page} of {totalPages}</span>
      <Button variant="secondary" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
        Next <ChevronRight size={16} />
      </Button>
    </div>
  );
}

