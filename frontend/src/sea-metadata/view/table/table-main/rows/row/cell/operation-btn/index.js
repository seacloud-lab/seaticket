import { IconButton } from '@/components';
import { CellType } from '@/sea-metadata/constants';
import PropTypes from 'prop-types';

import './index.css';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

const CellOperationBtn = ({ column, row }) => {
  switch (column.type) {
    case CellType.URL: {
      const value = getCellValueByColumn(row, column);
      return (<IconButton icon="url" className="sea-metadata-cell-op-btn" onClick={() => window.open(value)} />);
    }
    default: {
      return null;
    }
  }
};

CellOperationBtn.propTypes = {
  column: PropTypes.object.isRequired,
  row: PropTypes.object.isRequired,
};

export default CellOperationBtn;
