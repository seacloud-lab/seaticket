import axios from 'axios';

class DTableAPIGateway {

  constructor({ dtableWebURL, accessToken, lang }) {
    this.init({ dtableWebURL, accessToken, lang });
  }

  init({ dtableWebURL, accessToken, lang }) {
    this.lang = lang;
    const baseURL = dtableWebURL[dtableWebURL.length - 1] === '/' ? `${dtableWebURL}api-gateway` : `${dtableWebURL}/api-gateway`;
    this.req = axios.create({
      baseURL,
      headers: { 'Authorization': 'Token ' + accessToken }
    });
    return this;
  }

  getDTable(dtableUuid) {
    const langSearcher = this.lang ? `?lang=${this.lang}` : '';
    const url = `/api/v2/dtables/${dtableUuid}/${langSearcher}`;
    return this.req.get(url);
  }

  sqlQuery(dtableUuid, sql, parameters = [], convert_keys = true) {
    const url = `/api/v2/dtables/${dtableUuid}/sql/`;
    const data = {
      sql,
      parameters,
      convert_keys,
    };
    return this.req.post(url, data);
  }

  insertColumn(dtableUuid, tableName, columnName, columnType, columnData, anchor_column_key) {
    const url = `/api/v2/dtables/${dtableUuid}/columns/`;
    let data = {
      table_name: tableName,
      column_name: columnName,
      column_type: columnType,
    };
    if (columnData) {
      data.column_data = columnData;
    }
    if (anchor_column_key) {
      data.anchor_column = anchor_column_key;
    }

    return this.req.post(url, data);
  }

}

export default DTableAPIGateway;
