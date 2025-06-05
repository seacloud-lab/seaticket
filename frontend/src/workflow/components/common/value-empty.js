import React from 'react';

import '../../css/workflow-value-empty.css';

const gettext = window.gettext;

function ValueEmpty() {
  return (
    <div className="workflow-value-empty">
      {gettext('Empty')}
    </div>
  );
}

export default ValueEmpty;
