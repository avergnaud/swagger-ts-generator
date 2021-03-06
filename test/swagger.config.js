'use strict';
module.exports = config();
function config() {
    var root = './test/';
    var folders = { srcWebapiFolder: root + 'models/webapi/' }
    var swagger = {
        swaggerFile: root + 'swagger.json',
        swaggerTSGeneratorOptions: {
            modelFolder: folders.srcWebapiFolder,
            enumTSFile: folders.srcWebapiFolder + 'enums.ts',
            generateClasses: false,
            modelModuleName: 'webapi.models',
            enumModuleName: 'webapi.enums',
            enumRef: './enums',
        }
    }
    return { root,swagger,folders }
}
