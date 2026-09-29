import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from './store.jsx';
import { UIProvider } from './components/ui.jsx';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UIProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </UIProvider>
  </StrictMode>
);
