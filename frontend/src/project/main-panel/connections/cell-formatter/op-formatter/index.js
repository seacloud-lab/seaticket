import { IconButton } from '../../../../../components';
import { gettext } from '../../../../../constants';

import './index.css';

const OpFormatter = ({ onModify, onDelete, showStatus, row }) => {
  return (
    <div className="sea-custom-table-op-formatter">
      {onModify && (<IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />)}
      {onDelete && (<IconButton className="bg-color-deep" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />)}
      {showStatus && (<IconButton className="bg-color-deep" title={gettext('Status')} icon="status" onClick={() => showStatus(row)} />)}
    </div>
  );
};

export default OpFormatter;
