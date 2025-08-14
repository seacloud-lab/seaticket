import { OPERATION_TYPE } from './operations';
import context from '../context';

class LocalOperator {

  applyOperation(operation) {
    const { op_type } = operation;

    switch (op_type) {
      case OPERATION_TYPE.MODIFY_COLUMN_WIDTH: {
        const { column_key, new_width } = operation;
        try {
          const oldValue = context.localStorage.getItem('columns_width') || {};
          context.localStorage.setItem('columns_width', { ...oldValue, [column_key]: new_width });
        } catch (err) {
          break;
        }
        break;
      }
      default: {
        break;
      }
    }
  }

}

export default LocalOperator;
