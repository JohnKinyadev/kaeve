import { Button } from "./Button";

export function Modal({ title, children, onClose, onConfirm, confirmLabel = "Confirm" }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </header>
        <div>{children}</div>
        <footer>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </footer>
      </section>
    </div>
  );
}

