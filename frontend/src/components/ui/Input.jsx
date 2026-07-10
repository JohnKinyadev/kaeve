import { useId } from "react";

function fieldNameFromLabel(label) {
  return String(label || "field")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "field";
}

export function Input({ label, id, name, ...props }) {
  const generatedId = useId();
  const fieldName = name || fieldNameFromLabel(label);
  const inputId = id || `${fieldName}-${generatedId.replace(/:/g, "")}`;

  return (
    <label className="field" htmlFor={inputId}>
      {label && <span>{label}</span>}
      <input id={inputId} name={fieldName} {...props} />
    </label>
  );
}
