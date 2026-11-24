import { apiFetch, apiFetchData } from "./apiFetch";

export async function getSchoolYear() {
  const res = await apiFetch("/api/classmanagement/school-years/active/");

  // "No active school year" is a valid state, not a failure.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load school year");
  return res.json();
}

export async function fetchAnnouncements() {
  return apiFetchData("/api/announcements/");
}

export async function createAnnouncement({
  title,
  content,
  target_role,
  publish_date,
  files,
}) {
  const form = new FormData();
  form.append("title", title);
  form.append("content", content);
  form.append("target_role", target_role);
  form.append("publish_date", publish_date);

  for (const file of files) {
    form.append("files", file);
  }

  return apiFetchData("/api/announcements/create-with-media/", {
    method: "POST",
    body: form,
  });
}
