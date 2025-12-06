import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

import './index.css';

const CTimeFormatter = ({ value, className, column, children: emptyFormatter }) => {
  if (!value) return emptyFormatter || null;
  return (
    <div
      className={classnames('sea-metadata-ui cell-formatter-container ctime-formatter', className, { 'justify-content-start': column.width < 150 })}
      title={formatWithTimezone(value)}
    >
      {dayjs(value).format('YYYY-MM-DD HH:mm:ss')}
    </div>
  );
};

CTimeFormatter.propTypes = {
  value: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default CTimeFormatter;
