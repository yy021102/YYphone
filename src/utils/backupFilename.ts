export function backupFilename(dated: boolean, date = new Date()): string {
  if (!dated) return 'yyphone-backup.json';
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join('-');
  return `yyphone-backup-${day}_${time}.json`;
}
