import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDbStorage } from './utils/dbStorage';
import { initViewportKeyboardLayout } from './utils/viewportKeyboard';

initViewportKeyboardLayout();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find the application root element.');

void initializeDbStorage()
  .catch((error: unknown) => {
    console.error('Could not initialize persistent storage.', error);
  })
  .finally(() => {
    createRoot(rootElement).render(<App />);
  });
