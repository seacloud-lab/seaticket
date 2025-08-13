import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Input, PopoverBody } from 'reactstrap';
import CustomizePopover from '@/components/customize-popover';
import toaster from '@/components/toaster';
import { gettext, KeyCodes } from '@/constants';
import { useMetadata } from '../../../hooks';
import { ValidateColumnFormColumns } from '../column-popover/utils';
import { COMMON_FORM_COLUMN_TYPE } from '../column-popover/constants';

import './index.css';

const RenamePopover = ({ value: oldValue, target, onToggle, onSubmit }) => {
  const [value, setValue] = useState(oldValue);
  const inputRef = useRef(null);
  const { metadata } = useMetadata();

  const onChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === value) return;
    setValue(newValue);
  }, [value]);

  const handleSubmit = useCallback(() => {
    if (value === oldValue) {
      onToggle();
      return;
    }
    const valueError = ValidateColumnFormColumns[COMMON_FORM_COLUMN_TYPE.COLUMN_NAME]({ columnName: value, metadata, gettext });
    if (valueError) {
      toaster.danger(valueError.tips);
      return;
    }
    onSubmit(value);
  }, [value, oldValue, metadata, onSubmit, onToggle]);

  const onHotKey = useCallback((event) => {
    if (event.keyCode === KeyCodes.Enter) {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const onClick = useCallback((event) => {
    event.preventDefault();
  }, []);

  useEffect(() => {
    inputRef.current.focus();
    document.addEventListener('keydown', onHotKey);
    return () => {
      document.removeEventListener('keydown', onHotKey);
    };
  }, [onHotKey]);

  return (
    <CustomizePopover target={target} popoverClassName="sea-metadata-rename-column-popover" hidePopover={handleSubmit} hidePopoverWithEsc={onToggle}>
      <PopoverBody className='p-4'>
        <Input value={value} innerRef={inputRef} onClick={onClick} onChange={onChange} />
      </PopoverBody>
    </CustomizePopover>
  );
};

RenamePopover.propTypes = {
  target: PropTypes.string,
  value: PropTypes.string,
  onToggle: PropTypes.func,
  onSubmit: PropTypes.func,
};

export default RenamePopover;
