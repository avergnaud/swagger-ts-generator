"use strict";

import fs from 'fs'
import path from 'path'
let _ = require('lodash');
import * as  utils from './utils'

export function generateEnumTSFile(swagger:any, options:any) {
    let outputFileName = path.normalize(options.enumTSFile);
    // get enum definitions from swagger
    let enumTypeCollection = getEnumDefinitions(swagger, options);
    //generateTSEnums
    const { enumModuleName , generateClasses } = options
    let data = {moduleName: enumModuleName,generateClasses,enumTypeCollection}
    generateEnums(data,'generate-enum-ts.hbs',outputFileName)
}

export function generateEnumI18NHtmlFile(swagger:any, options:any) {
    let outputFileName = path.normalize(options.enumI18NHtmlFile);
    // get enum definitions from swagger
    let enumTypeCollection = getEnumDefinitions(swagger, options);
    let data = {enumTypeCollection}
    generateEnums(data,'generate-enum-i18n-html.hbs',outputFileName)
}

const generateEnums = (data:any, template:any, outputFileName:any) => {
    const templateCompiled = utils.readAndCompileTemplateFile(template);
    let result = templateCompiled(data);
    let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
        utils.log(`generated ${data.enumTypeCollection.length}  enums in ${outputFileName}`);
    }
}


export function generateEnumLanguageFiles(swagger:any, options:any) {
    _.each(options.enumLanguageFiles, (outputFileName:any) => {
        outputFileName = path.normalize(outputFileName);
        // read contents of the current language file
        utils.ensureFile(outputFileName, '{}');
        let enumLanguage = JSON.parse(fs.readFileSync(outputFileName, utils.ENCODING));
        // get enum definitions from swagger
        let enumTypeCollection = getEnumDefinitions(swagger, options);
        // add new enum types/values to the enumLanguage (leave existing ones intact)
        let newValuesAdded = buildNewEnumLanguage(enumTypeCollection, enumLanguage);
        generateEnumLanguageFile(enumLanguage, outputFileName, newValuesAdded)
    });

    function buildNewEnumLanguage(enumTypeCollection:any, enumLanguage:any) {
        let result = false;
        let currentEnumLanguage = _.clone(enumLanguage);
        let properties = _.keys(enumLanguage);
        properties.map((property:any) => {
            _.unset(enumLanguage, property);
        });
        enumTypeCollection.forEach(function (enumType:any) {
            enumLanguage[enumType.type] = '-------ENUM-TYPE-------';
            enumType.valuesAndLabels.forEach(function (valueAndLabel:any, key:any) {
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

    function generateEnumLanguageFile(enumLanguage:any, outputFileName:any, newValuesAdded:any) {
        let message = newValuesAdded ? 'generated new enum values in' : 'nothing new';
        utils.log(`${message} in ${outputFileName}`);
        utils.writeFileIfContentsIsChanged(outputFileName, JSON.stringify(enumLanguage, null, 2));
        //fs.writeFileSync(outputFileName, JSON.stringify(enumLanguage, null, 2), utils.ENCODING);
    }
}

function getEnumDefinitions(swagger:any, options:any) {
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

function filterEnumDefinitions(enumTypeCollection:any, node:any, options:any, enumArrayType?:any) {
    node.forEach(function (item:any, key:any) {
        if (_.isObject(item) && (!utils.isInTypesToFilter(item, key, options))) {
            if (item.enum) {
                let type = enumArrayType ? enumArrayType : key;
                let values = item.enum;
                let enumType = {
                    'type': type,
                    valuesAndLabels: getEnumValuesAndLabels(values),
                    joinedValues:undefined
                };
                // description may contain an overrule type, eg /** type coverType */
                if (utils.hasTypeFromDescription(item.description)) {
                    enumType.type = _.lowerFirst(utils.getTypeFromDescription(item.description));
                }
                // add string with joined values so enums with the same values can be detected
                enumType.joinedValues = values.join(';')
                // console.log(enumType);
                // console.log('--------------------');
                enumTypeCollection.push(enumType)
            } else {
                // enum array's has enum definition one level below (under "items")
                let enumArrayType = undefined;
                if (item.type === 'array') {
                    enumArrayType = key;
                    if (utils.hasTypeFromDescription(item.description)) {
                        enumArrayType = _.lowerFirst(utils.getTypeFromDescription(item.description))
                    }
                }
                filterEnumDefinitions(enumTypeCollection, item, options, enumArrayType);
            }
        }
    });
}

function removeEnumTypesWithSameValues(enumTypeCollection:any) {
    const result = _.uniqBy(enumTypeCollection, (element:any) => {
        return element.type + element.joinedValues
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

function getEnumValuesAndLabels(enumValues:any) {
    let result = new Array();
    enumValues.forEach((value:any, key:any) => {
        const valueAndLabel = {
            value: value,
            // only convert label when the value contains not only uppercase chars (only uppercase are considered codes like Country)
            label: _.upperCase(value) !== value ? _.startCase(value) : value
        }
        result.push(valueAndLabel);
    });

    return result;
}
