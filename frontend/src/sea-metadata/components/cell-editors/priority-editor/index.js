import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { PriorityEditor, PriorityIconBtn } from '@/components';
import { PRIORITIES, PRIORITY_MAP } from '../../../constants/column';

import './index.css';

const SeaMetadataPriorityEditor = ({ row, column, value: oldValue, onChange, isCellSelected }) => {
  const [value, setValue] = useState(oldValue || 0);
  const [isOpen, setIsOpen] = useState(false);

  const ref = useRef(null);

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
        const selectedPriority = PRIORITIES.find(item => item.hotKey == e.key);
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
      <div className="sea-metadata-priority-editor d-flex w-100 h-100" onClick={() => setIsOpen(!isOpen)} ref={ref}>
        <PriorityIconBtn priority={PRIORITY_MAP[value + '']} />
      </div>
      {isOpen && (
        <PriorityEditor
          target={ref}
          priorities={PRIORITIES}
          value={value}
          onChange={onChangeValue}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

SeaMetadataPriorityEditor.propTypes = {
  isCellSelected: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.number,
  onChange: PropTypes.func,
};

export default SeaMetadataPriorityEditor;
