import React, { useMemo } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { CustomizeLabel } from '@/components';

import './index.css';

const LinkSettings = ({ value, className = 'mb-4', linkedRecords }) => {

  const validValue = useMemo(() => {
    return value.map(v => ({ key: v, title: linkedRecords[v] }));
  }, [value, linkedRecords]);

  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <CustomizeLabel icon="link">
        {gettext('Linked ticket')}
      </CustomizeLabel>
      <div className="link-settings-content">
        {validValue.map(({ key, title }) => (
          <div className="link-item" key={key}>
            <span className="link-item-name" title={title}>{title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LinkSettings;
