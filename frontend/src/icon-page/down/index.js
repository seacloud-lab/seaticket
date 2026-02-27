import React from 'react';
import { createRoot } from 'react-dom/client';
import Icon from '../../components/icon';

const root = createRoot(document.getElementById('down-icon-wrapper'));

root.render(
  <>
    <Icon symbol="arrow-down" />
  </>
);

const rightdownIcon = createRoot(document.getElementById('right-down-icon-wrapper'));

rightdownIcon.render(
  <>
    <Icon symbol="arrow-down" />
  </>
);
