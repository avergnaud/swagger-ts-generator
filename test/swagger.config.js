'use strict';
module.exports = config();
function config() {
    var root = './test/';
    var srcAppFolder = root ;
    var folders = {
        root: root,
        srcWebapiFolder: srcAppFolder + 'models/webapi/',
        srcLanguagesFolder: srcAppFolder + 'assets/i18n/',
        swaggerFolder: srcAppFolder,
        enumI18NHtmlFolder: srcAppFolder + 'models/enums/'
    }
    var files = { swaggerJson: 'swagger.json' }

    var swagger = {
        //url: '/Users/yserra/Documents/Projets/typescript-generator/src/swagger/swagger.json',
        url: 'http://petstore.swagger.io/v2/swagger.json',
        //url: '/Users/yserra/Documents/Projets/typescript-generator/src/file.json',
        swaggerFile: folders.swaggerFolder + files.swaggerJson,
        swaggerFolder: folders.swaggerFolder,
        swaggerTSGeneratorOptions: {
            modelFolder: folders.srcWebapiFolder,
            enumTSFile: folders.srcWebapiFolder + 'enums.ts',
            enumI18NHtmlFile: folders.enumI18NHtmlFolder + 'enum-i18n.component.html',
            enumLanguageFiles: [ folders.srcLanguagesFolder + 'nl.json', folders.srcLanguagesFolder + 'en.json'],
            generateClasses: false,
            modelModuleName: 'webapi.models',
            enumModuleName: 'webapi.enums',
            enumRef: './enums',
            namespacePrefixesToRemove: [],
            typeNameSuffixesToRemove: [],
            typesToFilter: ['ModelAndView','View']
        }
    }
    var config = {
        root: root,
        files: files,
        swagger: swagger,
        folders:folders
    }
    return config;
}
