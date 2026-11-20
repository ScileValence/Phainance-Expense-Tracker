export const COLORS = ["#6d5ef5", "#c8f23c", "#ff6b4a", "#22b8a6", "#f5a524", "#3b82f6", "#e85d9c"];

// stable color per category name
export const colorFor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};
