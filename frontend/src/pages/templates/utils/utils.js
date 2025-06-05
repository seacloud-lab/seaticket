// import toaster from '../components/toast';

export const Utils = {

  getErrorMsg: function (error, showPermissionDeniedTip) {
    // let errorMsg = '';
    // if (error.response) {
    //   if (error.response.status === 403) {
    //     if (showPermissionDeniedTip) {
    //       toaster.danger(
    //         <PermissionDeniedTip />,
    //         {id: 'permission_denied', duration: 3600}
    //       );
    //     }
    //     errorMsg = gettext('Permission denied');
    //   } else if (error.response.data &&
    //     error.response.data['error_msg']) {
    //     errorMsg = error.response.data['error_msg'];
    //   } else {
    //     errorMsg = gettext('Error');
    //   }
    // } else {
    //   errorMsg = gettext('Please check the network.');
    // }
    // return errorMsg;
  },

  changeSearch: function (parameter, value) {
    let newSearch = '';
    if (value) {
      newSearch = `?${parameter}=${value}`;
    }
    history.replaceState(null, '', location.pathname + newSearch);
  },

  getUrlSearches: function (searcher) {
    let searchParams = {};
    let allSearches = searcher.split('?')[1];
    let allSearchesArr = allSearches.split('&');
    allSearchesArr.forEach(item => {
      let itemArr = item.split('=');
      searchParams[itemArr[0]] = decodeURI(itemArr[1]);
    });
    return searchParams;
  },

  changeMarkdownValue: function (value, fn) {
    value.forEach((item) => {
      fn(item);
      if (item.children && item.children.length > 0){
        Utils.changeMarkdownValue(item.children, fn);
      }
    });
    return value;
  },
};
