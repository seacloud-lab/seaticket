import React, { useMemo } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';

import './index.css';

const Tooltip = ({
  className,
  isShowConfirmTip = false,
  confirmTip,
  placement,
  children,
  ...props
}) => {
  const customizeProps = useMemo(() => {
    return {
      hideArrow: true,
      fade: true,
      placement,
      className: classnames('sea-ticket-tooltip', className, placement, { 'sea-ticket-tooltip-with-confirm-tip': isShowConfirmTip }),
      ...props
    };
  }, [className, placement, isShowConfirmTip, props]);

  return (
    <UncontrolledTooltip { ...customizeProps }>
      <span className="sea-ticket-tooltip-text d-inline-block w-100">
        {children}
      </span>
      {isShowConfirmTip && (
        <span className="sea-ticket-tooltip-confirm-text">
          {confirmTip || gettext('Got it')}
        </span>
      )}
    </UncontrolledTooltip>
  );
};

export default Tooltip;
