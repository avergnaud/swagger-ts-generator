'use strict';
module.exports = config();
function config() {
    var root = './test/';
    var folders = {
        root: root,
        srcWebapiFolder: root + 'models/webapi/',
        swaggerFolder: root,
    }
    var files = { swaggerJson: 'swagger.json' }
    var swagger = {
        swaggerFile: folders.swaggerFolder + files.swaggerJson,
        swaggerFolder: folders.swaggerFolder,
        swaggerTSGeneratorOptions: {
            modelFolder: folders.srcWebapiFolder,
            enumTSFile: folders.srcWebapiFolder + 'enums.ts',
            generateClasses: false,
            modelModuleName: 'webapi.models',
            enumModuleName: 'webapi.enums',
            enumRef: './enums',
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
