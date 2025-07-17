import React from 'react';
import { createRoot } from 'react-dom/client';
import Icon from '../../components/icon';

import './index.css';

const root = createRoot(document.getElementById('eye-icon-wrapper'));

root.render(
  <>
    <Icon symbol="eye" />
    <Icon symbol="eye-slash" />
  </>
);
