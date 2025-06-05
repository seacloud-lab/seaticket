import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { getWidgetContainerStyle } from '../utils/style-utils';
import { getWidgetColumn, getWidgetValue } from '../utils/widget-utils';
import { getPageSize } from '../utils/common-utils';
import { getPrintPages } from '../utils/page-utils';
import WidgetFormatter from './widget-formatter';

import '../css/index.css';

class WidgetFormatters extends Component {

  constructor(props) {
    super(props);
  }

  generatorWidget = (row, widget, isLastWidget, pageIdx, pagesCount) => {
    const { activeTable, value, linkRows, collaborators, activeView, viewRows } = this.props;
    const containerStyle = getWidgetContainerStyle(widget, 1);
    const column = getWidgetColumn(widget, activeTable);
    const cellValue = getWidgetValue(widget, activeTable, activeView, row, { linkRows, collaborators, pageIdx, pagesCount });
    return (
      <div style={containerStyle} className="page-design-row-widget-container" key={widget.id}>
        <WidgetFormatter
          widgetClassName="pdf"
          value={value}
          activeTable={activeTable}
          activeView={activeView}
          viewRows={viewRows}
          column={column}
          cellValue={cellValue}
          widget={widget}
          collaborators={collaborators}
          scalingRatio={1}
          component={{}}
        />
        {isLastWidget && (
          <div id="page-design-render-complete" style={{ display: 'none' }}></div>
        )}
      </div>
    );
  };

  initPagesStyle = (validPageContent, allPagesCount) => {
    const { page_settings, print_settings } = validPageContent;
    const pageSize = getPageSize(page_settings || print_settings || {});
    let styleElement = document.createElement('STYLE');
    styleElement.setAttribute('type', 'text/css');
    const cssText = document.createTextNode(`
      #wrapper {
        width: ${pageSize.width}px !important;
        height: ${pageSize.height * allPagesCount}px !important;
      }

      body {
        margin: 0 !important;
      }

      #wrapper, body, html {
        overflow: initial;
      }

      @media print {
        @page {
          size: ${pageSize.width}px ${pageSize.height}px !important;
          margin: 0 !important;
        }

        body,
        html {
          height: 100%;
          width: 100%;
        }

        body {
          display: block;
          min-width: ${pageSize.width}px !important;
          margin: 0 !important;
        }
      }
    `);

    styleElement.appendChild(cssText);
    document.head.appendChild(styleElement);
  };

  getStyle = (normalizedPageContent) => {
    const { page_settings, print_settings } = normalizedPageContent;
    const pageSize = getPageSize(page_settings || print_settings || {});
    return {
      width: pageSize.width,
      height: pageSize.height,
    };
  };

  renderRows = (normalizedPageContent) => {
    const { printRows, viewRows, linkRows } = this.props;
    const { pages } = normalizedPageContent;
    const viewRowsCount = viewRows.length;
    const pageSize = this.getStyle(normalizedPageContent);
    let allPagesCount = 0;
    const rowsCount = printRows.length;
    const rowLastIndex = rowsCount - 1;
    const renderPDFRows = printRows.map((row, rowIdx) => {
      const rowId = row._id;
      const formulaRow = linkRows[rowId] || {};
      const printPages = getPrintPages(pages, { pageSize, viewRowsCount, formulaRow });
      const pagesCount = printPages.length;
      allPagesCount += pagesCount;
      if (pagesCount > 0) {
        const lastPageIndex = pagesCount - 1;
        return printPages.map((page, pageIdx) => {
          const { element_map, _id } = page;
          const widgets = Object.values(element_map);
          const widgetLastIndex = widgets.length - 1;
          return (
            <div className="page-design-record" style={pageSize} key={`${rowId}-${_id}`}>
              {widgets.map((widget, widgetIdx) => {
                const isLastWidget = rowLastIndex === rowIdx && lastPageIndex === pageIdx && widgetLastIndex === widgetIdx;
                return this.generatorWidget(row, widget, isLastWidget, pageIdx + 1, pagesCount);
              })}
            </div>
          );
        });
      }
      return (<div className="page-design-record" style={pageSize} key={rowId}></div>);
    }).flat();
    return { rows: renderPDFRows, allPagesCount };
  };

  render() {
    const { pageContent } = this.props;
    if (!pageContent) return null;
    const { rows, allPagesCount } = this.renderRows(pageContent);
    if (!rows || !allPagesCount) return null;
    this.initPagesStyle(pageContent, allPagesCount);
    return rows;
  }
}

WidgetFormatters.propTypes = {
  value: PropTypes.object,
  collaborators: PropTypes.array,
  pageContent: PropTypes.object,
  activeTable: PropTypes.object,
  activeView: PropTypes.object,
  viewRows: PropTypes.array,
  printRows: PropTypes.array,
  linkRows: PropTypes.object,
};

export default WidgetFormatters;
