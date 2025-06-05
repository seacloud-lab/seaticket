import React from 'react';
import PropTypes from 'prop-types';
import { getActionName } from '../../../utils/node-action-utils';

function ActionItem(props) {
  const { action, onSelectAction, onDeleteAction } = props;
  const actionName = getActionName(action);

  return (
    <div className="node-action-item d-flex align-items-center w-100 pl-2 pr-2">
      <div className="text-truncate" title={actionName}>{actionName}</div>
      <div className="node-action-item-operations d-flex align-items-center ml-2">
        <div className="node-action-item-operation mr-1" onClick={onSelectAction}>
          <i className="dtable-font dtable-icon-rename"></i>
        </div>
        <div className="node-action-item-operation" onClick={onDeleteAction}>
          <i className="dtable-font dtable-icon-delete"></i>
        </div>
      </div>
    </div>
  );
}

ActionItem.propTypes = {
  action: PropTypes.object.isRequired,
  onSelectAction: PropTypes.func.isRequired,
  onDeleteAction: PropTypes.func.isRequired,
};

export default ActionItem;
