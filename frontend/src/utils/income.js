export const SOURCES = [
  { value: "SALARY", label: "Salary", color: "#6d5ef5" },
  { value: "FREELANCE", label: "Freelance", color: "#22b8a6" },
  { value: "GIFT", label: "Gift", color: "#ff6b4a" },
  { value: "OTHER", label: "Other", color: "#f5a524" },
];

export const sourceMeta = (v) => SOURCES.find((s) => s.value === v) || SOURCES[3];
