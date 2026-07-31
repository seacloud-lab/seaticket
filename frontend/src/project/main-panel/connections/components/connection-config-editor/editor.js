import React from 'react';
import { Input } from 'reactstrap';
import { CONNECTION_FIELD_TYPE } from '../../constants';
import { TextInput, PasswordInput, CustomizeSelect } from '@/components';
import CustomizeSelectSync from '@/components/customize-select-sync';

const Editor = ({ api, column, row, readonly, canModifyPassword = true, onChange }) => {
  const { key, type, placeholder, default_value, options, can_edit_multiple_times = true, } = column;

  let value = row[key] !== undefined ? row[key] : (default_value || '');
  if (column.is_path_list && Array.isArray(value)) {
    value = value.join('\n');
  }

  switch (type) {
    case CONNECTION_FIELD_TYPE.PASSWORD: {
      if (!can_edit_multiple_times && !canModifyPassword) {
        return (<Input value="********" disabled={true} />);
      }
      return (
        <PasswordInput
          value={value}
          placeholder={placeholder}
          enableCheckStrength={false}
          disabled={readonly}
          onChange={(newValue) => onChange(key, newValue)}
        />
      );
    }
    case CONNECTION_FIELD_TYPE.NUMBER: {
      return (
        <Input
          type="number"
          value={value}
          placeholder={placeholder}
          disabled={readonly}
          onChange={(e) => onChange(key, parseInt(e.target.value) || default_value)}
        />
      );
    }
    case CONNECTION_FIELD_TYPE.SELECT: {
      const option = options.find(o => o.value === value);
      return (
        <CustomizeSelect
          value={option}
          options={options}
          disabled={readonly}
          onChange={(newValue) => onChange(key, newValue)}
        />
      );
    }
    case CONNECTION_FIELD_TYPE.SYNC_SELECT: {
      return (
        <CustomizeSelectSync
          value={value}
          api={api}
          placeholder={placeholder}
          disabled={readonly}
          onChange={(newValue) => onChange(key, newValue)}
        />
      );
    }
    case CONNECTION_FIELD_TYPE.LONG_TEXT: {
      return (
        <Input
          type="textarea"
          rows={4}
          placeholder={placeholder}
          value={value}
          disabled={readonly}
          onChange={(e) => onChange(key, e.target.value)}
        />
      );
    }

    default: {
      return (
        <TextInput placeholder={placeholder} value={value} disabled={readonly} onChange={(newValue) => onChange(key, newValue)} />
      );
    }
  }
};

export default Editor;
