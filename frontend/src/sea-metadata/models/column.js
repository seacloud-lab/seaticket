import { isDarkColor } from '@/utils/color-utils';
import { CellType } from '../constants';

class Column {
  constructor(object, columnWidthRules) {
    this.key = object.key || '';
    this.name = object.name || '';
    this.display_name = object.display_name || this.name || '';
    this.type = object.type || '';
    this.data = object.data || null;
    this.width = object.width || (columnWidthRules ? (columnWidthRules[this.name] || 200) : 200);
    this.is_width_fixed = object.is_width_fixed || false;

    this.is_required = object.is_required || false;
    this.is_predefined = object.is_predefined === false ? false : true;
    this.editable = object.editable || false;
    this.frozen = object.frozen || false;
    this.rename_able = object.rename_able || false;
    this.is_name_column = object.is_name_column || false;
    this.modify_data_able = object.modify_data_able || false;
    this.delete_able = object.delete_able || false;
    this.is_hover_show_content = object.is_hover_show_content || null;
    this.click = object.click || null;

    this.sort_able = object.sort_able === false ? false : true;
    this.filter_able = object.filter_able === false ? false : true;

    // update single-select/multiple-select options
    if (this.type === CellType.SINGLE_SELECT || this.type === CellType.MULTIPLE_SELECT) {
      const options = this.data?.options || [];
      this.data = {
        ...this.data,
        options: options.map(o => {
          if (!o.text_color) return { ...o, text_color: isDarkColor(o.color) ? '#FFF' : '#212529' };
          const { text_color, textColor, border_color, borderColor, ...others } = o;
          return { ...others, text_color: text_color || textColor, border_color: border_color || borderColor };
        })
      };
    }
  }

}

export default Column;
