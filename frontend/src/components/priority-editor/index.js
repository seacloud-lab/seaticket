import React, { useMemo } from 'react';
import classnames from 'classnames';
import OptionsEditor from '../options-editor';

import './index.css';

const PriorityEditor = ({
  className,
  priorities,
  modifiers = [
    { name: 'preventOverflow', options: { boundary: document.body } },
    { name: 'offset', options: { offset: [-6, 8] } }
  ],
  onChange,
  ...props
}) => {

  const options = useMemo(() => {
    return priorities.map(priority => {
      return {
        value: priority.value,
        icon: priority.icon,
        name: priority.name,
        label: (
          <div className="seaqa-priority-editor-option-name-hotkey d-flex justify-content-between w-100">
            <div className="seaqa-priority-editor-option-name">{priority.name}</div>
            <div className="seaqa-priority-editor-option-hotkey">{priority.hotKey}</div>
          </div>
        ),
      };
    });
  }, [priorities]);

  return (
    <OptionsEditor
      className={classnames('seaqa-priority-editor-popover', className)}
      isSearchEnabled={false}
      isCloseSubmit={false}
      checkPlacement="left"
      options={options}
      modifiers={modifiers}
      onChange={(newValue) => onChange(newValue || 0)}
      { ...props }
    />
  );
};

export default PriorityEditor;
