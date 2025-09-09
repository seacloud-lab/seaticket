import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import RateItem from './rate-item';
import classnames from 'classnames';
import CustomizePopover from '@/components/customize-popover';
import { RATE_LIST } from './constants';

import './index.css';

const RateEditor = ({ row, column, value: oldValue, onChange, isCellSelected }) => {
  const [value, setValue] = useState(oldValue || 0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setValue(oldValue || 0);
  }, [oldValue]);

  const onChangeValue = useCallback((val) => {
    if (val !== value) {
      setValue(val);
      onChange({ [column.key]: val });
    }
    setIsOpen(false);
  }, [value, column, onChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && Number(e.key) >= 0 && Number(e.key) <= 4) {
        e.preventDefault();
        e.stopPropagation();
        // eslint-disable-next-line
        const selectedPriority = RATE_LIST.find(item => item.hotKey == e.key);
        if (selectedPriority && selectedPriority.value !== value) {
          setValue(selectedPriority.value);
          onChange({ [column.key]: selectedPriority.value });
        }
        setIsOpen(false);
      }
      if (!isOpen && isCellSelected && e.key === 'Enter') {
        setIsOpen(true);
      }
      if (isOpen && e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onChangeValue, isOpen, isCellSelected]);

  return (
    <>
      <div className="sea-metadata-rate-editor d-flex" onClick={() => setIsOpen(!isOpen)} id={`rate-editor-${column.key}-${row._id}`}>
        <RateItem
          value={value}
          readOnly={true}
        />
      </div>
      {isOpen && (
        <CustomizePopover
          target={`rate-editor-${column.key}-${row._id}`}
          className={classnames('sea-metadata-rate-editor-popover-container')}
          hidePopover={() => setIsOpen(false)}
          hidePopoverWithEsc={() => setIsOpen(false)}
          modifiers={[
            { name: 'preventOverflow', options: { boundary: document.body } },
            { name: 'offset', options: { offset: [-6, 8] } }
          ]}
        >
          <div className="sea-metadata-rate-editor-popover">
            {RATE_LIST.map((item, index) => (
              <RateItem
                key={index}
                value={item.value}
                hotKey={item.hotKey}
                onClick={onChangeValue}
                readOnly={false}
                isSelected={item.value === value}
              />
            ))}
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

RateEditor.propTypes = {
  isCellSelected: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.number,
  onChange: PropTypes.func,
};

export default RateEditor;
