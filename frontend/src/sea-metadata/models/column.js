import { isDarkColor } from '@/utils/utils';
import { CellType } from '../constants';

class Column {
  constructor(object) {
    this.key = object.key || '';
    this.name = object.name || '';
    this.display_name = object.display_name || this.name || '';
    this.type = object.type || '';
    this.data = object.data || null;
    this.width = object.width || 200;

    this.is_required = object.is_required || false;
    this.is_predefined = object.is_predefined || true;
    this.editable = object.editable || false;
    this.frozen = object.frozen || false;
    this.rename_able = object.rename_able || false;
    this.is_name_column = object.is_name_column || false;
    this.modify_data_able = object.modify_data_able || false;
    this.delete_able = object.delete_able || false;
    this.click = object.click || null;

    this.sort_able = object.sort_able === false ? false : true;
    this.filter_able = object.filter_able === false ? false : true;

    // update single-select/multiple-select options
    if (this.type === CellType.SINGLE_SELECT || this.type === CellType.MULTIPLE_SELECT) {
      const options = this.data?.options || [];
      this.data = {
        ...this.data,
        options: options.map(o => {
          if (!o.textColor) return { ...o, textColor: isDarkColor(o.color) ? '#FFF' : '#212529' };
          return o;
        })
      };
    }
  }

}

export default Column;
