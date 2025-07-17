import React from 'react';
import { createRoot } from 'react-dom/client';
import Icon from '../../components/icon';

const root = createRoot(document.getElementById('exclamation-circle-icon-wrapper'));

root.render(
  <>
    <Icon symbol="exclamation-circle" />
  </>
);
