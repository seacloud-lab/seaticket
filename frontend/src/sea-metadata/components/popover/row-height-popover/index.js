import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import CustomizePopover from '@/components/customize-popover';
import { Icon } from '@/components';
import { gettext } from '@/constants';
import { ROW_HEIGHTS } from '../../../constants/grid-body';

import './index.css';

const RowHeightPopover = ({ hidePopover, onChange, target, rowHeight, readOnly }) => {

  const onChangeRowHeight = useCallback((height) => {
    if (readOnly) return;
    onChange(height);
    hidePopover();
  }, [onChange, hidePopover, readOnly]);

  return (
    <CustomizePopover
      target={target}
      className="sea-metadata-row-height-popover-container"
      hidePopover={hidePopover}
      hidePopoverWithEsc={hidePopover}
      modifiers={[
        { name: 'preventOverflow', options: { boundary: document.body } },
        { name: 'offset', options: { offset: [-6, 8] } }
      ]}
    >
      <div className="sea-metadata-row-height-wrapper">
        <div className="sea-metadata-row-height-header">{gettext('Select row height')}</div>
        {ROW_HEIGHTS.map((item, index) => (
          <div
            className={classnames('sea-metadata-row-height-item', { 'disabled': readOnly })}
            onClick={() => onChangeRowHeight(item.value)}
            key={index}
          >
            <span className="sea-metadata-row-height-item-left">
              <Icon className="sea-metadata-icon" symbol={item.icon} title={item.name}/>
              <span className="ml-2">{item.name}</span>
            </span>
            <span className="sea-metadata-row-height-item-right">
              {rowHeight === item.value && <Icon className="sea-metadata-icon" symbol="check" title={gettext('Selected')}/>}
            </span>
          </div>
        ))}
      </div>
    </CustomizePopover>
  );

};

RowHeightPopover.propTypes = {
  readOnly: PropTypes.bool,
  rowHeight: PropTypes.string,
  target: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  hidePopover: PropTypes.func.isRequired,
};

export default RowHeightPopover;
