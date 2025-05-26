import path from 'path';
import { FileUtil } from './FileUtil.js';
import { GeneratorUtil } from './GeneratorUtil.js';

export class MixinGeneratorUtil {
    public static generate(mixinsDir: string, classNames: { workbook: string[], sheet: string[], table: string[], list: string[], row: string[] }): void {
        // Generate each mixin file
        this.generateMixin(classNames.workbook, 'workbook', 'WorkbookMixin.ts', mixinsDir);
        this.generateMixin(classNames.sheet, 'sheet', 'SheetMixin.ts', mixinsDir);
        this.generateMixin(classNames.table, 'table', 'TableMixin.ts', mixinsDir);
        this.generateMixin(classNames.list, 'list', 'ListMixin.ts', mixinsDir);
        this.generateMixin(classNames.row, 'row', 'RowMixin.ts', mixinsDir);
    }

    private static generateMixin(names: string[], entityType: string, fileName: string, mixinsDir: string): void {
        if (names.length === 0) return;

        const imports = new Set<string>();
        names.forEach(className => {
            imports.add(`import { ${className} } from '..';`);
        });

        const content = `${GeneratorUtil.AUTO_GEN_COMMENT}import 'reflect-metadata';
${Array.from(imports).join('\n')}

@Reflect.metadata('@entity', '${entityType}')
@Reflect.metadata('subtypes', [${names.map(c => `() => ${c}`).join(', ')}])
export abstract class ${GeneratorUtil.capitalize(entityType)}Mixin { }
`;

        FileUtil.write(path.join(mixinsDir, fileName), content);
    }
}