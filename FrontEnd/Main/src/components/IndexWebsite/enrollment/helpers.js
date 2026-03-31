// helpers.js
export const fmtDate = (date) =>
  date instanceof Date
    ? date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

export const formatMoney = (value) => Number(value || 0).toLocaleString();

export const onlyDigits = (value, max = 20) =>
  String(value || "").replace(/\D/g, "").slice(0, max);

export const normalizePHMobile = (number) => {
  if (!number) return null;
  const cleaned = String(number).replace(/\D/g, "");
  if (/^09\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(1);
  if (/^639\d{9}$/.test(cleaned)) return "+" + cleaned;
  return null;
};

export const calcAge = (yyyyMMdd) => {
  if (!yyyyMMdd) return null;
  const bd = new Date(yyyyMMdd + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
};

export const buildName = (first, middle, last) =>
  [first, middle, last].map((p) => p.trim()).filter(Boolean).join(" ");

export const buildAddress = ({ street, barangay, city, province, region }) =>
  [street, barangay, city, province, region]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");

export const computeEnrollmentWindow = (settings) => {
  const autoOpen = () => {
    const today = new Date();
    const year = today.getFullYear();
    const startYear = today.getMonth() >= 5 ? year : year - 1;
    return new Date(startYear, 5, 1);
  };

  const openDate = settings?.open_date
    ? new Date(settings.open_date + "T00:00:00")
    : autoOpen();

  const days = Math.max(1, parseInt(settings?.window_days ?? 7, 10));
  const closeDate = new Date(openDate);
  closeDate.setDate(openDate.getDate() + days - 1);
  closeDate.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOpen = today >= openDate && today <= closeDate;
  const daysLeft = isOpen ? Math.ceil((closeDate - today) / 86400000) : 0;

  const autoAY = () => {
    const y = openDate.getFullYear();
    return `${y}-${y + 1}`;
  };

  const academicYear = settings?.academic_year || autoAY();
  const nextOpenDate = new Date(closeDate.getFullYear() + 1, 5, 1);

  return { isOpen, openDate, closeDate, daysLeft, academicYear, nextOpenDate };
};