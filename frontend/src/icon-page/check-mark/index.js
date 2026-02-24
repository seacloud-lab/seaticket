import React from 'react';
import { createRoot } from 'react-dom/client';
import Icon from '../../components/icon';

const CheckMarkIcon = createRoot(document.getElementById('check-mark-icon-wrapper'));

CheckMarkIcon.render(
  <>
    <Icon symbol="check-mark" />
  </>
);

const UnCheckMarkIcon = createRoot(document.getElementById('un-check-mark-icon-wrapper'));

UnCheckMarkIcon.render(
  <>
    <Icon symbol="check-mark" />
  </>
);
