import deepCopy from 'deep-copy';
import Operation from './model';
import { OPERATION_TYPE } from './constants';
import { getColumnOriginName } from '../../utils/column';

function createOperation(op) {
  return new Operation(op);
}

export default function invert(operation) {
  const { op_type } = operation.clone();
  switch (op_type) {
    case OPERATION_TYPE.INSERT_ROW: {
      return createOperation({
        type: OPERATION_TYPE.DELETE_ROW,
        row_id: operation.row._id,
        row_data: deepCopy(operation.row),
      });
    }
    case OPERATION_TYPE.DELETE_ROW: {
      return createOperation({
        type: OPERATION_TYPE.INSERT_ROW,
        row_data: deepCopy(operation.row_data),
      });
    }
    case OPERATION_TYPE.MODIFY_ROW: {
      const {
        row_id,
        row_update,
        old_row_data,
        is_copy_paste,
        fail_callback,
        success_callback,
      } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_ROW,
        is_copy_paste,
        row_id: deepCopy(row_id),
        row_update: deepCopy(old_row_data),
        old_row_data: deepCopy(row_update),
        fail_callback,
        success_callback,
      });
    }
    case OPERATION_TYPE.MODIFY_ROWS: {
      const {
        row_ids,
        id_row_updates,
        id_old_row_data,
        is_copy_paste,
        fail_callback,
        success_callback,
      } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_ROWS,
        is_copy_paste,
        row_ids: deepCopy(row_ids),
        id_row_updates: deepCopy(id_old_row_data),
        id_old_row_data: deepCopy(id_row_updates),
        fail_callback,
        success_callback,
      });
    }
    case OPERATION_TYPE.INSERT_COLUMN: {
      const { name, column_type, column_key, data } = operation;
      return createOperation({
        type: OPERATION_TYPE.DELETE_COLUMN,
        column_key,
        name,
        column_type,
        data,
      });
    }
    case OPERATION_TYPE.DELETE_COLUMN: {
      const { column_key, column } = operation;
      return createOperation({
        type: OPERATION_TYPE.INSERT_COLUMN,
        column_key,
        name: getColumnOriginName(column),
        column_type: column.type,
        data: column.data,
      });
    }
    case OPERATION_TYPE.RENAME_COLUMN: {
      const { column_key, new_name, old_name } = operation;
      return createOperation({
        type: OPERATION_TYPE.RENAME_COLUMN,
        column_key,
        new_name: old_name,
        old_name: new_name,
      });
    }
    case OPERATION_TYPE.MODIFY_COLUMN_DATA: {
      const { column_key, new_data, old_data, option_modify_type } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_COLUMN_DATA,
        column_key,
        new_data: old_data,
        old_data: new_data,
        option_modify_type,
      });
    }
    case OPERATION_TYPE.MODIFY_COLUMN_WIDTH: {
      const { column_key, new_width, old_width } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_COLUMN_WIDTH,
        column_key,
        new_width: old_width,
        old_width: new_width,
      });
    }
    case OPERATION_TYPE.MODIFY_COLUMN_ORDER: {
      const { view_id, new_columns_keys, old_columns_keys } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_COLUMN_ORDER,
        view_id,
        new_columns_keys: old_columns_keys,
        old_columns_keys: new_columns_keys,
      });
    }
    case OPERATION_TYPE.MODIFY_TICKET_TAGS: {
      const { file_tags_data } = operation;
      return createOperation({
        type: OPERATION_TYPE.MODIFY_TICKET_TAGS,
        file_tags_data: file_tags_data.map(item => {
          const { row_id, tags, old_tags } = item;
          return {
            row_id,
            tags: old_tags || [],
            old_tags: tags || [],
          };
        })
      });
    }
    default: {
      break;
    }
  }
}
