import axios from 'axios';

class DTableServerAPI {

  constructor(config) {
    const { dtableServer, dtableUuid, accessToken, lang } = config;
    this.dtableUuid = dtableUuid;
    this.lang = lang;
    this.req = axios.create({
      baseURL: dtableServer,
      headers: { Authorization: 'Token ' + accessToken }
    });
  }

  getDTable() {
    const url = `dtables/${this.dtableUuid}/?lang=${this.lang}`;
    return this.req.get(url);
  }

  getRelatedUsers() {
    const url = `api/v1/dtables/${this.dtableUuid}/related-users/`;
    return this.req.get(url);
  }

  listColumns(tableName, viewName) {
    const url = `api/v1/dtables/${this.dtableUuid}/columns/`;
    const params = {
      table_name: tableName,
      view_name: viewName
    };
    return this.req.get(url, { params });
  }

  listRows(tableName, viewName) {
    const url = `api/v1/dtables/${this.dtableUuid}/rows/`;
    const params = {
      table_name: tableName,
      view_name: viewName
    };
    return this.req.get(url, { params });
  }

  // column
  insertColumn(columnName, columnType, columnData, tableName) {
    const url = `api/v1/dtables/${this.dtableUuid}/columns/`;
    const formData = {
      'table_name': tableName,
      'column_name': columnName,
      'column_type': columnType,
      'column_data': columnData,
    };
    return this.req.post(url, formData);
  }

}

export default DTableServerAPI;
