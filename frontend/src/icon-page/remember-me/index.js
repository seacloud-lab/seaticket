import React from 'react';
import { createRoot } from 'react-dom/client';
import Icon from '../../components/icon';

import './index.css';

function initRememberMeToggle() {
  const wrapper = document.getElementById('remember-me-icon-wrapper');
  const input = document.getElementById('remember-me-input');
  if (!wrapper || !input) return;

  // only init once
  if (wrapper.dataset.rememberMeInited === 'true') return;
  wrapper.dataset.rememberMeInited = 'true';

  const toggle = () => {
    const checked = !input.checked;
    input.checked = checked;
    if (checked) {
      document.getElementById('remember-me-icon-outline').style.display = 'none';
      document.getElementById('remember-me-icon-checked').style.display = 'block';
    } else {
      document.getElementById('remember-me-icon-outline').style.display = 'block';
      document.getElementById('remember-me-icon-checked').style.display = 'none';
    }
  };

  wrapper.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });
}

const root = createRoot(document.getElementById('remember-me-icon-wrapper'));

root.render(
  <>
    <Icon id="remember-me-icon-outline" symbol="check-box-outline" className="remember-me-icon remember-me-icon-outline" />
    <Icon id="remember-me-icon-checked" symbol="check-box" className="remember-me-icon remember-me-icon-checked" />
  </>
);

initRememberMeToggle();
