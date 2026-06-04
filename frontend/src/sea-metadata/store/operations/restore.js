import deepCopy from 'deep-copy';
import Operation from './model';
import { OPERATION_TYPE } from './constants';

function createOperation(op) {
  return new Operation(op);
}

export default function restore(operation) {
  const { op_type } = operation.clone();
  switch (op_type) {
    case OPERATION_TYPE.MODIFY_ROW: {
      const {
        row_id,
        old_row_data,
        is_copy_paste,
        fail_callback,
        success_callback,
      } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_LOCAL_ROW,
        is_copy_paste,
        row_id: deepCopy(row_id),
        updates: deepCopy(old_row_data),
        fail_callback,
        success_callback,
      });
    }
    case OPERATION_TYPE.MODIFY_ROWS: {
      const {
        id_old_row_data,
        is_copy_paste,
        fail_callback,
        success_callback,
      } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_LOCAL_ROWS,
        is_copy_paste,
        updates: deepCopy(id_old_row_data),
        fail_callback,
        success_callback,
      });
    }
    default: {
      break;
    }
  }
}
