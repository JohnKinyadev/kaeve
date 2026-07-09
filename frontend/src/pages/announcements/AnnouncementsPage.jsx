import { useEffect, useMemo, useState } from "react";
import { Megaphone, Send } from "lucide-react";

import { announcementsAPI } from "../../api/announcementsAPI";
import { membersAPI } from "../../api/membersAPI";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table } from "../../components/ui/Table";
import { formatDate } from "../../utils/formatters";

function listResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

const emptyForm = {
  title: "",
  body: "",
  audience: "all_members",
  members: [],
  is_active: true,
};

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [memberSearch, setMemberSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      announcementsAPI.list(),
      membersAPI.list({ status: "active", ordering: "full_name" }),
    ])
      .then(([announcementResponse, memberResponse]) => {
        if (!isMounted) return;
        setAnnouncements(listResults(announcementResponse));
        setMembers(listResults(memberResponse));
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Unable to load announcements");
      });
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return members.slice(0, 12);
    return members
      .filter((member) => {
        const name = `${member.membership_number} ${member.full_name} ${member.location}`.toLowerCase();
        return name.includes(query);
      })
      .slice(0, 12);
  }, [memberSearch, members]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleMember(memberId) {
    const stringId = String(memberId);
    setForm((current) => {
      const selected = current.members.map(String);
      const nextMembers = selected.includes(stringId)
        ? selected.filter((id) => id !== stringId)
        : [...selected, stringId];
      return { ...current, members: nextMembers };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      await announcementsAPI.create({
        ...form,
        members: form.audience === "selected_members" ? form.members : [],
      });
      setForm(emptyForm);
      setMemberSearch("");
      setMessage("Announcement published.");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Unable to publish announcement");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <article className="panel form-panel">
        <div className="panel-header">
          <div>
            <h2>Publish announcement</h2>
            <span>Send cooperative updates to every member or a selected group.</span>
          </div>
          <Megaphone size={22} />
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <Input label="Title" value={form.title} onChange={(event) => updateForm("title", event.target.value)} required />
          <label className="field">
            <span>Audience</span>
            <select value={form.audience} onChange={(event) => updateForm("audience", event.target.value)}>
              <option value="all_members">Everyone</option>
              <option value="selected_members">Certain members</option>
            </select>
          </label>
          <label className="field field-wide">
            <span>Message</span>
            <textarea value={form.body} onChange={(event) => updateForm("body", event.target.value)} required />
          </label>
          {form.audience === "selected_members" && (
            <div className="field field-wide">
              <span>Select members</span>
              <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search by name, membership number, or location" />
              <div className="member-picker">
                {filteredMembers.map((member) => (
                  <label className="check-row" key={member.id}>
                    <input
                      checked={form.members.map(String).includes(String(member.id))}
                      onChange={() => toggleMember(member.id)}
                      type="checkbox"
                    />
                    <span>{member.membership_number} - {member.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <div className="form-error field-wide">{error}</div>}
          {message && <div className="form-success field-wide">{message}</div>}
          <div className="form-actions">
            <Button type="submit" disabled={isSaving}>
              <Send size={16} /> {isSaving ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </form>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent announcements</h2>
            <span>Messages visible in member portals.</span>
          </div>
        </div>
        <Table
          columns={[
            { key: "title", label: "Title" },
            { key: "audience_display", label: "Audience" },
            { key: "is_active", label: "Status", render: (row) => <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Active" : "Inactive"}</Badge> },
            { key: "published_at", label: "Published", render: (row) => formatDate(row.published_at) },
          ]}
          rows={announcements}
        />
      </article>
    </div>
  );
}
