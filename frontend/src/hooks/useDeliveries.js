const deliveries = [
  { id: 1, date: "2026-06-21", member: "Mary Wanjiku", weight: 340, grade: "AA", point: "Kiamumbi" },
  { id: 2, date: "2026-06-21", member: "Peter Kamau", weight: 215, grade: "AB", point: "Gathage" },
  { id: 3, date: "2026-06-20", member: "Grace Njeri", weight: 188, grade: "C", point: "Karura" },
];

export function useDeliveries() {
  return { deliveries };
}

