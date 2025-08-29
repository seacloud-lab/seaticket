import * as React from 'react';
import { getDataAttr } from '../../../utils/dom';
import Tabs from '../tabs';
import Tab from './Tab';

import './index.css';

export class Item extends React.Component {
  render() {
    const { prefixCls = 'am-tab-bar-item', style } = this.props;
    return (
      <div className={prefixCls} style={style}>
        {this.props.children}
      </div>
    );
  }
}
class AntTabBar extends React.Component {

  static defaultProps = {
    prefixCls: 'am-tab-bar',
    barTintColor: 'white',
    tintColor: '#108ee9',
    hidden: false,
    unselectedTintColor: '#888',
    animated: false,
    swipeable: false,
    prerenderingSiblingsNumber: 1,
    tabBarPosition: 'bottom'
  };

  static Item = Item;

  getTabs = () => {
    const tabs = [];
    React.Children.forEach(this.props.children, c => {
      if (c) {
        tabs.push({
          ...c.props
        });
      }
    });
    return tabs;
  };

  renderTabBar = () => {
    const {
      barTintColor,
      prefixCls,
      tintColor,
      unselectedTintColor,
      hidden,
      tabBarPosition
    } = this.props;
    const tabsData = this.getTabs();

    const content = Array.isArray(tabsData)
      ? tabsData.map((cProps, index) => {
        return (
          <Tab
            key={index}
            prefixCls={`${this.props.prefixCls}-tab`}
            badge={cProps.badge}
            dot={cProps.dot}
            selected={cProps.selected}
            icon={cProps.icon}
            selectedIcon={cProps.selectedIcon}
            title={cProps.title}
            tintColor={tintColor}
            unselectedTintColor={unselectedTintColor}
            dataAttrs={getDataAttr(cProps)}
            onClick={() => cProps.onPress && cProps.onPress()}
          />
        );
      })
      : null;
    let cls = `${prefixCls}-bar`;
    if (hidden) {
      cls += ` ${prefixCls}-bar-hidden-${tabBarPosition}`;
    }

    return (
      <div className={cls} style={{ backgroundColor: barTintColor }}>
        {content}
      </div>
    );
  };

  render() {
    const {
      prefixCls,
      children,
      animated,
      swipeable,
      noRenderContent,
      prerenderingSiblingsNumber,
      tabBarPosition
    } = this.props;
    const tabs = this.getTabs();
    let activeIndex = 0;
    if (Array.isArray(tabs)) {
      tabs.forEach((tab, index) => {
        if (tab.selected) {
          activeIndex = index;
        }
      });
    }

    return (
      <div className={prefixCls}>
        <Tabs
          tabs={tabs}
          renderTabBar={this.renderTabBar}
          tabBarPosition={tabBarPosition}
          page={activeIndex < 0 ? undefined : activeIndex}
          animated={animated}
          swipeable={swipeable}
          noRenderContent={noRenderContent}
          prerenderingSiblingsNumber={prerenderingSiblingsNumber}
        >
          {children}
        </Tabs>
      </div>
    );
  }
}

export default AntTabBar;
