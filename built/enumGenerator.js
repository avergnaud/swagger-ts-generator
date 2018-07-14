"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.generateEnumTSFile = generateEnumTSFile;
exports.generateEnumI18NHtmlFile = generateEnumI18NHtmlFile;
exports.generateEnumLanguageFiles = generateEnumLanguageFiles;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash');

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let _ = require('lodash');

const debreefingReport = {
    hasDuplicates: false,
    enumNumber: 0,
    unbalancedEnums: []
};
function generateEnumTSFile(swagger, options) {
    let outputFileName = _path2.default.normalize(options.enumTSFile);
    let enumTypeCollection = getEnumDefinitions(swagger, options);
    const { enumModuleName, generateClasses } = options;
    const data = { moduleName: enumModuleName, generateClasses, enumTypeCollection };
    //generateEnums(data, 'generate-enum-ts.hbs',outputFileName)
    const debreef = generateEnums(data, 'generate-enumvalues-ts.hbs', outputFileName);
    console.log('debreef', debreef);
}
function generateEnumI18NHtmlFile(swagger, options) {
    let outputFileName = _path2.default.normalize(options.enumI18NHtmlFile || 'default file');
    const data = {
        enumTypeCollection: getEnumDefinitions(swagger, options)
    };
    generateEnums(data, 'generate-enum-i18n-html.hbs', outputFileName);
}
const generateEnums = (data, template, outputFileName) => {
    const templateCompiled = utils.readAndCompileTemplateFile(template);
    let result = templateCompiled(data);
    let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
        utils.log(`generated ${data.enumTypeCollection.length}  enums in ${outputFileName}`);
    }
    return debreefingReport;
};
function generateEnumLanguageFiles(swagger, options) {
    options.enumLanguageFiles && options.enumLanguageFiles.forEach(outputFileName => {
        outputFileName = _path2.default.normalize(outputFileName);
        // read contents of the current language file
        utils.ensureFile(outputFileName, '{}');
        let enumLanguage = JSON.parse(_fs2.default.readFileSync(outputFileName, utils.ENCODING));
        // get enum definitions from swagger
        let enumTypeCollection = getEnumDefinitions(swagger, options);
        // add new enum types/values to the enumLanguage (leave existing ones intact)
        let newValuesAdded = buildNewEnumLanguage(enumTypeCollection, enumLanguage);
        generateEnumLanguageFile(enumLanguage, outputFileName, newValuesAdded);
    });
    function buildNewEnumLanguage(enumTypeCollection, enumLanguage) {
        let result = false;
        let currentEnumLanguage = _.clone(enumLanguage);
        let properties = (0, _lodash.keys)(enumLanguage);
        properties.map(property => {
            _.unset(enumLanguage, property);
        });
        enumTypeCollection.forEach(function (enumType) {
            enumLanguage[enumType.type] = '-------ENUM-TYPE-------';
            enumType.valuesAndLabels.forEach(function (valueAndLabel, key) {
                if (!_.has(enumLanguage, valueAndLabel.value)) {
                    if (_.has(currentEnumLanguage, valueAndLabel.value)) {
                        enumLanguage[valueAndLabel.value] = currentEnumLanguage[valueAndLabel.value];
                    } else {
                        enumLanguage[valueAndLabel.value] = valueAndLabel.label;
                        result = true;
                    }
                }
            });
        });
        return result;
    }
    function generateEnumLanguageFile(enumLanguage, outputFileName, newValuesAdded) {
        let message = newValuesAdded ? 'generated new enum values in' : 'nothing new';
        utils.log(`${message} in ${outputFileName}`);
        utils.writeFileIfContentsIsChanged(outputFileName, JSON.stringify(enumLanguage, null, 2));
        //fs.writeFileSync(outputFileName, JSON.stringify(enumLanguage, null, 2), utils.ENCODING);
    }
}
function getEnumDefinitions(swagger, options) {
    let enumTypeCollection = new Array();
    filterEnumDefinitions(enumTypeCollection, swagger.definitions, options);
    // filter on unique types
    const uniquedEnumTypeCollection = _.uniq(enumTypeCollection, 'type');
    uniquedEnumTypeCollection.length !== enumTypeCollection.length ? console.log("duplicates") : null;
    // patch enumTypes which have the same values (to prevent non-unique consts in Go)
    enumTypeCollection = removeEnumTypesWithSameValues(enumTypeCollection);
    // sort on type
    if (options.sortEnumTypes) {
        enumTypeCollection = _.sortBy(enumTypeCollection, 'type');
    }
    return enumTypeCollection;
}
// function recursive
function filterEnumDefinitions(enumTypeCollection, node, options, enumArrayType) {
    _.forEach(node, function (item, key) {
        if (_.isObject(item) && !utils.isInTypesToFilter(item, key, options)) {
            if (item.enum) {
                //enumTypeCollection.push(processEnumDefinition(item.enum, key,item.description, enumArrayType))
            } else {
                // enum array's has enum definition one level below (under "items")
                let enumArrayType = undefined;
                if (item.type === 'object' && item.properties && hasSpecificEnum(item.properties, key)) {
                    const { name, label } = item.properties;
                    const zipNameValue = (a, b) => ({ name: a, label: b });
                    const zipEnumValues = _.zipWith(name.enum, label.enum, zipNameValue);
                    const specificEnumItem = { properties: {}, enum: zipEnumValues };
                    filterEnumDefinitions(enumTypeCollection, specificEnumItem, options, enumArrayType);
                    enumTypeCollection.push(processEnumDefinition(zipEnumValues, key, item.description, enumArrayType));
                } else if (item.type === 'array') {
                    enumArrayType = key;
                    if (utils.hasTypeFromDescription(item.description)) {
                        enumArrayType = _.lowerFirst(utils.getTypeFromDescription(item.description));
                    }
                }
                filterEnumDefinitions(enumTypeCollection, item, options, enumArrayType);
            }
        }
    });
}
const hasSpecificEnum = ({ name, label }, enumName) => {
    if (name && label && name.enum !== undefined && label.enum !== undefined) {
        //check if well balanced
        if (name.enum.length !== label.enum.length) {
            console.error(enumName + 'is unbalanced');
            debreefingReport.unbalancedEnums.push(enumName);
            return false;
        } else return true;
    } else return false;
};
const processEnumDefinition = (enumValues, key, description, enumArrayType) => {
    const typeFromDescription = utils.getTypeFromDescription(description);
    // description may contain an overrule type, eg /** type coverType */
    let type = enumArrayType ? enumArrayType : typeFromDescription ? _.lowerFirst(typeFromDescription) : key;
    const valuesAndLabels = getEnumValuesAndLabels(enumValues);
    const joinedValues = enumValues.join(';'); // with joined values to detect enums with the same values
    return { type, valuesAndLabels, joinedValues };
};
function removeEnumTypesWithSameValues(enumTypeCollection) {
    const result = _.uniqBy(enumTypeCollection, element => {
        return element.type + element.joinedValues;
    });
    return result;
}
const getEnumValuesAndLabels = enumValues => enumValues.map((value, key) => {
    return {
        value: _.isObject(value) ? value.name : value,
        // only convert label when the value contains not only uppercase chars (only uppercase are considered codes like Country)
        label: _.isObject(value) ? value.label : _.upperCase(value) !== value ? _.startCase(value) : value
    };
});