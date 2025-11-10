import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import SelectOption from '../select-option';
import { getOption } from '@/sea-metadata/utils/column';

import './index.css';

const SingleSelectFormatter = ({ value, options, fontSize, className, column, row, onClick, children: emptyFormatter }) => {
  const option = useMemo(() => getOption(options, value), [options, value]);
  const props = {
    className: classnames('sea-metadata-ui cell-formatter-container single-select-formatter', className),
    onClick: column?.click && onClick ? onClick : () => {},
  };

  if (column.key === 'name' && !option && options.length === 0) {
    const newOption = {
      color: row.color,
      text_color: row.text_color,
      name: value,
      id: row._id,
    };
    return (
      <div { ...props }>
        <SelectOption option={newOption} fontSize={fontSize} />
      </div>
    );
  }

  return (
    <div { ...props }>
      {option ? (
        <SelectOption option={option} fontSize={fontSize} />
      ) : (
        <>{emptyFormatter || null}</>
      )}
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
