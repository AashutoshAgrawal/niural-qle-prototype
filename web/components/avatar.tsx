/**
 * Initials-based avatar with a stable colour based on the name hash.
 * Looks like the real avatars Niural would use before users upload photos.
 */
function colourFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `oklch(0.6 0.14 ${hue})`;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-7 w-7 text-[11px]" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ background: `linear-gradient(135deg, ${colourFromName(name)}, ${colourFromName(name + "x")})` }}
    >
      {initials(name)}
    </div>
  );
}
