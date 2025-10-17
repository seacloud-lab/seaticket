import React from 'react';
import PropTypes from 'prop-types';
import CustomizePopover from '@/components/customize-popover';
import { Icon } from '@/components';
import { gettext } from '@/constants';
import { ROW_HEIGHT_TYPE } from '../../../constants/grid-body';

import './index.css';

const RowHeightPopover = ({ hidePopover, onChange, target, rowHeight }) => {
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
        <div className="sea-metadata-row-height-header">{gettext('Set row height')}</div>
        {Object.values(ROW_HEIGHT_TYPE).map((item, index) => (
          <div className="sea-metadata-row-height-item" onClick={() => onChange(item)} key={index}>
            <span className="sea-metadata-row-height-item-left">
              <Icon className="sea-metadata-icon" symbol={`row-height-${item}`} title={item}/>
              <span className="ml-2">{item}</span>
            </span>
            <span className="sea-metadata-row-height-item-right">
              {rowHeight === item && <Icon className="sea-metadata-icon" symbol="check" title={gettext('Selected')}/>}
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
