export function formatArea(areaHa: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(areaHa);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
