"use strict";
import fs from 'fs';
import path from 'path';
let _ = require('lodash');
import * as utils from './utils';
export function generateEnumTSFile(swagger, options) {
    let outputFileName = path.normalize(options.enumTSFile);
    let enumTypeCollection = getEnumDefinitions(swagger, options);
    const { enumModuleName, generateClasses } = options;
    const data = { moduleName: enumModuleName, generateClasses, enumTypeCollection };
    generateEnums(data, 'generate-enum-ts.hbs', outputFileName);
}
export function generateEnumI18NHtmlFile(swagger, options) {
    let outputFileName = path.normalize(options.enumI18NHtmlFile || 'default file');
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
};
export function generateEnumLanguageFiles(swagger, options) {
    _.each(options.enumLanguageFiles, (outputFileName) => {
        outputFileName = path.normalize(outputFileName);
        // read contents of the current language file
        utils.ensureFile(outputFileName, '{}');
        let enumLanguage = JSON.parse(fs.readFileSync(outputFileName, utils.ENCODING));
        // get enum definitions from swagger
        let enumTypeCollection = getEnumDefinitions(swagger, options);
        // add new enum types/values to the enumLanguage (leave existing ones intact)
        let newValuesAdded = buildNewEnumLanguage(enumTypeCollection, enumLanguage);
        generateEnumLanguageFile(enumLanguage, outputFileName, newValuesAdded);
    });
    function buildNewEnumLanguage(enumTypeCollection, enumLanguage) {
        let result = false;
        let currentEnumLanguage = _.clone(enumLanguage);
        let properties = _.keys(enumLanguage);
        properties.map((property) => {
            _.unset(enumLanguage, property);
        });
        enumTypeCollection.forEach(function (enumType) {
            enumLanguage[enumType.type] = '-------ENUM-TYPE-------';
            enumType.valuesAndLabels.forEach(function (valueAndLabel, key) {
                if (!_.has(enumLanguage, valueAndLabel.value)) {
                    if (_.has(currentEnumLanguage, valueAndLabel.value)) {
                        enumLanguage[valueAndLabel.value] = currentEnumLanguage[valueAndLabel.value];
                    }
                    else {
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
    enumTypeCollection = _.uniq(enumTypeCollection, 'type');
    // patch enumTypes which have the same values (to prevent non-unique consts in Go)
    enumTypeCollection = removeEnumTypesWithSameValues(enumTypeCollection);
    // sort on type
    if (options.sortEnumTypes) {
        enumTypeCollection = _.sortBy(enumTypeCollection, 'type');
    }
    // console.log('enumTypeCollection', enumTypeCollection);
    return enumTypeCollection;
}
// function recursive
function filterEnumDefinitions(enumTypeCollection, node, options, enumArrayType) {
    _.forEach(node, function (item, key) {
        if (_.isObject(item) && (!utils.isInTypesToFilter(item, key, options))) {
            if (item.enum) {
                enumTypeCollection.push(processEnumDefinition(item.enum, key, item.description, enumArrayType));
            }
            else {
                // enum array's has enum definition one level below (under "items")
                let enumArrayType = undefined;
                if (item.type === 'object' && item.properties && hasDarvaEnum(item.properties)) {
                    const zipNameValue = (a, b) => ({ name: a, label: b });
                    const darvaEnumItem = {
                        properties: {},
                        enum: _.zipWith(item.properties.name.enum, item.properties.label.enum, zipNameValue)
                    };
                    console.log(darvaEnumItem);
                    filterEnumDefinitions(enumTypeCollection, darvaEnumItem, options, enumArrayType);
                }
                else if (item.type === 'array') {
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
const hasDarvaEnum = (itemProperty) => {
    const { name, label } = itemProperty;
    return name && label && name.enum !== undefined && label.enum !== undefined;
};
const processEnumDefinition = (enumValues, key, description, enumArrayType) => {
    const typeFromDescription = utils.getTypeFromDescription(description);
    // description may contain an overrule type, eg /** type coverType */
    let type = enumArrayType ? enumArrayType : typeFromDescription ? _.lowerFirst(typeFromDescription) : key;
    const valuesAndLabels = getEnumValuesAndLabels(enumValues);
    const joinedValues = enumValues.join(';'); // with joined values to detect enums with the same values
    // console.log(enumType);
    return { type, valuesAndLabels, joinedValues };
};
function removeEnumTypesWithSameValues(enumTypeCollection) {
    const result = _.uniqBy(enumTypeCollection, (element) => {
        return element.type + element.joinedValues;
    });
    // console.log('#enumTypes with and without duplicates', enumTypeCollection.length, result.length);
    // console.log('======================> original <======================', enumTypeCollection);
    // console.log('======================> result <======================', result);
    return result;
    // // get enumTypes with duplicate enumValues
    // let groupped = _.groupBy(enumTypeCollection, (e) => { return e.joinedValues });
    // var duplicates = _.uniqBy(_.flatten(_.filter(groupped, (g) => { return g.length > 1 })), element => { return element.type; });
    // console.log('duplicates', JSON.stringify(duplicates));
    // // prefix enumValue.pascalCaseValue with typeName to make sure the genertaed Go consts are unique
    // _.forEach(duplicates, (item, key) => {
    //     // _.forEach(item.values, (value) => {
    //     //     value.pascalCaseValue = `${item.typeName}${value.pascalCaseValue}`;
    //     // });
    // })
    // // console.log('enumTypeCollection', JSON.stringify(enumTypeCollection));
    // return enumTypeCollection;
}
function getEnumValuesAndLabels(enumValues) {
    let result = new Array();
    enumValues.forEach((value, key) => {
        const valueAndLabel = {
            value: value,
            // only convert label when the value contains not only uppercase chars (only uppercase are considered codes like Country)
            label: _.upperCase(value) !== value ? _.startCase(value) : value
        };
        result.push(valueAndLabel);
    });
    return result;
}
