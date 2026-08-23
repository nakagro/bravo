// Renders a YYYY-MM-DD date string in Australian day-month-year order for
// display, since it's stored/compared in ISO order but read by non-technical
// members who expect DD-MM-YYYY.
export function formatDateAU(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}-${month}-${year}`;
}
