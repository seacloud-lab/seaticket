import { IconButton } from '../../../../../components';
import { gettext } from '../../../../../constants';

import './index.css';

const OpFormatter = ({ onModify, onDelete, row }) => {
  return (
    <div className="sea-custom-table-op-formatter">
      {onModify && (<IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />)}
      {onDelete && (<IconButton className="bg-color-deep" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />)}
    </div>
  );
};

export default OpFormatter;
