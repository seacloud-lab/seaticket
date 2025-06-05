import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import MobileCommonHeader from './mobile-common-header';
import seaTableMarketAPI from '../../../utils/seatable-market-api';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Template from '../../../models/template';
import ModalPortal from '../../../components/modal-portal';
import MobileTemplateListDetail from './mobile-template-list-detail';
import Loading from '../../../components/loading';
import { gettext, seatableMarketUrl } from '../../../utils/constants';

import '../../../css/mobile/mobile-template-list.css';

const propTypes = {
  isSinglePage: PropTypes.bool,
  isCreatedTemplateLoading: PropTypes.bool,
  onShowTemplateListToggle: PropTypes.func,
  addDtableFromExternalLink: PropTypes.func,
};

class MobileTemplateList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      category: '',
      isLoading: true,
      templateMap: {},
      templateCategories: [],
    };
  }

  componentDidMount() {
    this.loadTemplateList();
  }

  loadTemplateList = () => {
    let apiSource = seatableMarketUrl ? seaTableMarketAPI : dtableWebAPI;
    apiSource.listTemplates().then(res => {
      let templateList = res.data.template_list.map(template => {
        return new Template(template);
      });
      let { templateCategories } = this.state;
      templateList.forEach(template => {
        if (templateCategories.indexOf(template.category) === -1) {
          templateCategories.push(template.category);
        }
      });
      let templateMap = this.calculateTemplateMap(templateList, templateCategories);
      this.setState({
        isLoading: false,
        templateMap: templateMap,
        templateCategories: templateCategories,
      });
    });
  };

  calculateTemplateMap = (templateList, templateCategories) => {
    let templateMap = {};
    templateCategories.forEach(category => {
      templateMap[category] = templateList.filter(template => {
        return template.category === category;
      });
    });
    return templateMap;
  };

  createTemplateToggle = () => {
    this.props.onShowTemplateListToggle();
  };

  onShowTemplateItem = (category) => {
    this.setState({ category });
  };

  onCancelTemplateDetail = () => {
    this.setState({ category: '' });
  };

  render() {
    const { templateMap, templateCategories, category, isLoading } = this.state;
    const { isSinglePage } = this.props;
    return (
      <div className={classnames({ 'mobile-template-list-single-page': isSinglePage, 'mobile-template-list-inner-page': !isSinglePage })}>
        {isSinglePage &&
          <MobileCommonHeader
            title={gettext('Template')}
            leftName={gettext('Cancel')}
            onLeftClick={this.createTemplateToggle}
          />
        }
        {isLoading ?
          <div className="pt-6"><Loading /></div>
          :
          <div className='mobile-template-list'>
            {templateCategories.map((item, index) => {
              return (
                <div className="mobile-template-item" key={`mobile-template${index}`} onClick={this.onShowTemplateItem.bind(this, item)}>
                  <div className="mobile-template-item-wrapper">
                    <div className="mobile-template-item-title">{item}</div>
                    <div className="mobile-template-item-right">
                      <span className="mobile-template-item-arrow dtable-font dtable-icon-right"></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        }
        {category &&
          <ModalPortal>
            <MobileTemplateListDetail
              onCancelTemplateDetail={this.onCancelTemplateDetail}
              category={category}
              templateList={templateMap[category]}
              addDtableFromExternalLink={this.props.addDtableFromExternalLink}
              isCreatedTemplateLoading={this.props.isCreatedTemplateLoading}
            />
          </ModalPortal>
        }
      </div>
    );
  }
}

MobileTemplateList.propTypes = propTypes;

export default MobileTemplateList;
