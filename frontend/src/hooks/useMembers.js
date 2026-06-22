import { useMemo, useState } from "react";

const seedMembers = [
  { id: 1, membershipNo: "KCV-0012", name: "Mary Wanjiku", phone: "+254 712 440 812", farmSize: "2.4 acres", status: "Active", location: "Kiamumbi" },
  { id: 2, membershipNo: "KCV-0041", name: "Peter Kamau", phone: "+254 733 910 204", farmSize: "1.8 acres", status: "Active", location: "Gathage" },
  { id: 3, membershipNo: "KCV-0087", name: "Grace Njeri", phone: "+254 720 118 344", farmSize: "3.1 acres", status: "Inactive", location: "Karura" },
];

export function useMembers() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const members = useMemo(() => {
    return seedMembers.filter((member) => {
      const matchesQuery = `${member.membershipNo} ${member.name} ${member.location}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "All" || member.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return { members, query, setQuery, status, setStatus };
}

