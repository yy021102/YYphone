/** Use a steady white Android system-bar tint. Leave iOS tinting untouched. */
export function installAndroidStatusBar(): () => void {
  if (!/Android/i.test(navigator.userAgent)) return () => {};
  document.documentElement.dataset.yyphoneAndroid = '';
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.dataset.yyphoneAndroid = '';
  meta.content = '#ffffff';
  document.head.append(meta);
  return () => {
    meta.remove();
    delete document.documentElement.dataset.yyphoneAndroid;
  };
}
