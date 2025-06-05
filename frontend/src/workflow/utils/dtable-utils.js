import DTableServerAPI from './dtable-server-api';
import { CellType, COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { INIT_NODES } from '../constants';
import { nodeFactory } from './utils';
import { gettext } from '../../utils/constants';
import DTableAPIGateway from '../../api/dtable-api-gateway';
import { dtableWebAPI } from '../../api/dtable-web-api';

class DTableUtils {

  constructor(config) {
    this.config = config;
    this.dtableServerAPI = new DTableServerAPI(config);
    this.dtableAPIGateway = new DTableAPIGateway(config);
    this.tables = [];
    this.views = [];
    this.columns = [];
    this.rows = [];
    this.relatedUsers = [];
    this.scripts = [];
    this.selectedTable = null;
    this.selectedView = null;
  }

  async init(workflowConfig) {
    const res = await this.dtableAPIGateway.getDTable(this.config.dtableUuid);
    const dtable = res.data;
    this.tables = dtable.tables;
    this.scripts = dtable.scripts;

    const { dtableName, workspaceID } = this.config;
    const usersRes = await dtableWebAPI.getTableRelatedUsers(workspaceID, dtableName);
    this.relatedUsers = usersRes.data.user_list;
  }

  async listColumns(tableName, viewName) {
    const res = await this.dtableServerAPI.listColumns(tableName, viewName);
    return res.data.columns;
  }

  async listRows(tableName, viewName) {
    const res = await this.dtableServerAPI.listRows(tableName, viewName);
    return res.data.rows;
  }

  async insertColumn(columnName, columnType, columnData, tableName) {
    return await this.dtableAPIGateway.insertColumn(this.config.dtableUuid, tableName, columnName, columnType, columnData, null);
  }

  getConfig(workflowConfig) {
    if (typeof workflowConfig === 'string') {
      workflowConfig = JSON.parse(workflowConfig);
    }
    const { table_id, state_column_key, nodes } = workflowConfig;

    let selectedTable = null;
    let selectedView = null;
    let columns = [];

    const tables = this.tables;
    selectedTable = tables.find(table => table._id === table_id);
    // 1. first visit edit app view
    // 2. selected table has been deleted in original base
    if (!table_id || !selectedTable) {
      selectedTable = tables[0];
      const { views, columns } = selectedTable;
      selectedView = views[0];
      const firstSingleSelectColumn = columns.find(column => column.type === CellType.SINGLE_SELECT);
      const firstCollaborator = columns.find(column => column.type === CellType.COLLABORATOR);
      this.views = selectedTable.views;
      this.columns = selectedTable.columns;
      this.selectedTable = selectedTable;
      this.selectedView = selectedView;
      return Object.assign({}, workflowConfig, {
        table_id: selectedTable._id,
        state_column_key: firstSingleSelectColumn ? firstSingleSelectColumn.key : '',
        participants_column_key: firstCollaborator ? firstCollaborator.key : '',
        nodes: INIT_NODES.slice()
      });
    }

    columns = selectedTable.columns;
    selectedView = selectedTable.views[0];

    // find state column
    let stateColumn = columns.filter(col => col.key === state_column_key && col.type === CellType.SINGLE_SELECT);
    if (!stateColumn) {
      workflowConfig.state_column_key = '';
    }

    this.views = selectedTable.views;
    this.columns = columns;
    this.selectedTable = selectedTable;
    this.selectedView = selectedView;

    // nodes
    if (Array.isArray(nodes) && nodes.length > 0) {
      const canceledNode = nodes.find(node => node.type === 'canceled');
      if (!canceledNode) {
        nodes.push(nodeFactory('canceled', gettext('Canceled')));
      }
      // Detect invalid read-write keys and remove them
      const formulaColumnKeys = columns.filter(col => col.type === CellType.FORMULA).map(col => col.key);
      nodes.forEach((node, index) => {
        const { node_form = {} } = node;
        const { readwrite_columns = [] } = node_form;
        const invalidReadWriteColumns = readwrite_columns.filter(col => formulaColumnKeys.includes(col.key));
        if (invalidReadWriteColumns.length === 0) return;
        const readWriteColumns = readwrite_columns.filter(col => !formulaColumnKeys.includes(col.key));
        const nodeForm = { ...node_form, ...{ readwrite_columns: readWriteColumns } };
        nodes[index] = { ...node, ...{ node_form: nodeForm } };
      });
    }
    return { ...workflowConfig };
  }

  async initByConfigTable(workflowConfig) {
    const { table_id } = workflowConfig;
    const tables = this.tables;
    const selectedTable = tables.find(table => table._id === table_id);
    if (!selectedTable) return;
    const selectedView = selectedTable.views[0];
    this.views = selectedTable.views;
    this.columns = selectedTable.columns;
    // this.rows = await this.listRows(selectedTable.name, selectedView.name);

    this.selectedTable = selectedTable;
    this.selectedView = selectedView;
  }

  getTables() {
    return this.tables;
  }

  getViews() {
    return this.views;
  }

  getColumns() {
    return this.columns;
  }

  getRows() {
    return this.rows;
  }

  getCellType() {
    return CellType;
  }

  getRelatedUsers() {
    return this.relatedUsers;
  }

  getColumnIconConfig() {
    return COLUMNS_ICON_CONFIG;
  }

}

export default DTableUtils;
