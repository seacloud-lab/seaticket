import React from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import CellLabel from './cell-label';

export default class FormLabel extends React.Component {

  static propTypes = {
    column: PropTypes.object,
  };

  render() {
    const { column } = this.props;
    const { type, name, custom_name } = column;
    if (type === CellType.CHECKBOX) {
      const { require_fill_checked } = column;
      return <CellLabel column={{ name, custom_name, is_required: require_fill_checked }}></CellLabel>;
    }
    return <CellLabel column={column}></CellLabel>;
  }
}
