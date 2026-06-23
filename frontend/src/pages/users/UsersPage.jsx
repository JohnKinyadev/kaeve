import { useState } from "react";

import { usersAPI } from "../../api/usersAPI";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Table } from "../../components/ui/Table";
import { SearchBar } from "../../components/shared/SearchBar";
import { useApiResource } from "../../hooks/useApiResource";
import { getResults, toQueryString } from "../../utils/helpers";

const roleOptions = [
  { value: "member", label: "Member" },
  { value: "secretary", label: "Secretary" },
  { value: "manager", label: "Manager" },
  { value: "field_officer", label: "Field Officer" },
  { value: "admin", label: "Admin" },
];

export function UsersPage() {
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState("");
  const path = `/api/users/${toQueryString({ search: query })}`;
  const { data, error, reload } = useApiResource(path);
  const users = getResults(data);

  async function updateRole(id, role) {
    setSavingId(id);
    setMessage("");
    try {
      await usersAPI.updateRole(id, role);
      await reload();
      setMessage("User role updated.");
    } catch (err) {
      setMessage(err.message || "Unable to update role.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="page-stack">
      {error && <div className="form-error">{error}</div>}
      {message && <div className={message.includes("Unable") ? "form-error" : "form-success"}>{message}</div>}
      <section className="toolbar">
        <SearchBar value={query} onChange={setQuery} placeholder="Search users by username, email, or role" />
      </section>
      <article className="panel">
        <Table
          columns={[
            { key: "username", label: "Username" },
            { key: "email", label: "Email" },
            { key: "phone_number", label: "Phone" },
            { key: "role", label: "Role", render: (row) => <Badge tone={row.role === "admin" ? "success" : "neutral"}>{row.role}</Badge> },
          ]}
          rows={users}
          renderActions={(row) => (
            <label className="inline-select">
              <span>Role</span>
              <select value={row.role} disabled={savingId === row.id} onChange={(event) => updateRole(row.id, event.target.value)}>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        />
      </article>
    </div>
  );
}
