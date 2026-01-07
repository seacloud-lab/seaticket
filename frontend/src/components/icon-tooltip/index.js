import React, { useRef } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import classnames from 'classnames';
import IconButton from '../icon-button';

import './index.css';

const IconTooltip = ({ icon = 'question-circle-filled', tip, className, placement = 'right', hoverBackground = false, ...props }) => {
  const ref = useRef(null);
  return (
    <>
      <IconButton
        icon={icon}
        ref={ref}
        className={classnames('sea-qa-tooltip-icon-btn', { 'no-hover-bg': !hoverBackground }, className)}
        { ...props }
      />
      <UncontrolledTooltip
        target={ref}
        placement={placement}
        fade={true}
        className="sea-metadata-tooltip"
      >
        {tip}
      </UncontrolledTooltip>
    </>
  );
};

export default IconTooltip;
