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
      className: classnames('seaqa-tooltip', className, placement, { 'seaqa-tooltip-with-confirm-tip': isShowConfirmTip }),
      ...props
    };
  }, [className, placement, isShowConfirmTip, props]);

  return (
    <UncontrolledTooltip { ...customizeProps }>
      <span className="seaqa-tooltip-text d-inline-block w-100">
        {children}
      </span>
      {isShowConfirmTip && (
        <span className="seaqa-tooltip-confirm-text">
          {confirmTip || gettext('Got it')}
        </span>
      )}
    </UncontrolledTooltip>
  );
};

export default Tooltip;
