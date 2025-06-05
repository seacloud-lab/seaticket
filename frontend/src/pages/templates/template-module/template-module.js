import React from 'react';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import TemplateList from './template-list';
import Template from '../model/template';
import { Utils } from '../../../utils/utils';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';
import { gettext, mediaUrl } from '../../../utils/constants';

const ALL = gettext('All');

class TemplateModule extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      category: ALL,
      isLoading: true,
      isTemplateLoaded: false,
      isExistTemplate: false,
      templateMap: {},
      templateCategories: [ALL],
      searchParams: null
    };
  }

  componentDidMount() {
    this.loadTemplateList();
    this.onHandleUrlSearch();
  }

  onHandleUrlSearch = () => {
    let { search } = location;
    if (!search) return;
    let searchParams = Utils.getUrlSearches(search);
    this.setState({
      searchParams: searchParams
    });
  };

  onCategoryClick = (category) => {
    this.setState({ category: category });
  };

  loadTemplateList = () => {

    this.setState({
      isLoading: true,
    });

    // load data;
    dtableWebAPI.listTemplates().then(res => {
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
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({ isLoading: false });
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


  renderCategoryTemplates = (category) => {
    let { templateMap, searchParams } = this.state;
    return (
      <div className="template-category mb-7" key={category} role="group">
        <h3 className="template-category-name">{category}</h3>
        <TemplateList templateList={templateMap[category]} searchParams={searchParams} />
      </div>
    );
  };

  render() {
    let { isExistTemplate, templateCategories, category, isLoading } = this.state;

    if (isLoading) return <Loading />;
    if (!isExistTemplate) {
      return (
        <div className="template-module">
          <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('There are no templates in the config table, please build and register.')} />
        </div>
      );
    }

    return (
      <div className="template-module px-4">
        <ul className="template-categories d-flex flex-wrap align-items-center list-unstyled p-4 mt-6 mb-7">
          {templateCategories.map(categoryName => {
            return (
              <li
                key={categoryName}
                tabIndex={0}
                className={`template-category-item px-4 py-1 user-select-none ${categoryName === category ? 'active' : ''}`}
                onClick={this.onCategoryClick.bind(this, categoryName)}
              >
                {categoryName}
              </li>
            );
          })}
        </ul>
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
    );
  }
}

export default TemplateModule;
