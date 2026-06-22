import { classNames } from "../../utils/helpers";

export function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button className={classNames("btn", `btn-${variant}`, className)} type="button" {...props}>
      {children}
    </button>
  );
}

