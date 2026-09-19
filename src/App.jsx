import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import AppRoutes from './AppRoutes';

import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}