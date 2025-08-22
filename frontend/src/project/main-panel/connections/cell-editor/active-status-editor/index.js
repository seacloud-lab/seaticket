import ActiveStatusEditorComponent from '@/components/active-status-editor';
import { gettext } from '@/constants';
import { useCallback, useMemo } from 'react';


const ActiveStatusEditor = ({
  isRowActive,
  value, column, row,
  onUpdate, cancelActive,
}) => {

  const options = useMemo(() => {
    return [
      {
        value: true,
        label: (
          <div className="label-container">
            <span>{gettext('Active')}</span>
          </div>
        ),
      }, {
        value: false,
        label: (
          <div className="label-container">
            <span>{gettext('Inactive')}</span>
          </div>
        ),
      }
    ];
  }, []);

  const currentOption = useMemo(() => {
    return options.find(o => o.value === value) || options[0];
  }, [value, options]);

  const onChange = useCallback((v) => {
    onUpdate && onUpdate({ [column.key]: v });
  }, [column, onUpdate]);

  return (
    <ActiveStatusEditorComponent
      isShowDropdownIcon={isRowActive}
      currentOption={currentOption}
      menuOptions={options}
      onChangeOption={onChange}
      closeShowDropdownIcon={cancelActive}
    />
  );
};

export default ActiveStatusEditor;
