import React, { useCallback, useEffect, useState } from 'react';
import { getTableById, getViewById, generatorSearchSQL, getCellValueDisplayString, CellType, getPreviewContent } from 'dtable-utils';
import { Loading } from 'dtable-ui-component';
import { DocumentPluginEditor } from '@seafile/sdoc-editor';
import { dtableWebAPI } from '../api/dtable-web-api';
import { gettext } from '../utils/constants';
import { getCollaboratorManager, getPrintSize } from './utils/utils';
import SDocServerApi from '../api/sdoc-server-api';
import DTableAPIGateway from '../api/dtable-api-gateway';

import './index.css';

const { serviceURL: serviceUrl } = window.app.config;
let {
  dtableMetadata,
  row_id,
  dtable_uuid,
  access_token,
  dtableWebURL,
  collaborators,
  username,
  id_in_org: userId,
  departments,
  userDepartmentIdsMap,
  seadocServerUrl,
  documentSetting
} = window.app.pageOptions;
collaborators = JSON.parse(collaborators);
departments = JSON.parse(departments);
userDepartmentIdsMap = JSON.parse(userDepartmentIdsMap);
window.dtableWebAPI = dtableWebAPI;
window.dtableAPIGateway = new DTableAPIGateway({ dtableWebURL, accessToken: access_token });


function DTableDocument(props) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState(null);
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [, setActiveView] = useState(null);
  const [activeRow, setActiveRow] = useState(null);
  const [document, setDocument] = useState(null);

  const initPrintStyle = (activePage) => {
    const { width, height, top, right, bottom, left } = getPrintSize(activePage);
    let styleElement = window.document.createElement('STYLE');
    styleElement.setAttribute('type', 'text/css');
    const pageStyle = window.document.createTextNode(`
    @media print {
      @page {
        size: ${width}px ${height}px;
        margin: ${top}px ${right}px ${bottom}px ${left}px;
        padding: 0;
      }
      body {
        margin: 0;
        padding: 0;
        min-width: ${width - left - right }px !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .d-print-none {
        display:none !important;
      }
      .article {
        width: ${width - left - right}px !important;
        border: none !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .seatable-view-container {
        overflow: hidden !important;
      }
      table {
        border-left: none !important;
        border-top: none !important;
        width: fit-content !important;
      }
      table thead tr {
        border-top: 1px solid #ccc;
      }
      tr {
        border-left: 1px solid #ccc;
        page-break-inside: avoid;
      }
      tr:first-of-type {
        page-break-after: auto;
      }
    }
    body,
    #wrapper {
      height: fit-content !important;
    }
    .sdoc-editor-container,
    .sdoc-content-wrapper,
    .sdoc-scroll-container,
    .sdoc-editor-content,
    .sdoc-article-container {
      position: relative !important;
      flex: 1 !important;
      display: flex !important;
      height: fit-content !important;
      width: 100% !important;
      padding: 0 !important;
      margin: 0 auto !important;
      background: #fff !important;
    }
    .article {
      height: fit-content !important;
    }
    `);
    styleElement.appendChild(pageStyle);
    window.document.head.appendChild(styleElement);
  };

  useEffect(() => {
    const value = JSON.parse(dtableMetadata);
    const { tables } = value;
    const activePage = JSON.parse(documentSetting);
    if (!activePage) {
      setError(gettext('The document has been deleted'));
      return;
    }

    const { table_id, view_id } = activePage;
    const activeTable = getTableById(tables, table_id);
    if (!activeTable) {
      setError(gettext('The document\'s table has been deleted'));
      return;
    }

    const { views } = activeTable;
    const view = getViewById(views, view_id);
    if (!view) {
      setError(gettext('The document\'s view has been deleted'));
      return;
    }

    setActivePage(activePage);
    setTables(tables);
    setActiveTable(activeTable);
    setActiveView(view);

    // 获取表格行数据
    const sql = generatorSearchSQL(activeTable, view, 0, 10000);
    window.dtableAPIGateway.sqlQuery(dtable_uuid, sql, [], false).then(res => {
      const viewRows = res.data.results || [];
      const row = viewRows.find(item => item._id === row_id);
      setActiveRow(row);

      const collaboratorManager = getCollaboratorManager();
      dtableWebAPI.getSdocAccessToken(activePage.doc_uuid).then(res => {
        const { access_token } = res.data;
        // init sdoc settings
        window.seafile = {
          serviceUrl: serviceUrl,
          docName: activePage.doc_name,
          docUuid: activePage.doc_uuid,
          accessToken: access_token,
          isOpenSocket: false,
          sdocServer: seadocServerUrl,
          username: username,
          assetsUrl: `/api/v2.1/seadoc/download-image/${activePage.doc_uuid}`,
          userId: userId,
          userDepartmentIdsMap: userDepartmentIdsMap,
          departments: departments,
          collaboratorManager: collaboratorManager
        };
        const sdocServerApi = new SDocServerApi(window.seafile);
        sdocServerApi.getDocContent().then(res => {
          const document = res.data;
          setDocument(document);
          document.elements = [
            ...document.elements,
            {
              id: 'document-render-complete',
              type: 'paragraph',
              children: [
                {
                  id: 'document-render-complete-text',
                  text: '',
                }
              ]
            }
          ];
          setIsLoading(false);
        });
      });
    });
    initPrintStyle(activePage);
  }, []);

  const getTableByCustom = async (tableId) => {
    const table = tables.find(table => table._id === tableId);
    // const { filter_conjunction = 'And', filters = [], sorts = [] } = activePage;
    const sql = generatorSearchSQL(table, activePage, 0, 10000);
    const res = await window.dtableAPIGateway.sqlQuery(dtable_uuid, sql, [], false);
    const viewRows = res.data.results || [];
    return {
      ...table,
      rows: viewRows,
    };
  };

  const getColumnCellValue = (columnKey) => {
    const column = activeTable.columns.find(item => item.key === columnKey);
    if (!column) return '';

    if (!activeRow) return '';

    const { type, data } = column;
    const otherOptions = {
      data: data,
      formulaRows: { [activeRow._id]: activeRow },
      collaborators: collaborators,
      departments: departments,
      isBaiduMap: true,
      geolocationHyphen: '',
    };
    if (type === CellType.LONG_TEXT) {
      const value = getPreviewContent(activeRow[columnKey]);
      return value.preview;
    }
    if (type === CellType.LINK) {
      const value = activeRow[columnKey] || [];
      return value.map(item => item.display_value).join(',');
    }
    const value = getCellValueDisplayString(activeRow, type, columnKey, otherOptions);
    return value;
  };

  const getTableFormulaResults = (table, tableRows) => {
    return tableRows.reduce((result, row) => {
      result[row._id] = row;
      return result;
    }, {});
  };

  const sqlQuery = (sql, parameters, convert_keys) => {
    return window.dtableAPIGateway.sqlQuery(dtable_uuid, sql, parameters, convert_keys = false);
  };

  const getArticleStyle = useCallback(() => {
    const { width, top, right, bottom, left } = getPrintSize(activePage);
    return {
      width: width,
      paddingTop: top,
      paddingRight: right,
      paddingBottom: bottom,
      paddingLeft: left,
    };
  }, [activePage]);

  if (error) {
    return (
      <div>{error}</div>
    );
  }

  if (isLoading) return <Loading />;

  return (
    <DocumentPluginEditor
      isReadOnly={true}
      docUuid={window.seafile?.docUuid}
      document={document}
      showOutline={false}
      tableId={activeTable._id}
      columns={activeTable.columns}
      getColumnCellValue={getColumnCellValue}
      getTableById={getTableByCustom}
      collaborators={collaborators}
      getTableFormulaResults={getTableFormulaResults}
      tables={tables}
      sqlQuery={sqlQuery}
      getArticleStyle={getArticleStyle}
    />
  );
}

export default DTableDocument;
