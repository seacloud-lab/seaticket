import React, { useMemo } from 'react';
import classnames from 'classnames';
import OptionsEditor from '../option-editor';

import './index.css';

const PriorityEditor = ({
  target,
  className,
  priorities,
  modifiers = [
    { name: 'preventOverflow', options: { boundary: document.body } },
    { name: 'offset', options: { offset: [-6, 8] } }
  ],
  value,
  onChange,
  onToggle,
}) => {

  const options = useMemo(() => {
    return priorities.map(priority => {
      return {
        value: priority.value,
        icon: priority.icon,
        name: priority.name,
        label: (
          <div className="sea-ticket-priority-editor-option-name-hotkey d-flex justify-content-between w-100" >
            <div className="sea-ticket-priority-editor-option-name">{priority.name}</div>
            <div className="sea-ticket-priority-editor-option-hotkey">{priority.hotKey}</div>
          </div>
        ),
      };
    });
  }, [priorities]);

  return (
    <OptionsEditor
      target={target}
      className={classnames('sea-ticket-priority-editor-popover popover-radius-4', className)}
      onToggle={onToggle}
      value={value}
      isSearchEnabled={false}
      checkPlacement="left"
      options={options}
      modifiers={modifiers}
      sameWidthWithTarget={240}
      onChange={(newValue) => onChange(newValue || 0)}
    />
  );
};

export default PriorityEditor;
