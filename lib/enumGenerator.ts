"use strict";

import fs from 'fs'
import path from 'path'
let _ = require('lodash');
import { keys } from 'lodash'
import * as  utils from './utils'
import { Swagger, GeneratorOptions, SwaggerDefinitions, SwaggerDefinition, SwaggerDefinitionProperties, EnumValue, NameLabelEnum } from './typingsSwagger';

interface EnumType {
    type: string;
    valuesAndLabels: EnumTypeValueAndLabel[];
    joinedValues: string;
}

interface EnumTypeValueAndLabel {
    value: string;
    label: string;
}

interface generateEnumsData {
    moduleName?: string,
    generateClasses?:boolean ,
    enumTypeCollection:EnumType[]
}

interface DebreefingReport {
    hasDuplicates : boolean
    enumNumber: number
    unbalancedEnums : string[]
}

const debreefingReport: DebreefingReport =  {
    hasDuplicates : false,
    enumNumber: 0,
    unbalancedEnums : []
}

export function generateEnumTSFile(swagger:Swagger, options:GeneratorOptions) {
    let outputFileName = path.normalize(options.enumTSFile);
    let enumTypeCollection = getEnumDefinitions(swagger, options);
    const { enumModuleName , generateClasses } = options
    const data: generateEnumsData = {moduleName: enumModuleName,generateClasses,enumTypeCollection}
    //generateEnums(data, 'generate-enum-ts.hbs',outputFileName)
    const debreef = generateEnums(data, 'generate-enumvalues-ts.hbs',outputFileName)
    console.log('debreef', debreef)
}

export function generateEnumI18NHtmlFile(swagger:Swagger, options:GeneratorOptions) {
    let outputFileName = path.normalize(options.enumI18NHtmlFile || 'default file');
    const data: generateEnumsData = {
        enumTypeCollection: getEnumDefinitions(swagger, options)
    }
    generateEnums(data,'generate-enum-i18n-html.hbs',outputFileName)
}

const generateEnums = (data:generateEnumsData, template:string, outputFileName:string):DebreefingReport => {
    const templateCompiled = utils.readAndCompileTemplateFile(template);
    let result = templateCompiled(data);
    let isChanged = utils.writeFileIfContentsIsChanged(outputFileName, result);
    if (isChanged) {
        utils.log(`generated ${data.enumTypeCollection.length}  enums in ${outputFileName}`);
    }
    return debreefingReport
}

export function generateEnumLanguageFiles(swagger:Swagger, options:GeneratorOptions) {
    options.enumLanguageFiles && options.enumLanguageFiles.forEach( (outputFileName:any) => {
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
        let properties = keys(enumLanguage);
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

function getEnumDefinitions(swagger:Swagger, options:any): EnumType[] {
    let enumTypeCollection: EnumType[] = new Array();
    filterEnumDefinitions(enumTypeCollection, swagger.definitions, options);
    // filter on unique types
    const uniquedEnumTypeCollection: EnumType[] = _.uniq(enumTypeCollection, 'type');
    uniquedEnumTypeCollection.length !== enumTypeCollection.length ? console.log("duplicates") : null
    // patch enumTypes which have the same values (to prevent non-unique consts in Go)
    enumTypeCollection = removeEnumTypesWithSameValues(enumTypeCollection);
    // sort on type
    if (options.sortEnumTypes) {
        enumTypeCollection = _.sortBy(enumTypeCollection, 'type');
    }
    return enumTypeCollection;
}

// function recursive
function filterEnumDefinitions(enumTypeCollection:any, node:SwaggerDefinitions, options:GeneratorOptions, enumArrayType?:any) {
    _.forEach(node, function (item:SwaggerDefinition, key:any) {
        if (_.isObject(item) && (!utils.isInTypesToFilter(item, key, options))) {
            if (item.enum) {
                //enumTypeCollection.push(processEnumDefinition(item.enum, key,item.description, enumArrayType))
            } else {
                // enum array's has enum definition one level below (under "items")
                let enumArrayType = undefined;
                if (item.type === 'object' && item.properties && hasSpecificEnum(item.properties, key) ) {
                    const { name, label} = item.properties
                    const zipNameValue = (a:string, b:string) => ({ name:a , label:b})
                    const zipEnumValues = _.zipWith(name.enum, label.enum , zipNameValue )
                    const specificEnumItem: SwaggerDefinition = { properties: {}, enum: zipEnumValues }
                    filterEnumDefinitions(enumTypeCollection, specificEnumItem as {}, options, enumArrayType);
                    enumTypeCollection.push(processEnumDefinition(zipEnumValues, key,item.description, enumArrayType))
                } else if (item.type === 'array') {
                    enumArrayType = key;
                    if (utils.hasTypeFromDescription(item.description)) {
                        enumArrayType = _.lowerFirst(utils.getTypeFromDescription(item.description))
                    }
                }
                filterEnumDefinitions(enumTypeCollection, item as {}, options, enumArrayType);
            }
        }
    });
}

const hasSpecificEnum = ({ name , label }: SwaggerDefinitionProperties, enumName: string):boolean => {
    if (name && label && name.enum !== undefined && label.enum !== undefined) {
        //check if well balanced
        if (name.enum.length !== label.enum.length) {
            console.error(enumName + 'is unbalanced')
            debreefingReport.unbalancedEnums.push(enumName)
            return false
        }  else return true
    } else return false
}



const processEnumDefinition = (enumValues: EnumValue, key: any,description?: string, enumArrayType?: any): EnumType => {
    const typeFromDescription = utils.getTypeFromDescription(description)
    // description may contain an overrule type, eg /** type coverType */
    let type = enumArrayType ? enumArrayType : typeFromDescription ? _.lowerFirst(typeFromDescription) : key
    const valuesAndLabels = getEnumValuesAndLabels(enumValues)
    const joinedValues = enumValues.join(';') // with joined values to detect enums with the same values
    return { type, valuesAndLabels, joinedValues }
}

function removeEnumTypesWithSameValues(enumTypeCollection:any) {
    const result = _.uniqBy(enumTypeCollection, (element:any) => {
        return element.type + element.joinedValues
    });
    return result;
}

const getEnumValuesAndLabels = (enumValues:EnumValue) => enumValues.map((value, key) => {
    return {
            value: _.isObject(value) ? ( value as NameLabelEnum).name : value as string ,
            // only convert label when the value contains not only uppercase chars (only uppercase are considered codes like Country)
            label: _.isObject(value) ? ( value as NameLabelEnum).label : _.upperCase(value) !== value ? _.startCase(value) : value
    }
})
