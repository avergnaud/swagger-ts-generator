type Consumers = 'application/json' | 'text/json' | 'application/xml' | 'text/xml' | 'application/x-www-form-urlencoded';
type Producers = 'application/json' | 'text/json' | 'application/xml' | 'text/xml';

interface Schema {
    $ref?: string;
    type?: string;
}

export interface SwaggerDefinitions {
    [namespace: string]: SwaggerDefinition;
}

export interface SwaggerDefinitionProperties {
    [propertyName: string]: SwaggerPropertyDefinition;
}

export interface Swagger {
    swagger: string;
    info: {
        version: string;
        title: string;
        description: string;
    };
    host: string;
    basePath: string;
    schemes: string[];
    paths: {
        [endpointPath: string]: {
            get: SwaggerHttpEndpoint;
            post: SwaggerHttpEndpoint;
            put: SwaggerHttpEndpoint;
            delete: SwaggerHttpEndpoint;
        }
    };
    definitions: SwaggerDefinitions;
}

export interface SwaggerHttpEndpoint {
    tags: string[];
    summary?: string;
    operationId: string;
    consumes: Consumers[];
    produces: Producers[];
    parameters: {
        name: string;
        in: 'path' | 'query' | 'body';
        required: boolean;
        description?: string;
        type?: string;
        schema?: Schema;
        maxLength?: number;
        minLength?: number;
    }[];
    respones: {
        [httpStatusCode: string]: {
            description: string;
            schema: Schema;
        }
    }
    deprecated: boolean;
}

export type EnumValue= Array<string|NameLabelEnum>
export interface SwaggerDefinition extends Schema {
    properties: SwaggerDefinitionProperties
    description?: string
    required?: (keyof SwaggerDefinitionProperties)[]
    allOf?: SwaggerDefinition[]
    enum?: EnumValue
}

export interface SwaggerPropertyDefinition extends Schema {
    description?: string;
    maxLength?: number;
    minLength?: number;
    maximum?: number;
    minimum?: number;
    format?: string;
    pattern?: string;
    items?: SwaggerDefinition;
    readonly?: boolean;
    enum?: string[];
}

export interface NameLabelEnum {
  name: string
  label: string
}

//--------------options
export interface GeneratorOptions extends booleanParameters, fileNames {
  modelFolder: string;
  enumTSFile: string;
  exclude?: (string | RegExp)[];
  modelModuleName?: string;
  enumModuleName?: string;
  enumRef?: string;
  subTypePropertyName?: string;
  namespacePrefixesToRemove?: string[];
  typeNameSuffixesToRemove?: string[];
  typesToFilter?: string[];
  templates?: template
}

interface fileNames {
  baseModelFileName?: string;
  subTypeFactoryFileName?: string;
  validatorsFileName?: string;
  enumI18NHtmlFile?: string;
  enumLanguageFiles?: string[];
}


interface booleanParameters {
  generateBarrelFiles?: boolean
  generateClasses?: boolean
  generateValidatorFile?: boolean
  sortModelProperties?: boolean
  sortEnumTypes?: boolean
}


interface template {
    validators?: string
    baseModel?: string
    models?: string
    subTypeFactory?: string
    barrel?: string
    enum?: string
    enumLanguage?: string
}
