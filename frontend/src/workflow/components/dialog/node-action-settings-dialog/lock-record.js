import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../utils/constants';

function LockRecord(props) {
  return (
    <div className="lock-record-tip-content mt-2 mb-2">
      {gettext('Record will be locked')}
    </div>
  );
}

LockRecord.propTypes = {
  action: PropTypes.object.isRequired,
};

export default LockRecord;
