import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { FirstUseGate } from './components/FirstUseGate';
import './index.css';
import { initializeDbStorage } from './utils/dbStorage';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find the application root element.');

void initializeDbStorage()
  .catch((error: unknown) => {
    console.error('Could not initialize persistent storage.', error);
  })
  .finally(() => {
    createRoot(rootElement).render(<FirstUseGate><App /></FirstUseGate>);
  });
