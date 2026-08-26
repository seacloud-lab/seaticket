import React from 'react';
import { Input } from 'reactstrap';
import { CONNECTION_FIELD_TYPE } from '../../constants';
import { TextInput, PasswordInput, CustomizeSelect } from '@/components';

const Editor = ({ api, column, row, readonly, canModifyPassword = true, onChange }) => {
  const { key, type, placeholder, default_value, options, can_edit_multiple_times = true, } = column;

  const value = row[key] !== undefined ? row[key] : (default_value || '');

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
      return (
        <CustomizeSelect
          value={value}
          options={options}
          disabled={readonly}
          isInModal={true}
          onChange={(newValue) => onChange(key, newValue)}
        />
      );
    }
    case CONNECTION_FIELD_TYPE.SYNC_SELECT: {
      return (
        <CustomizeSelect
          isRemote={true}
          value={value}
          api={api}
          placeholder={placeholder}
          disabled={readonly}
          isInModal={true}
          searchable={true}
          onChange={(newValue, newValueOption) => onChange(key, newValueOption)}
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
