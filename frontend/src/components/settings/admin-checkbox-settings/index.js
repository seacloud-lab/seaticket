import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import AdminSettingsTemplate from '../admin-settings-template';

const AdminCheckboxSettings = ({ keyText, value: oldValue, helpTip, displayName, onChange }) => {
  const [value, setValue] = useState(oldValue);

  const handleChange = useCallback((event) => {
    const checked = event.target.checked;
    const valueToNum = checked ? 1 : 0;
    setValue(checked);
    onChange && onChange(keyText, valueToNum);
  }, [keyText, onChange]);

  return (
    <AdminSettingsTemplate
      displayName={displayName}
      mainContent={
        <>
          <Input className="ml-0" checked={value} type='checkbox' onChange={handleChange} />
          <p className="ml-2 d-inline">{helpTip}</p>
        </>
      }
    />
  );
};

AdminCheckboxSettings.propTypes = {
  keyText: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  helpTip: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default AdminCheckboxSettings;
