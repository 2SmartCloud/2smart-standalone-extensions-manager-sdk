// native modules
const path     = require('path');
const Debugger = require('homie-sdk/lib/utils/debugger');
const semverLt = require('semver/functions/lt');

const { EXTENSIONS, COMMON } = require('../errorCodes');
const STATUS_CODES           = require('../statusCodes');
const { npm }                = require('../../etc/config');
const {
    exec,
    exists,
    X,
    opendir,
    readfile
} = require('../utils');

const ExtensionsManager = require('../../ExtensionsManager');

class NPM extends ExtensionsManager {
    // eslint-disable-next-line constructor-super
    constructor({
        extensionTypes = [],
        installPath = '.',
        defaultSchemePath = '/etc/scheme.json',
        defaultIconPath = '/etc/icon.svg'
    }) {
        super();
        this.extensionTypes         = extensionTypes;
        this.installPath            = installPath;
        this.defaultSchemePath      = defaultSchemePath;
        this.defaultIconPath        = defaultIconPath;
        this.searchURL              = npm.searchURL;
        this.searchByPackageNameURL = npm.searchByPackageNameURL;
        this.packageURL             = npm.packageURL;
        this.cliCommandTimeout      = npm.cliCommandTimeout;
        this.extensions             = {};
        this.language               = 'JS';
        this.debug                  = new Debugger(process.env.DEBUG || '*');
    }

    init() {
        this.debug.initEvents();

        return Promise.all(this.extensionTypes.map(extType => {
            return exec('npm init --yes', {
                cwd     : path.join(this.installPath, extType),
                timeout : this.cliCommandTimeout
            });
        }));
    }

    getLanguage() {
        return this.language;
    }

    async searchExtensions(text, options) {
        const { keywords } = options;

        const keywordSearchQualifier = (keywords && keywords.length) ? `+keywords:${keywords.join('+')}` : '';

        try {
            // search qualifiers must be right after the "text" query param,
            // in another way it will not find modules by keywords correctly
            const response = await fetch(`${this.searchURL}?text=${text}${keywordSearchQualifier}`);
            const searchResults = await response.json();

            return searchResults.objects;
        } catch (err) {
            throw new X({
                code   : COMMON.TIMEOUT,
                fields : {}
            });
        }
    }

    async getExtensionTypeByExtensionName(extensionName) {
        // return extension type from cache if exists
        if (this.extensions[extensionName] && this.extensions[extensionName].type) {
            return this.extensions[extensionName].type;
        }

        const extension = await this.searchExtensionByName(extensionName);

        if (!extension || !extension.keywords || !extension.keywords.length) {
            throw new X({
                code   : EXTENSIONS.WRONG_TYPE,
                fields : {}
            });
        }

        // determine the extension type by first satisfied keyword
        const extensionType = extension.keywords.find(keyword => this.extensionTypes.includes(keyword));
        if (!extensionType) {
            throw new X({
                code   : EXTENSIONS.WRONG_TYPE,
                fields : {}
            });
        }

        return extensionType;
    }

    async isExtensionInstalled(extensionName, type) {
        const extensionPath = await this.getExtensionPath(extensionName, type);
        const isInstalled = await exists(extensionPath);

        return isInstalled;
    }

    async searchExtensionByName(extensionName, version = 'latest') {
        let response;

        try {
            response = await fetch(`${this.searchByPackageNameURL}${this.prepareExtensionName(extensionName)}/${version}`);
        } catch (err) {
            this.debug.warning('NPM.searchExtensionByName', err);

            throw new X({
                code   : COMMON.TIMEOUT,
                fields : {}
            });
        }

        if (response.status !== STATUS_CODES.OK) {
            this.debug.warning('NPM.searchExtensionByName', { responseStatus: response.status, responseStatusText: response.statusText, responseUrl: response.url });

            return null;
        }

        const extension = await response.json();

        return extension;
    }

    async getExtensionInstallPath(extensionName, extensionType) {
        const isInstalled = await this.isExtensionInstalled(extensionName, extensionType);

        if (isInstalled) {
            const extension = this.extensions[extensionName];

            if (extension && extension.installPath) return extension.installPath;

            const extensionInstallPath = path.join(this.installPath, extensionType);

            return extensionInstallPath;
        }

        // if extension is not installed
        throw new X({
            code   : COMMON.NOT_FOUND,
            fields : {}
        });
    }

    async installExtension(extensionName, extensionType) {
        const extensionInstallPath = path.join(this.installPath, extensionType);
        try {
            await exec(`npm i --no-package-lock ${extensionName}`, {
                cwd     : extensionInstallPath,
                timeout : this.cliCommandTimeout
            });

            this.extensions[extensionName] = {
                installPath : extensionInstallPath,
                type        : extensionType,
                config      : await this.getExtensionConfigObj(extensionName, extensionType)
            };
        } catch (err) {
            this.debug.warning('NPM.installExtension', err);
            throw new X({
                code   : EXTENSIONS.INSTALL_ERROR,
                fields : {}
            });
        }
    }

    async updateExtension(extensionName, extensionType) {
        const extensionInstallPath = await this.getExtensionInstallPath(extensionName, extensionType);

        try {
            await exec(`npm i --no-package-lock ${extensionName}@latest`, {
                cwd     : extensionInstallPath,
                timeout : this.cliCommandTimeout
            });

            // update extension config in cache after package update
            this.extensions[extensionName].config = await this.getExtensionConfigObj(extensionName, extensionType);
        } catch (err) {
            this.debug.warning('NPM.updateExtension', err);
            throw new X({
                code   : EXTENSIONS.UPDATE_ERROR,
                fields : {}
            });
        }
    }

    async uninstallExtension(extensionName, extensionType) {
        const extensionInstallPath = await this.getExtensionInstallPath(extensionName, extensionType);

        try {
            await exec(`npm uninstall --no-package-lock ${extensionName}`, {
                cwd     : extensionInstallPath,
                timeout : this.cliCommandTimeout
            });

            delete this.extensions[extensionName];
        } catch (err) {
            this.debug.warning('NPM.uninstallExtension', err);
            throw new X({
                code   : EXTENSIONS.UNINSTALL_ERROR,
                fields : {}
            });
        }
    }

    async hasAvailableUpdate(extensionName, extensionType) {
        try {
            const packageConfigObj = await this.getExtensionConfigObj(extensionName, extensionType);
            const npmPackageInfo = await this.searchExtensionByName(extensionName);

            if (!npmPackageInfo || !npmPackageInfo.version) {
                throw new X({ code: EXTENSIONS.UNSUPPORTED_PACKAGE, fields: {} });
            }

            const latestVersion = npmPackageInfo.version;
            const installedVersion = packageConfigObj.version;

            return semverLt(installedVersion, latestVersion); // .lt - less than
        } catch (err) {
            this.debug.warning('NPM.hasAvailableUpdate', err);
            throw new X({
                code   : EXTENSIONS.CHECK_UPDATES_ERROR,
                fields : {}
            });
        }
    }

    /**
     * Returns URI encoded extension name
     */
    prepareExtensionName(extensionName) {
        return encodeURIComponent(extensionName);
    }

    getExtensionInfoURL(extensionName) {
        return `${this.packageURL}/${this.prepareExtensionName(extensionName)}`;
    }

    async getExtensionConfigObj(extensionName, extensionType = '') {
        const packageDirPath = await this.getExtensionPath(extensionName, extensionType);

        if (await exists(packageDirPath)) {
            const configFilePath = path.join(packageDirPath, 'package.json');
            const configFile = await readfile(configFilePath, 'utf-8');

            return JSON.parse(configFile);
        }

        throw new X({
            code   : COMMON.NOT_FOUND,
            fields : {}
        });
    }

    async getExtensionScheme(extensionName, extensionType) {
        const packageDirPath = await this.getExtensionPath(extensionName, extensionType);
        const packageObj = await this.getExtensionConfigObj(extensionName, extensionType);

        const schemePath = packageObj.schemePath || this.defaultSchemePath;

        const absoluteSchemePath = path.join(
            packageDirPath,
            schemePath
        );

        if (await exists(absoluteSchemePath)) {
            const schemeFile = await readfile(absoluteSchemePath, 'utf-8');

            return JSON.parse(schemeFile);
        }

        return [];
    }

    async getExtensionIconPath(extensionName, extensionType) {
        const packageObj = this.extensions[extensionName] ?
            this.extensions[extensionName].config :
            await this.getExtensionConfigObj(extensionName, extensionType);

        const iconPath = packageObj.iconPath || this.defaultIconPath;

        const absoluteIconPath = path.join(
            await this.getExtensionInstallPath(extensionName, extensionType),
            'node_modules',
            extensionName,
            iconPath
        );

        return absoluteIconPath;
    }

    async getInstalledExtensions() {
        const packageConfigObjs = [];
        const packageNames = [];

        try {
            for (const type of this.extensionTypes) {
                const dirPath = path.join(this.installPath, type, 'node_modules');
                // if node_modules dir is not exists then there are not installed modules
                // eslint-disable-next-line no-sync
                if (!(await exists(dirPath))) continue;

                const dir = await opendir(dirPath);

                for await (const dirent of dir) {
                    if (dirent.isDirectory()) {
                        if (dirent.name.startsWith('@')) {
                            const scopedDirPath = path.join(dirPath, dirent.name);

                            for await (const scopedDirent of await opendir(scopedDirPath)) {
                                const scopedPackageName = `${dirent.name}/${scopedDirent.name}`;
                                packageNames.push(scopedPackageName);
                            }

                            continue;
                        }

                        packageNames.push(dirent.name);
                    }
                }

                for (const packageName of packageNames) {
                    try {
                        const packageConfigObj = await this.getExtensionConfigObj(packageName);
                        // if module is a 2smart extension and not an another dependency
                        if (packageConfigObj.keywords.includes(type)) {
                            this.extensions[packageName] = {
                                installPath : path.join(this.installPath, type),
                                type,
                                config      : packageConfigObj
                            };
                            packageConfigObjs.push(packageConfigObj);
                        }
                    } catch (err) {
                        // ignore WRONG_TYPE errors because packageNames array includes package names that are not
                        // related to 2smart project(dependencies of 2smart packages)
                        if (err.code !== EXTENSIONS.WRONG_TYPE) {
                            this.debug.warning(`ExtensionsService.getInstalledExtensions.${packageName}`, err);
                        }
                    }
                }
            }
        } catch (err) {
            this.debug.warning('ExtensionsService.getInstalledExtensions', err);
        }

        return packageConfigObjs;
    }

    async getExtensionPath(extensionName, type = '') {
        let extensionPath;

        if (this.extensions[extensionName] && this.extensions[extensionName].installPath) { // from cache
            extensionPath = path.join(this.extensions[extensionName].installPath, 'node_modules', extensionName);
        } else if (type) { // specified type
            extensionPath = path.join(this.installPath, type, 'node_modules', extensionName);
        } else {
            const extensionType = await this.getExtensionTypeByExtensionName(extensionName);
            extensionPath = path.join(this.installPath, extensionType, 'node_modules', extensionName);
        }

        return extensionPath;
    }
}

module.exports = NPM;
