import React from 'react';
import { createRoot } from 'react-dom/client';
import Icon from '../../components/icon';

const root = createRoot(document.getElementById('down-icon-wrapper'));

root.render(
  <>
    <Icon symbol="arrow-down" />
  </>
);
