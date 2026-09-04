import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { HealthPollProvider } from './hooks/useHealthPoll';
import { LocaleProvider } from './i18n/LocaleContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <HealthPollProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HealthPollProvider>
    </LocaleProvider>
  </React.StrictMode>
);
