import { Utils } from '../../../../utils/utils';

class DTableShareUtils {

  static getOption(props) {
    let permissionsOptions = ['rw', 'r'].map(permission => {
      return { value: permission, title: Utils.sharePerms(permission), description: Utils.sharePermsExplanation(permission) };
    });
    let customSharePermissionsOptions = this.getCustomSharePermissionsOptions(props);
    permissionsOptions.push(...customSharePermissionsOptions);
    return permissionsOptions;
  }

  static getCustomSharePermissionsOptions(props) {
    let { customSharePermissions } = props;
    if (!Array.isArray(customSharePermissions)) return [];
    let customSharePermissionsOptions = customSharePermissions.map((customSharePermission) => {
      const { id, name, description } = customSharePermission;
      return {
        value: `c-${id}`,
        title: name,
        description
      };
    });
    return customSharePermissionsOptions;
  }
}

export default DTableShareUtils;
