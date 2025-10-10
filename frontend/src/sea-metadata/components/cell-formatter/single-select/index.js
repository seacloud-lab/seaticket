import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import SelectOption from '../select-option';
import { getOption } from '@/sea-metadata/utils/column';

import './index.css';

const SingleSelectFormatter = ({ value, options, fontSize, className, column, row, children: emptyFormatter }) => {

  const option = useMemo(() => getOption(options, value), [options, value]);

  if (column.key === 'name' && !option && options.length === 0) {
    const newOption = {
      color: row.color,
      textColor: row.textColor,
      name: value,
      id: row._id,
    };
    return (
      <div className={classnames('sea-metadata-ui cell-formatter-container single-select-formatter', className)}>
        <SelectOption option={newOption} fontSize={fontSize} />
      </div>
    );
  }

  if (!option) return emptyFormatter || null;

  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container single-select-formatter', className)}>
      <SelectOption option={option} fontSize={fontSize} />
    </div>
  );
};

SingleSelectFormatter.propTypes = {
  value: PropTypes.string,
  options: PropTypes.array,
  fontSize: PropTypes.number,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default SingleSelectFormatter;
