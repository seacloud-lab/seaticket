import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { formatWithTimezone } from '@/sea-metadata/constants/column/format';

const CTimeFormatter = ({ value, className, children: emptyFormatter }) => {
  if (!value) return emptyFormatter || null;
  return (
    <div
      className={classnames('sea-metadata-ui cell-formatter-container ctime-formatter', className)}
      title={formatWithTimezone(value)}
    >
      {dayjs(value).format('YYYY-MM-DD HH:mm:ss')}
    </div>
  );
};

CTimeFormatter.propTypes = {
  value: PropTypes.string.isRequired,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default CTimeFormatter;
