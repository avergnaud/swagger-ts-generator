"use strict";

/* global __dirname */
let fs = require('fs');
let path = require('path');
let _ = require('lodash');

let utils = require('./built/utils');
let modelGenerator = require('./built/modelGenerator');
let enumGenerator = require('./built/enumGenerator');

module.exports.generateTSFiles = generateTSFiles;

/**
* Generate TypeScript files based on the given SwaggerFile and some templates
*
* @param {string} swaggerInput The fileName of the swagger.json file including path
* @param {object} options Options which are used during generation
*                 .modelFolder: the name of the folder (path) to generate the models in.
                                each model class is generated in its own file.
*                 .enumTSFile: the name of the enum TS file including path
*                 .enumI18NHtmlFile: the name of the HTML file including path to generate enum values for translation.
*                 .enumLanguageFiles: array with the names of the enum languages file including path
*                 .modelModuleName: the name of the model module (aka namespace)
*                 .enumModuleName: the name of the enum module (aka namespace)
*/
function generateTSFiles(swaggerInput, options) {
    // console.log('swagger-ts-generator');

    if (!_.isString(swaggerInput)) {
        throw 'swaggerFileName must be defined';
    }
    if (!_.isObject(options)) {
        throw 'options must be defined';
    }

    let folder = path.normalize(options.modelFolder);
    // utils.removeFolder(folder);

    let swagger = JSON.parse(fs.readFileSync(swaggerInput, utils.ENCODING).trim());

    if(!options.hasOwnProperty("generateClasses"))
        options.generateClasses = true;

    //modelGenerator.generateModelTSFiles(swagger, options);
    enumGenerator.generateEnumTSFile(swagger, options);
    // options.enumI18NHtmlFile && enumGenerator.generateEnumI18NHtmlFile(swagger, options);
    // options.enumLanguageFiles && enumGenerator.generateEnumLanguageFiles(swagger, options);
}
