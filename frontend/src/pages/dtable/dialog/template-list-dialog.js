import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';
import Template from '../../../models/template';
import Loading from '../../../components/loading';
import TemplateList from './template-widgets/template-list';
import { seatableMarketUrl } from '../../../utils/constants';
import seaTableMarketAPI from '../../../utils/seatable-market-api';
import { dtableWebAPI } from '../../../api/dtable-web-api';

import '../../../css/template-list-dialog.css';

const gettext = window.gettext;

const ALL = gettext('All');

const propTypes = {
  onShowTemplateListToggle: PropTypes.func,
  addDtableFromExternalLink: PropTypes.func.isRequired,
  isCreatedTemplateLoading: PropTypes.bool,
};

class TemplateListDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      category: ALL,
      isLoading: true,
      isTemplateLoaded: false,
      isExistTemplate: false,
      templateMap: {},
      templateCategories: [ALL],
    };
  }

  componentDidMount() {
    this.loadTemplateList();
  }

  loadTemplateList = () => {

    this.setState({
      isLoading: true,
    });

    // load data;
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
        isTemplateLoaded: true,
        isExistTemplate: templateList.length > 0 ? true : false,
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

  toggle = () => {
    this.props.onShowTemplateListToggle();
  };

  onCategoryClick = (category) => {
    this.setState({ category: category });
  };

  renderCategoryTemplates = (category) => {
    let { templateMap } = this.state;
    return (
      <div className="template-category mb-7" key={category}>
        <h3 className="template-category-name">{category}</h3>
        <TemplateList
          templateList={templateMap[category]}
          addDtableFromExternalLink={this.props.addDtableFromExternalLink}
          isCreatedTemplateLoading={this.props.isCreatedTemplateLoading}
        />
      </div>
    );
  };

  render() {
    let { templateCategories, category, isLoading } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle} className="template-list-dialog" contentClassName="template-list-content">
        <DTableModalHeader toggle={this.toggle}>
          <span className="dtable-font dtable-icon-templates modal-header-template" aria-hidden="true"></span>
          <span title={gettext('Template')} aria-label={gettext('Template')}>{gettext('Template')}</span>
        </DTableModalHeader>
        <ModalBody className="template-list-body">
          {isLoading && <Loading />}
          {!isLoading &&
            <Fragment>
              <div className="template-side-panel">
                <ul className="template-categories list-unstyled">
                  {templateCategories.map(categoryName => {
                    return <li key={categoryName} className={`template-category-item px-4 py-1 user-select-none ${categoryName === category ? 'active' : ''}`} onClick={this.onCategoryClick.bind(this, categoryName)}>{categoryName}</li>;
                  })}
                </ul>
              </div>
              <div className="template-main-panel">
                {category !== ALL && (this.renderCategoryTemplates(category))}
                {category === ALL && (
                  templateCategories.map(category => {
                    if (category === ALL) {
                      return '';
                    }
                    return this.renderCategoryTemplates(category);
                  })
                )}
              </div>
            </Fragment>
          }
        </ModalBody>
      </Modal>
    );
  }
}

TemplateListDialog.propTypes = propTypes;

export default TemplateListDialog;
