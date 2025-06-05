import React, { Component, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { getTableById, getViewById, generatorSearchSQL } from 'dtable-utils';
import Loading from './components/loading';
import i18n from './i18n-dtable';
import WidgetFormatters from './page-design/components/widget-formatters';
import { PLUGIN_NAME } from './page-design/constants';
import { dtableWebAPI } from './api/dtable-web-api';
import { getPageSize } from './page-design/utils/common-utils';
import { getNormalizedPageContent, getLinkWidgets } from './page-design/utils/widget-utils';
import DTableAPIGateway from './api/dtable-api-gateway';

const { dtableMetadata, page_id, collaborators, dtable_uuid, access_token, dtableWebURL } = window.app.pageOptions;
const gettext = window.gettext;
window.dtableWebAPI = dtableWebAPI;
window.dtableAPIGateway = new DTableAPIGateway({ dtableWebURL, accessToken: access_token });
window.app.collaboratorsCache = {};

class DtablePageDesign extends Component {

  constructor(props) {
    super(props);
    this.state = {
      pageContent: null,
      activeTable: null,
      viewRows: [],
      printRows: [],
      linkRows: {},
      collaborators: collaborators ? JSON.parse(collaborators) : [],
      error: null,
      value: {},
      isTaskRunning: true
    };
  }

  componentDidMount() {
    const value = JSON.parse(dtableMetadata);
    let { plugin_settings, tables } = value;
    const pageDesignSettings = plugin_settings[PLUGIN_NAME];
    const page = pageDesignSettings.find(page => page.page_id === page_id);
    if (!page) {
      this.setState({ error: gettext('The page design has been deleted') });
      return;
    }
    const { content_url, table_id, view_id } = page;
    const activeTable = getTableById(tables, table_id);
    if (!activeTable) {
      this.setState({ error: gettext('The page design\'s table has been deleted') });
      return;
    }
    const { views } = activeTable;
    const view = getViewById(views, view_id);
    if (!view) {
      this.setState({ error: gettext('The page design\'s view has been deleted') });
      return;
    }
    fetch(content_url).then(res => {
      return res.json();
    }).then(res => {
      const pageContent = res;
      if (!pageContent) return;
      const normalizedPageContent = getNormalizedPageContent(res);
      const linkWidgets = getLinkWidgets(normalizedPageContent);
      const viewRowsSQL = generatorSearchSQL(activeTable, view, 0, 10000);
      window.dtableAPIGateway.sqlQuery(dtable_uuid, viewRowsSQL, [], false).then(res => {
        const viewRows = res.data.results || [];
        const printRows = viewRows;
        if (linkWidgets.length > 0) {
          const linkWidgetKeys = linkWidgets.map(widget => widget.key);
          const linkColumns = linkWidgetKeys.map(key => activeTable.columns.find(column => column.key === key)).filter(item => item);
          const row_ids = printRows.map(row => row._id);
          window.dtableWebAPI.pageDesignQueryRowsLinkRecords(dtable_uuid, table_id, row_ids, JSON.stringify(linkColumns)).then(res => {
            this.setState({
              pageContent: normalizedPageContent,
              activeTable,
              activeView: view,
              printRows,
              viewRows,
              linkRows: res.data.link_records,
              value,
            });
          }).catch(error => {
            this.setState({ error: gettext('Get row link records failed') });
          });
        } else {
          this.setState({
            pageContent: normalizedPageContent,
            activeTable,
            activeView: view,
            printRows,
            viewRows,
            linkRows: {},
            value,
          });
        }
      }).catch(error => {
        this.setState({ error: gettext('Get row failed') });
      });
    }).catch(err => {
      this.setState({ error: gettext('Get the page design content failed') });
    });
  }

  render() {
    const { pageContent, activeTable, printRows, error, linkRows, collaborators, value, activeView, viewRows } = this.state;
    const { page_settings, print_settings } = pageContent || {};
    if (error) {
      const style = getPageSize(page_settings || print_settings || {});
      return (
        <div className="page-design-error-message page-design-record" style={style}>
          {error}
        </div>
      );
    }
    if (!activeTable || !activeView || printRows.length === 0) {
      const style = getPageSize(page_settings || print_settings || {});
      return (
        <div className="page-design-error-message page-design-record" style={style}>
          {''}
        </div>
      );
    }
    return (
      <WidgetFormatters
        value={value}
        pageContent={pageContent}
        activeTable={activeTable}
        activeView={activeView}
        viewRows={viewRows}
        printRows={printRows}
        linkRows={linkRows}
        collaborators={collaborators}
      />
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={i18n}>
    <Suspense fallback={<Loading/>}>
      <DtablePageDesign />
    </Suspense>
  </I18nextProvider>
);
