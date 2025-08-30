import { gettext } from '@/constants';


// Translate variables of sea-metadata component
class Translate {
  constructor(variables) {
    const DEFAULT_VARIABLES = {
      row: gettext('row'),
      rows: gettext('rows'),
      Row: gettext('Row'),
      Rows: gettext('Rows'),
      Column: gettext('Column'),
      column: gettext('column'),
      columns: gettext('columns'),
    };

    this.translate_map = {
      'Grouped by 1 {column}': gettext('Grouped by 1 {column}'),
      'Grouped by {count} {columns}': gettext('Grouped by {count} {columns}'),
      '1 hidden {column}': gettext('1 hidden {column}'),
      '{count} hidden {columns}': gettext('{count} hidden {columns}'),
      'No {columns} available to be hidden': gettext('No {columns} available to be hidden'),
      'Search {column}': gettext('Search {column}'),
      'No {rows}': gettext('No {rows}'),
      '{Row} deleted': gettext('{Row} deleted'),
      '{Rows} deleted': gettext('{Rows} deleted'),
      'Failed to modify {row}': gettext('Failed to modify {row}'),
      'Failed to modify {rows}': gettext('Failed to modify {rows}'),
      'Failed to delete {row}': gettext('Failed to delete {row}'),
      'Failed to delete {rows}': gettext('Failed to delete {rows}'),
      'Failed to restore {rows}': gettext('Failed to restore {rows}'),
      'Failed to insert {column}': gettext('Failed to insert {column}'),
      'Failed to delete {column}': gettext('Failed to delete {column}'),
      'Failed to rename {column}': gettext('Failed to rename {column}'),
      'Failed to modify {column} data': gettext('Failed to modify {column} data'),
      'Failed to modify {column} order': gettext('Failed to modify {column} order'),
      'Failed to modify hidden {columns}': gettext('Failed to modify hidden {columns}'),
      'This {column} is not editable': gettext('This {column} is not editable'),
      'This {column} does not support sorting': gettext('This {column} does not support sorting'),
      'Hide {columns}': gettext('Hide {columns}'),
      '{Column} name': gettext('{Column} name'),
      'There is another {column} with this name': gettext('There is another {column} with this name'),
      'Another {column} has this {column} type': gettext('Another {column} has this {column} type'),
    };
    this.variables = {
      ...DEFAULT_VARIABLES,
      ...variables,
    };
  }

  /**
   * formatted string with params.
   * @param {string} key
   * @param {object} params
   * @returns formatted string
   *  eg1:
   *    definition DEFAULT_VARIABLES['Rows'] = 'Tickets'
   *    translate('{Rows} deleted')
   *    ==>
   *    'Tickets deleted'
   *
   *  eg2:
   *    definition DEFAULT_VARIABLES['rows'] = 'tags'
   *    translate('No {rows}')
   *    ==>
   *    'No tags'
   */
  translate = (key, params = {}) => {
    let value = this.translate_map[key];
    if (!value) return key;
    const regex = /\{\s*([a-zA-Z_$][\w$]*)\s*\}/g;
    return value.replace(regex, (match, variable) => {
      const validVariable = variable.trim();
      if (this.variables[validVariable]) return this.variables[validVariable];
      if (params[validVariable] || params[validVariable] === 0) return params[validVariable];
      return match;
    });
  };

}

export default Translate;
