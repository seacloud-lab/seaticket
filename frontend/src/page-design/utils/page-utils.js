import { VIEW_TYPE, PAGE_HEADER_FOOTER_TYPES, TABLE_ROW_HEIGHT_TYPE, TABLE_TYPES, PAGE_HEADER_FOOTER_TYPE } from '../constants';
import { generatorElementId } from './common-utils';
import { geTableWidgetRowHeightValue, getElementsByCondition, getElementByType, getUpdatedWidget } from './widget-utils';

const getFirstPageTableWidgetMaxHeight = (tableWidget, { pageInfo }) => {
  const { pageHeight, pageFooterHeight } = pageInfo;
  const { layout_data: layoutData, config_data: configData } = tableWidget;
  const { margin_bottom: marginBottom } = configData.expand_display_area.style || { margin_top: 0, margin_bottom: 0 };
  return pageHeight - layoutData.y - pageFooterHeight - marginBottom;
};

const getElementsBelowTableWidget = (pageElements, tableWidget, { pageInfo }) => {
  const { validPageHeight, pageHeaderHeight } = pageInfo;
  const { layout_data: layoutData } = tableWidget;
  const maxPageY = validPageHeight + pageHeaderHeight;
  return getElementsByCondition(pageElements, element => {
    const { layout_data, type } = element;
    if (type === PAGE_HEADER_FOOTER_TYPE.PAGE_FOOTER || type === PAGE_HEADER_FOOTER_TYPE.PAGE_HEADER) return false;
    if (layout_data.y >= maxPageY) return false;
    if (layout_data.y <= layoutData.y || layout_data.y + layout_data.height <= layoutData.y || layout_data.y + layout_data.height <= layoutData.y + layoutData.height) return false;
    if (layout_data.y >= layoutData.y + layoutData.height) return true;
    return false;
  });
};

const getPageInfo = (pageElements, { pageSize }) => {
  const { height: pageHeight, width: pageWidth } = pageSize;
  const pageHeaderElement = getElementByType(pageElements, PAGE_HEADER_FOOTER_TYPE.PAGE_HEADER);
  const pageFooterElement = getElementByType(pageElements, PAGE_HEADER_FOOTER_TYPE.PAGE_FOOTER);
  const pageHeaderHeight = pageHeaderElement ? pageHeaderElement.layout_data.height : 0;
  const pageFooterHeight = pageFooterElement ? pageFooterElement.layout_data.height : 0;
  const validPageHeight = pageHeight - pageHeaderHeight - pageFooterHeight;
  return {
    pageHeaderElement,
    pageFooterElement,
    pageHeaderHeight,
    pageFooterHeight,
    validPageHeight,
    pageHeight,
    pageWidth
  };
};

const getExtraPageTableWidgetInfo = (tableWidget, { recordsCount, tableStyle, pageInfo }) => {
  const firstPageTableWidgetMaxHeight = getFirstPageTableWidgetMaxHeight(tableWidget, { pageInfo });
  const { validPageHeight, pageHeaderHeight } = pageInfo;
  const { renderTableHeight, titleHeightValue, recordHeightValue } = tableStyle;
  const { layout_data: layoutData, config_data: configData } = tableWidget;
  const firstPageRecordsCount = parseInt((firstPageTableWidgetMaxHeight - titleHeightValue) / recordHeightValue);
  const restRecordsCount = recordsCount - firstPageRecordsCount;

  if (restRecordsCount <= 0) {
    const lastPageTableWidgetHeight = renderTableHeight + layoutData.y - pageHeaderHeight;
    return { extraPagesCount: 0, lastPageTableWidgetHeight, perPageRecordsCount: recordsCount, firstPageRecordsCount: recordsCount, lastPageRecordsCount: recordsCount };
  }

  const { margin_top: marginTop, margin_bottom: marginBottom } = configData.expand_display_area.style || { margin_top: 0, margin_bottom: 0 };
  const perPageRecordsHeight = validPageHeight - marginTop - marginBottom - titleHeightValue;
  const perPageRecordsCount = parseInt(perPageRecordsHeight / recordHeightValue);
  const restRecordsPagesCount = Math.ceil(restRecordsCount / perPageRecordsCount);
  const lastPageRecordsCount = restRecordsCount - (restRecordsPagesCount - 1) * perPageRecordsCount;
  const lastPageTableWidgetHeight = lastPageRecordsCount * recordHeightValue + titleHeightValue + marginTop;
  return { extraPagesCount: restRecordsPagesCount, lastPageTableWidgetHeight, perPageRecordsCount, firstPageRecordsCount, lastPageRecordsCount };
};

const updateWidget = (element_map, widget, updateLayoutData, updateConfigData) => {
  const { config_data: configData, layout_data: layoutData, id: widgetId } = widget;
  element_map[widgetId] = {
    ...widget,
    layout_data: {
      ...layoutData,
      ...updateLayoutData,
    },
    config_data: {
      ...configData,
      ...updateConfigData
    }
  };
};

const updateTableWidgetToExtraPage = (extraPagesInfo, tableWidget, { extraPageTableWidgetInfo, pageInfo, tableStyle, recordsCount }) => {
  const { pageHeaderHeight } = pageInfo;
  const { recordHeightValue, titleHeightValue } = tableStyle;
  const { extraPagesCount, firstPageRecordsCount, perPageRecordsCount, lastPageRecordsCount } = extraPageTableWidgetInfo;
  const { config_data: configData } = tableWidget;
  const { margin_top: marginTop } = configData.expand_display_area.style || { margin_top: 0, margin_bottom: 0 };
  for (let i = 1; i <= extraPagesCount; i++) {
    const showRowStart = firstPageRecordsCount + (i - 1) * perPageRecordsCount;
    const isLastPage = i === extraPagesCount;
    const pageRecordsCount = isLastPage ? lastPageRecordsCount : perPageRecordsCount;
    const newTableWidget = getUpdatedWidget(tableWidget, {
      height: pageRecordsCount * recordHeightValue + titleHeightValue,
      y: pageHeaderHeight + marginTop,
    }, {
      showRowStart: showRowStart,
      showRowEnd: isLastPage ? recordsCount : firstPageRecordsCount + i * perPageRecordsCount
    });
    extraPagesInfo[String(i)] = [newTableWidget];
  }
};

const updateBelowTableWidgetsToExtraPage = (element_map, extraPagesInfo, { elementsBelowTableWidget, extraPageTableWidgetInfo, pageInfo, tableStyle }) => {
  const { validPageHeight, pageHeaderHeight } = pageInfo;
  const { extraPagesCount, lastPageTableWidgetHeight } = extraPageTableWidgetInfo;
  const { oldTableHeight, tableTop } = tableStyle;
  const tableWidgetOldHeight = oldTableHeight + tableTop - pageHeaderHeight;
  const displacement = lastPageTableWidgetHeight - tableWidgetOldHeight;
  let insertLastPageWidgets = [];
  let insertNewPageWidgets = [];
  elementsBelowTableWidget.forEach(belowTableElement => {
    const { layout_data } = belowTableElement;
    const { y: belowTableElementY, height: belowTableElementHeight } = layout_data;
    const newBelowTableElementY = belowTableElementY - pageHeaderHeight;
    if (newBelowTableElementY + displacement >= validPageHeight) { // Show all on next page
      delete element_map[belowTableElement.id];
      const newBelowTableElement = getUpdatedWidget(belowTableElement, {
        y: belowTableElement.layout_data.y + displacement - validPageHeight,
      }, {});
      insertNewPageWidgets.push(newBelowTableElement);
    } else if (newBelowTableElementY + belowTableElementHeight + displacement <= validPageHeight) { // Show all on current page
      const updateBelowTableElementLayoutData = { y: belowTableElement.layout_data.y + displacement };
      const updateBelowTableElement = getUpdatedWidget(belowTableElement, updateBelowTableElementLayoutData, {});
      if (extraPagesCount === 0) {
        element_map[belowTableElement.id] = updateBelowTableElement;
      } else {
        delete element_map[belowTableElement.id];
        insertLastPageWidgets.push(updateBelowTableElement);
      }
    } else { // Part of the current page and part of the next page
      const updateBelowTableElement = getUpdatedWidget(belowTableElement, {
        y: belowTableElement.layout_data.y + displacement
      }, {});
      if (extraPagesCount === 0) {
        element_map[belowTableElement.id] = updateBelowTableElement;
      } else {
        delete element_map[belowTableElement.id];
        insertLastPageWidgets.push(updateBelowTableElement);
      }
      const newBelowTableElement = getUpdatedWidget(belowTableElement, {
        y: belowTableElement.layout_data.y + displacement - validPageHeight,
      }, {});
      insertNewPageWidgets.push(newBelowTableElement);
    }
  });
  if (insertLastPageWidgets.length > 0) {
    const existLastPageWidgets = extraPagesInfo[String(extraPagesCount)];
    extraPagesInfo[String(extraPagesCount)] = [...existLastPageWidgets, ...insertLastPageWidgets];
  }
  if (insertNewPageWidgets.length > 0) {
    extraPagesInfo.count = extraPagesCount + 2;
    extraPagesInfo[String(extraPagesCount + 1)] = insertNewPageWidgets;
  }
};

const updatePageExtraPages = (element_map, pageExtraPages, tableWidget, { pageSize, pageElements, recordsCount, tableStyle }) => {
  const { recordHeightValue, titleHeightValue } = tableStyle;
  const pageInfo = getPageInfo(pageElements, { pageSize });
  const extraPageTableWidgetInfo = getExtraPageTableWidgetInfo(tableWidget, { recordsCount, tableStyle, pageInfo });
  const elementsBelowTableWidget = getElementsBelowTableWidget(pageElements, tableWidget, { pageInfo });
  const { extraPagesCount, firstPageRecordsCount } = extraPageTableWidgetInfo;

  // common: update old table widget
  const updateLayoutData = { height: firstPageRecordsCount * recordHeightValue + titleHeightValue };
  const updateConfigData = { showRowStart: 0, showRowEnd: firstPageRecordsCount };
  updateWidget(element_map, tableWidget, updateLayoutData, updateConfigData);

  let extraPagesInfo = { count: extraPagesCount + 1 };

  // add and update extra page and insert extra page's widgets
  updateTableWidgetToExtraPage(extraPagesInfo, tableWidget, { extraPageTableWidgetInfo, pageInfo, tableStyle, recordsCount });
  updateBelowTableWidgetsToExtraPage(element_map, extraPagesInfo, { elementsBelowTableWidget, extraPageTableWidgetInfo, pageInfo, tableStyle });

  if (extraPagesInfo['1']) {
    pageExtraPages.push(extraPagesInfo);
  }
};

const updateExpandDisplayArea = (element_map, pageExtraPages, tableWidget, { pageSize, pageElements, recordsCount }) => {
  const { config_data: configData, layout_data: layoutData } = tableWidget;
  const { height, y } = layoutData;
  const titleStyleConfig = configData['titleStyle'] || {};
  const rowStyleConfig = configData['rowStyle'] || {};
  const { is_show = true } = titleStyleConfig;
  const titleHeightValue = is_show ? geTableWidgetRowHeightValue(titleStyleConfig) + 1 : 1; // 1: border height
  const recordHeightValue = geTableWidgetRowHeightValue(rowStyleConfig) + 1; // 1: border height

  const renderTableHeight = recordsCount * recordHeightValue + titleHeightValue;
  if (renderTableHeight <= height) return;
  const tableStyle = { renderTableHeight, titleHeightValue, recordHeightValue, oldTableHeight: height, tableTop: y };

  updatePageExtraPages(element_map, pageExtraPages, tableWidget, { pageSize, pageElements, recordsCount, tableStyle });
};

const updateShowInNextPages = (element_map, pageExtraPages, tableWidget, { recordsCount }) => {
  const { config_data: configData, layout_data: layoutData } = tableWidget;
  const { height } = layoutData;
  const titleStyleConfig = configData['titleStyle'] || {};
  const rowStyleConfig = configData['rowStyle'] || {};
  const titleHeightValue = geTableWidgetRowHeightValue(titleStyleConfig) + 1; // 1: border height
  const recordHeightValue = geTableWidgetRowHeightValue(rowStyleConfig) + 1; // 1: border height
  const perPageRecordsCount = parseInt((height - titleHeightValue) / recordHeightValue);
  const pagesCount = Math.ceil(recordsCount / perPageRecordsCount);
  if (pagesCount) {

    // update old table widget
    const updateConfigData = { showRowStart: 0, showRowEnd: perPageRecordsCount };
    updateWidget(element_map, tableWidget, {}, updateConfigData);

    // generator pages extra pages
    let extraPagesInfo = { count: pagesCount };
    for (let i = 1; i < pagesCount; i++) {
      const newTableWidget = getUpdatedWidget(tableWidget, {}, {
        showRowStart: i * perPageRecordsCount,
        showRowEnd: (i + 1) * perPageRecordsCount
      });
      extraPagesInfo[String(i)] = [newTableWidget];
    }
    pageExtraPages.push(extraPagesInfo);
  }
};

/**
 * update old page table widget's showRowEnd or height property
 * update old page below table widgets: delete it or update y property
 * generator pages extra pages
 * pagesExtraPages: [
 *  [ // pageExtraPages
 *    { // extraPagesInfo
 *       count: number, // extra pages count,
 *       '1': [ //extra first page
 *          widget,
 *          widget
 *        ],
 *    },
 *  ],
 * ]
*/
const updatePagesAndGeneratorPagesExtraPages = (pages, pagesExtraPages, { pageSize, viewRowsCount, formulaRow }) => {
  pages.forEach((page, pageIndex) => {
    let { element_map } = page;
    let pageExtraPages = [];
    const pageElements = Object.values(element_map);
    for (let i = 0; i < pageElements.length; i++) {
      const widget = pageElements[i];
      const { key, type, config_data: configData } = widget;
      if (!TABLE_TYPES.includes(type)) continue;
      const rowStyleConfig = configData['rowStyle'] || {};

      // Extension page is not supported temporarily when row height is auto
      if (rowStyleConfig.rowHeight === TABLE_ROW_HEIGHT_TYPE.AUTO) continue;
      if (!configData.showInNextPage && !configData.expand_display_area.is_expand) continue;
      const recordsCount = type === VIEW_TYPE.ALL_RECORDS_TABLE ? viewRowsCount : Array.isArray(formulaRow[key]) ? formulaRow[key].length : 0;
      if (configData.expand_display_area.is_expand) {
        updateExpandDisplayArea(element_map, pageExtraPages, widget, { pageSize, pageElements, recordsCount });
      } else if (configData.showInNextPage) {
        updateShowInNextPages(element_map, pageExtraPages, widget, { recordsCount });
      }
    }
    pagesExtraPages[pageIndex] = pageExtraPages;
  });
};

const insertExtraPagesToPages = (pages, pagesExtraPages) => {
  let pageIds = pages.map(page => page._id);
  for (let pageIdx = 0; pageIdx < pagesExtraPages.length; pageIdx++) {
    const pageExtraPages = pagesExtraPages[pageIdx];
    const newPageExtraPagesCount = pageExtraPages.length;
    if (newPageExtraPagesCount === 0) continue;
    const page = pages[pageIdx];
    const { element_map } = page;
    const pageHeaderFooter = Object.values(element_map).filter(widget => PAGE_HEADER_FOOTER_TYPES.includes(widget.type));
    let pageHeaderFooterMap = {};
    let pageHeaderFooterIds = [];
    pageHeaderFooter.forEach(item => {
      pageHeaderFooterMap[item.id] = item;
      pageHeaderFooterIds.push(item.id);
    });
    let nextPages = [];
    for (let pageViewTableWidgetIdx = 0; pageViewTableWidgetIdx < newPageExtraPagesCount; pageViewTableWidgetIdx++) {
      const extraPagesInfo = pageExtraPages[pageViewTableWidgetIdx];
      const pagesCount = extraPagesInfo.count;
      for (let insertNewPageIndex = 1; insertNewPageIndex < pagesCount; insertNewPageIndex++) {
        const nextPage = nextPages[insertNewPageIndex];
        const nextPageElements = extraPagesInfo[String(insertNewPageIndex)];
        if (nextPage) {
          const { element_ids, element_map } = nextPage;
          let newElementIds = [...element_ids];
          let newElementMap = { ...element_map };
          nextPageElements.forEach(element => {
            newElementIds.push(element.id);
            newElementMap[element.id] = element;
          });
          const newNextPage = {
            ...nextPage,
            element_ids: [...new Set(newElementIds)],
            element_map: newElementMap
          };
          nextPages[insertNewPageIndex - 1] = newNextPage;
        } else {
          const nextPageId = generatorElementId(pageIds);
          pageIds.push(nextPageId);
          let newElementIds = [...pageHeaderFooterIds];
          let newElementMap = { ...pageHeaderFooterMap };
          nextPageElements.forEach(element => {
            newElementIds.push(element.id);
            newElementMap[element.id] = element;
          });
          const newPage = {
            _id: nextPageId,
            element_ids: [...new Set(newElementIds)],
            element_map: newElementMap
          };
          nextPages[insertNewPageIndex - 1] = newPage;
        }
      }
    }
    const newPageIndex = pages.findIndex(item => item._id === page._id);
    pages.splice(newPageIndex + 1, 0, ...nextPages);
  }
};

export const getPrintPages = (pages, { pageSize, viewRowsCount, formulaRow }) => {
  if (!Array.isArray(pages) || pages.length === 0) return pages;
  let pagesExtraPages = [];
  updatePagesAndGeneratorPagesExtraPages(pages, pagesExtraPages, { pageSize, viewRowsCount, formulaRow });
  insertExtraPagesToPages(pages, pagesExtraPages);
  return pages;
};
