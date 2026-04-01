import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode intentionally double-invokes effects in development
  // to surface side-effect bugs early. Does not affect production builds.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
