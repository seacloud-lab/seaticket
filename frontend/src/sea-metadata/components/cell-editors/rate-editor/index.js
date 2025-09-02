import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import RateItem from './rate-item';
import classnames from 'classnames';
import CustomizePopover from '@/components/customize-popover';
import { RATE_MAP } from './constants';

import './index.css';

const RateEditor = ({ row, column, value: oldValue, onChange }) => {
  const [value, setValue] = useState(oldValue || 0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setValue(oldValue || 0);
  }, [oldValue]);

  const onChangeValue = useCallback((val) => {
    const newValue = Number(val);
    if (newValue !== value && newValue > -1) {
      setValue(newValue);
      onChange({ [column.key]: newValue });
    }
    setIsOpen(false);
  }, [value, column, onChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && Number(e.key) >= 0 && Number(e.key) <= 4) {
        e.preventDefault();
        e.stopPropagation();
        const newValue = Number(e.key) + 1;
        if (newValue !== value && newValue > -1) {
          setValue(newValue);
          onChange({ [column.key]: newValue });
        }
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onChangeValue, isOpen]);

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
            {Object.keys(RATE_MAP).map((key) => (
              <RateItem
                key={key}
                index={Number(key)}
                value={key}
                onClick={onChangeValue}
                readOnly={false}
                isSelected={Number(key) === value}
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
