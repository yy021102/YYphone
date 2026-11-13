import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { FirstUseGate } from './components/FirstUseGate';
import './index.css';
import { initializeDbStorage } from './utils/dbStorage';
import { installAndroidStatusBar } from './utils/androidStatusBar';
import { restoreLauncherIcon } from './utils/launcherIcons';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find the application root element.');
installAndroidStatusBar();

void initializeDbStorage()
  .catch((error: unknown) => {
    console.error('Could not initialize persistent storage.', error);
  })
  .finally(() => {
    try { restoreLauncherIcon(); } catch { console.warn('Could not restore the selected desktop icon.'); }
    createRoot(rootElement).render(<FirstUseGate><App /></FirstUseGate>);
  });
