const icons = ['default', 'sunlit-sea', 'mist-garden', 'ascii-lily', 'pastel-yy', 'silent-manuscript', 'ndsl', 'slot', 'claw'];
export const launcherHead = `<meta name="application-name" content="歪歪机"><meta name="apple-mobile-web-app-title" content="歪歪机"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/app-icon-options/pastel-yy/icon-180.png"><link rel="icon" type="image/png" href="/app-icon-options/pastel-yy/icon-512.png">`;
export const launcherScript = `<script>const launcherChoice=new URL(location.href).searchParams.get('launcher');if(${JSON.stringify(icons)}.includes(launcherChoice)){const iconRoot='/app-icon-options/'+launcherChoice+'/';document.querySelector('link[rel="manifest"]').href=iconRoot+'manifest.webmanifest';document.querySelector('link[rel="apple-touch-icon"]').href=iconRoot+'icon-180.png';document.querySelector('link[rel="icon"]').href=iconRoot+'icon-512.png';}</script>`;
export function isLauncherMetadataPath(path) {
  if (path === '/manifest.json') return true;
  const match = /^\/app-icon-options\/([^/]+)\/(manifest\.webmanifest|icon-(?:180|192|512)\.png)$/.exec(path);
  return !!match && icons.includes(match[1]);
}
