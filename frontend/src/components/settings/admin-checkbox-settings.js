import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import AdminSettingsTemplate from './admin-settings-template';

const AdminCheckboxSettings = ({ keyText, value: oldValue, helpTip, onChange }) => {
  const [value, setValue] = useState(oldValue);

  const handleChange = useCallback((event) => {
    const checked = event.target.checked;
    const valueToNum = checked ? 1 : 0;
    setValue(checked);
    onChange(keyText, valueToNum);
  }, [keyText, onChange]);

  return (
    <AdminSettingsTemplate
      mainContent={
        <div className="mb-2">
          <Input className="ml-0" checked={value} type='checkbox' onChange={handleChange} />
          <p className="ml-2 d-inline">{helpTip}</p>
        </div>
      }
    />
  );
};

AdminCheckboxSettings.propTypes = {
  keyText: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  helpTip: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default AdminCheckboxSettings;
