import path from 'path';
import { JsonSchema } from '../beans/JsonSchema.js';
import { FileUtil } from './FileUtil.js';
import { GeneratorUtil } from './GeneratorUtil.js';

export class WorkbookGeneratorUtil {

    public static generate(schema: JsonSchema, sheetSchemas: JsonSchema[], workbookDir: string, classNames: { workbook: string[] }): void {
        const workbookNameEnum = GeneratorUtil.getFirstEnum(schema, 'name');
        const workbookClassName = GeneratorUtil.sanitizeName(
            GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(workbookNameEnum)),
            'Workbook'
        );

        // Keep track for mixin generation
        classNames.workbook.push(workbookClassName);

        const sheetSubtypes: string[] = [];
        const sheetImports: string[] = [];
        const sheetMethods: string[] = [];

        sheetSchemas.forEach(sheetSchema => {
            const sheetNameEnum = GeneratorUtil.getFirstEnum(sheetSchema, 'name');
            const sheetClassName = GeneratorUtil.sanitizeName(
                GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(sheetNameEnum)),
                'Sheet'
            );

            sheetSubtypes.push(`{\n\t\t\t\t\tvalue: ${sheetClassName},\n\t\t\t\t\tname: '${sheetNameEnum}'\n\t\t\t\t}`);
            sheetImports.push(`import { ${sheetClassName} } from '../sheets/${GeneratorUtil.toKebabCase(sheetNameEnum)}/${sheetClassName}.js';`);

            sheetMethods.push(`
    add${GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(sheetNameEnum))}(sheet: ${sheetClassName}): void {
        this.addSheet(sheet);
    }

    get${GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(sheetNameEnum))}(): ${sheetClassName} {
        return this.getSheet('${sheetNameEnum}') as ${sheetClassName};
    }`);
        });

        const workbookImports = `
import { Workbook, Sheet } from '@org-quicko/sheet';
import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import 'reflect-metadata';
${sheetImports.join('\n')}`.trim();

        const workbookClass = `${GeneratorUtil.AUTO_GEN_COMMENT}${workbookImports}

@Reflect.metadata('name', '${workbookNameEnum}')
export class ${workbookClassName} extends Workbook {
    @Expose()
    @ValidateNested({ each: true })
    @Type(() => Sheet, {
        keepDiscriminatorProperty: true,
        discriminator: {
            property: 'name',
            subTypes: [
                ${sheetSubtypes.join(',\n\t\t\t\t')}
            ],
        },
    })
    override sheets: Array<Sheet> = new Array<Sheet>();
    
    constructor() {
        super();
        ${sheetSchemas
            .map(sheetSchema => {
                const sheetNameEnum = GeneratorUtil.getFirstEnum(sheetSchema, 'name');
                const sheetClassName = GeneratorUtil.sanitizeName(
                    GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(sheetNameEnum)),
                    'Sheet'
                );
                return `this.sheets.push(new ${sheetClassName}());`;
            })
            .join('\n        ')}
    }
    ${sheetMethods.join('\n')}
}
`.trim();

        FileUtil.write(path.join(workbookDir, `${workbookClassName}.ts`), workbookClass);
    }

}