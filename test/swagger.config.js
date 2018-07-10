'use strict';
module.exports = config();
function config() {
    var root = './test/';
    var folders = {
        root: root,
        srcWebapiFolder: root + 'models/webapi/',
        swaggerFolder: root,
    }
    var swagger = {
        swaggerFile: folders.swaggerFolder + 'swagger.json',
        swaggerFolder: folders.swaggerFolder,
        swaggerTSGeneratorOptions: {
            modelFolder: folders.srcWebapiFolder,
            enumTSFile: folders.srcWebapiFolder + 'enums.ts',
            generateClasses: false,
            modelModuleName: 'webapi.models',
            enumModuleName: 'webapi.enums',
            enumRef: './enums',
        }
    }
    var config = {
        root: root,
        swagger: swagger,
        folders:folders
    }
    return config;
}
