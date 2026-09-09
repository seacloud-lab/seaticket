import React, { useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { getDateDisplayString } from '../../../utils/column';

const DateFormatter = ({ value, format, className, children: emptyFormatter }) => {

  const displayValue = useMemo(() => {
    return getDateDisplayString(value, format);
  }, [value, format]);

  if (!displayValue) return emptyFormatter || null;
  return (
    <div
      className={classnames('sea-metadata-ui cell-formatter-container', className)}
      title={formatWithTimezone(value)}
    >
      {displayValue}
    </div>
  );
};

DateFormatter.propTypes = {
  value: PropTypes.any,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default DateFormatter;
