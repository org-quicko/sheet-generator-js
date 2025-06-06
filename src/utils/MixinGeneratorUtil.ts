import path from 'path';
import { FileUtil } from './FileUtil';
import { GeneratorUtil } from './GeneratorUtil';

export class MixinGeneratorUtil {
    public static generate(mixinsDir: string, classNames: { workbook: string[], sheet: string[], table: string[], list: string[], row: string[] }, commonBlocks: Set<string>): void {
        // Generate each mixin file
        this.generateMixin(classNames.workbook, 'workbook', 'WorkbookMixin.ts', mixinsDir);
        this.generateMixin(classNames.sheet, 'sheet', 'SheetMixin.ts', mixinsDir);
        this.generateMixin(classNames.table, 'table', 'TableMixin.ts', mixinsDir, commonBlocks);
        this.generateMixin(classNames.list, 'list', 'ListMixin.ts', mixinsDir, commonBlocks);
        this.generateMixin(classNames.row, 'row', 'RowMixin.ts', mixinsDir, commonBlocks);
    }

    private static generateMixin(names: string[], entityType: string, fileName: string, mixinsDir: string, commonBlocks?: Set<string>): void {
        if (names.length === 0) return;

        const imports = new Set<string>();
        names.forEach(className => {
            if(entityType === 'workbook'){
                imports.add(`import { ${className} } from '../workbook/${className}';`);
            }else if(entityType === 'sheet'){
                imports.add(`import { ${className} } from '../sheets/${GeneratorUtil.toKebabCase(className)}/${className}';`);
            }else if(entityType === 'table'){
                if (commonBlocks?.has(className)) {
                    imports.add(`import { ${className} } from '../tables/common/${GeneratorUtil.toKebabCase(className)}/${className}';`);
                } else {
                    imports.add(`import { ${className} } from '../tables/${GeneratorUtil.toKebabCase(className)}/${className}';`);
                }
            }else if(entityType === 'list'){
                if (commonBlocks?.has(className)) {
                    imports.add(`import { ${className} } from '../lists/common/${GeneratorUtil.toKebabCase(className)}/${className}';`);
                } else {
                    imports.add(`import { ${className} } from '../lists/${GeneratorUtil.toKebabCase(className)}/${className}';`);
                }
            }else if(entityType === 'row'){
                 if(commonBlocks?.has(className.replace(/Row/, 'Table'))) {
                    imports.add(`import { ${className} } from '../tables/common/${GeneratorUtil.toKebabCase(className).replace(/row/, 'table')}/${className}';`);
                } else {
                    imports.add(`import { ${className} } from '../tables/${GeneratorUtil.toKebabCase(className).replace(/row/, 'table')}/${className}';`);
                }
            }
        });

        const content = `${GeneratorUtil.AUTO_GEN_COMMENT}import 'reflect-metadata';
${Array.from(imports).join('\n')}

@Reflect.metadata('@entity', '${entityType}')
@Reflect.metadata('subtypes', [${Array.from(new Set(names)).map(c => `() => ${c}`).join(', ')}])
export abstract class ${GeneratorUtil.capitalize(entityType)}Mixin { }
`;

        FileUtil.write(path.join(mixinsDir, fileName), content);
    }
}