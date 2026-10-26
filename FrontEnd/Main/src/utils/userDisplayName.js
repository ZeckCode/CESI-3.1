function normalize(value) {
  return String(value || "").trim();
}

function joinName(firstName, lastName) {
  const first = normalize(firstName);
  const last = normalize(lastName);
  return [first, last].filter(Boolean).join(" ").trim();
}

function titleCase(value) {
  const clean = normalize(value).replace(/\s+/g, " ");
  if (!clean) return "";

  return clean
    .split(" ")
    .map((part) => {
      const head = part.charAt(0);
      const tail = part.slice(1);
      return `${head.toUpperCase()}${tail.toLowerCase()}`;
    })
    .join(" ");
}

export function getDisplayName(user, options = {}) {
  const { preferStudentProfile = false } = options;
  const profile = user?.profile || {};

  const studentName = joinName(profile.student_first_name, profile.student_last_name);
  const parentName = joinName(profile.parent_first_name, profile.parent_last_name);
  const rootName = joinName(user?.first_name, user?.last_name);

  const candidates = [
    normalize(user?.full_name),
    normalize(user?.display_name),
    normalize(user?.name),
    rootName,
    preferStudentProfile ? studentName : "",
    studentName,
    parentName,
  ];

  const explicitName = candidates.find((name) => normalize(name));
  if (explicitName) return explicitName;

  const rawIdentity = normalize(user?.username) || normalize(user?.email) || "User";
  const localPart = rawIdentity.includes("@") ? rawIdentity.split("@")[0] : rawIdentity;
  const cleaned = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

  return titleCase(cleaned) || "User";
}
