import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import SelectOption from '../select-option';
import { useTypesData } from '@/sea-metadata/hooks';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const TypeFormatter = ({ value, fontSize, className, children: emptyFormatter }) => {
  const { typesData } = useTypesData();

  const option = useMemo(() => {
    return getRowById(typesData, value);
  }, [typesData, value]);

  if (!option) return emptyFormatter || null;

  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container single-select-formatter type-formatter', className)}>
      <SelectOption option={option} fontSize={fontSize} />
    </div>
  );
};

TypeFormatter.propTypes = {
  value: PropTypes.string,
  fontSize: PropTypes.number,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default TypeFormatter;
