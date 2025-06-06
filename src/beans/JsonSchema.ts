export interface JsonSchema {
    $schema?: string;
    $ref?: string;
    type?: string;
    properties?: {
        [key: string]: any;
    };
    required?: string[];
    items?: any;
    oneOf?: any[];
    enum?: string[];
}