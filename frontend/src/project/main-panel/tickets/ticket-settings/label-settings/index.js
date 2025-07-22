import React from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '../../../../../constants';

import './index.css';

const LabelSettings = ({ className = 'mb-4' }) => {
  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <Label>{gettext('Labels')}</Label>
      <div className="labels-formatter">
        <div className="tip-default">{gettext('Not support(todo)')}</div>
      </div>
    </div>
  );
};

export default LabelSettings;
