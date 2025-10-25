import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { getDateDisplayString } from '../../../utils/column';

import './index.css';

const DateFormatter = ({ value, format, column, className, children: emptyFormatter }) => {
  const displayValue = useMemo(() => {
    return getDateDisplayString(value, format);
  }, [value, format]);
  const subDisplayValue = useMemo(() => {
    const { sub_format } = column.data;
    const subFormat = sub_format || format;
    return getDateDisplayString(value, subFormat);
  }, [value, format, column]);

  if (!displayValue) return emptyFormatter || null;
  return (
    <div
      className={classnames('sea-metadata-ui cell-formatter-container date-formatter', className)}
      title={subDisplayValue}
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
