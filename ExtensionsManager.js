/**
 * Interface for the extensions manager
 */
class ExtensionsManager {
    /**
     * @abstract
     * @param text    {String} - Full-text search to apply
     * @param options {Object} - Additional search options such as keywords, offset and limit
     */
    // eslint-disable-next-line no-unused-vars
    async searchExtensions(text, options) {
        throw new Error('ExtensionsManager.searchExtensions method should be implemented!');
    }

    /**
     * @abstract
     * @param extensionName {String} - A name of extension to get type of
     */
    // eslint-disable-next-line no-unused-vars
    async getExtensionTypeByExtensionName(extensionName) {
        throw new Error('ExtensionsManager.getExtensionTypeByExtensionName method should be implemented!');
    }

    /**
     * @abstract
     * @param extensionName {String} - A name of extension to check installation
     * @param extensionType {String} - A type of extension
     */
    // eslint-disable-next-line no-unused-vars
    async isExtensionInstalled(extensionName, extensionType) {
        throw new Error('ExtensionsManager.isExtensionInstalled method should be implemented!');
    }

    /**
     * @abstract
     * @param extensionName {String} - A name of extension to get info of
     */
    // eslint-disable-next-line no-unused-vars
    async searchExtensionByName(extensionName) {
        throw new Error('ExtensionsManager.searchExtensionByName method should be implemented!');
    }

    /**
     * @abstract
     * @param extensionName {String} - A name of extension to install
     */
    // eslint-disable-next-line no-unused-vars
    async installExtension(extensionName) {
        throw new Error('ExtensionsManager.installExtension method should be implemented!');
    }

    /**
     * @abstract
     * @param extensionName {String} - A name of extension to update
     */
    // eslint-disable-next-line no-unused-vars
    async updateExtension(extensionName) {
        throw new Error('ExtensionsManager.updateExtension method should be implemented!');
    }

    /**
     * @abstract
     * @param extensionName {String} - A name of extension to uninstall
     */
    // eslint-disable-next-line no-unused-vars
    async uninstallExtension(extensionName) {
        throw new Error('ExtensionsManager.uninstallExtension method should be implemented!');
    }

    /**
     * @abstract
     * @param extensionName {String} - A name of extension to get URL with its info page
     */
    // eslint-disable-next-line no-unused-vars
    getExtensionInfoURL(extensionName) {
        throw new Error('ExtensionsManager.getExtensionInfoURL method should be implemented!');
    }
}

module.exports = ExtensionsManager;
