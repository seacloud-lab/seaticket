import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '@/components/icon';

import './index.css';

const CheckboxEditor = ({
  isCellSelected,
  column,
  value,
  onChange,
}) => {
  const [canChange, setCanChange] = useState(false);

  useEffect(() => {
    if (isCellSelected) return;
    setCanChange(false);
  }, [isCellSelected]);

  const onChangeValue = useCallback((event) => {
    event && event.stopPropagation();
    onChange({ [column.key]: !value });
  }, [value, column, onChange]);

  const onClickContainer = useCallback(() => {
    if (!canChange) {
      setCanChange(true);
      return;
    }
    onChangeValue();
  }, [canChange, onChangeValue]);

  return (
    <div className="sea-metadata-checkbox-editor" onClick={onClickContainer}>
      <div className="sea-metadata-checkbox-editor-content" onClick={onChangeValue}>
        {value && (<Icon symbol="check-mark" />)}
      </div>
    </div>
  );

};

CheckboxEditor.propTypes = {
  isCellSelected: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.bool,
  onChange: PropTypes.func,
};

export default CheckboxEditor;
