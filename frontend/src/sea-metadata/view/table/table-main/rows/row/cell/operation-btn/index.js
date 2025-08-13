import PropTypes from 'prop-types';

const CellOperationBtn = ({ column, row }) => {
  switch (column.type) {
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
