import path from 'path';
import { JsonSchema } from '../beans/JsonSchema.js';
import { FileUtil } from './FileUtil.js';
import { GeneratorUtil } from './GeneratorUtil.js';

export class TableGeneratorUtil {
    public static generate(
        blockSchema: JsonSchema,
        blockName: string,
        tablesDir: string,
        classNames: { table: string[], row: string[] },
        isCommon: boolean,
    ) {
        const blockClassName = GeneratorUtil.sanitizeName(
            GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(blockName)),
            'Table'
        );

        const headerItems = blockSchema.properties?.header?.items || [];
        const headerEnum = Array.isArray(headerItems)
            ? headerItems.map(item => item.enum?.[0])
            : [];

        const tableDirectoryName = GeneratorUtil.toKebabCase(blockName);
        const tableDirectory = isCommon
            ? path.join(tablesDir, 'common', tableDirectoryName)
            : path.join(tablesDir, tableDirectoryName);

        classNames.table.push(blockClassName);

        const rowClassName = blockClassName.replace(/Table$/, 'Row');

        const tableClass = `${GeneratorUtil.AUTO_GEN_COMMENT}import { JSONArray } from '@org-quicko/core';
import { Table } from '@org-quicko/sheet';
import 'reflect-metadata';
import { ${rowClassName} } from './${rowClassName}';

@Reflect.metadata('name', '${blockName}')
export class ${blockClassName} extends Table {
    private static header = new JSONArray(
        Array.from([
            ${headerEnum.map((h: string) => `'${h}'`).join(',\n\t\t\t')}
        ])
    );

    constructor() {
        super();
        super.setHeader(${blockClassName}.header);
    }

    override getRow(index: number): ${rowClassName} {
        return new ${rowClassName}(super.getRow(index));
    }

    override addRow(row: ${rowClassName}): void {
        super.addRow(row);
    }

    override replaceRow(index: number, row: ${rowClassName}): void {
        super.replaceRow(index, row);
    }
}`.trim();

        FileUtil.write(path.join(tableDirectory, `${blockClassName}.ts`), tableClass);

        classNames.row.push(rowClassName);


        // generate all getter/setter pairs
        const gettersSetters = headerEnum
            .map((header: string, index: number) => {
                const camelCaseHeader = GeneratorUtil.toCamelCase(header);
                const validVarName = /^[0-9]/.test(camelCaseHeader) ? `_${camelCaseHeader}` : camelCaseHeader;

                const type = GeneratorUtil.getTypeScriptType(blockSchema.properties?.rows?.items?.items?.[index]?.type);

                return `

    get${GeneratorUtil.capitalize(camelCaseHeader)}(): ${type} {
            
        return this[${index}] as ${type};
    }

    set${GeneratorUtil.capitalize(camelCaseHeader)}(${validVarName}: ${type}): void {
        this[${index}] = ${validVarName};
    }`;

            })
            .join('\n');

        let orgQuickoImports;
        if (gettersSetters.includes('JSONObject')) {
            orgQuickoImports = `import { JSONObject`;
        }
        if (gettersSetters.includes('JSONArray')) {
            orgQuickoImports = orgQuickoImports ? `${orgQuickoImports}, JSONArray` : `import { JSONArray`;
        }
        if (orgQuickoImports) {
            orgQuickoImports += ` } from '@org-quicko/core';\n`;
        }

        const rowClass = `${GeneratorUtil.AUTO_GEN_COMMENT}${orgQuickoImports || ''}import { Row } from '@org-quicko/sheet';

export class ${rowClassName} extends Row {
${gettersSetters}
}`.trim();

        FileUtil.write(path.join(tableDirectory, `${rowClassName}.ts`), rowClass);
    }
}