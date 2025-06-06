import path from "path";
import { JsonSchema } from "../beans/JsonSchema";
import { FileUtil } from "./FileUtil";
import { GeneratorUtil } from "./GeneratorUtil";
import { ListGeneratorUtil } from "./ListGeneratorUtil";
import { SchemaRefResolverUtil } from "./SchemaRefResolverUtil";
import { TableGeneratorUtil } from "./TableGeneratorUtil";

export class SheetGeneratorUtil {
	public static generate(rootSchema: JsonSchema, sheet: JsonSchema, sheetsDir: string, tablesDir: string, listsDir: string, classNames: { sheet: string[]; table: string[]; list: string[]; row: string[] }): void {
		// First, resolve if `sheetSchema` is a $ref
		const sheetSchema = SchemaRefResolverUtil.resolveIfRef(sheet, rootSchema)!;

		let blocksSchema = sheetSchema.properties?.blocks;
		blocksSchema = SchemaRefResolverUtil.resolveIfRef(blocksSchema, rootSchema)!;
		if (!blocksSchema || blocksSchema.type !== "array") {
			throw new Error(`Invalid JSON Schema: "blocks" definition not found or malformed.`);
		}

		let blockItems = blocksSchema.items;
		blockItems = SchemaRefResolverUtil.resolveIfRef(blockItems, rootSchema)!;
		if (!blockItems) {
			throw new Error(`Invalid JSON Schema: "blocks.items" not found.`);
		}

		let blockOneOf = blockItems?.oneOf;
		blockOneOf = SchemaRefResolverUtil.resolveIfRef(blockOneOf, rootSchema)!;
		if (!Array.isArray(blockOneOf)) {
			throw new Error(`Invalid JSON Schema: "blocks.items.oneOf" not found or not an array.`);
		}

		const sheetNameEnum = GeneratorUtil.getFirstEnum(sheetSchema, "name");
		const sheetClassName = GeneratorUtil.sanitizeName(GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(sheetNameEnum)), "Sheet");

		// Keep track for mixin generation
		classNames.sheet.push(sheetClassName);

		const blocksSubtypes: string[] = [];
		const blocksImports: string[] = [];

		blockOneOf.forEach((block: JsonSchema) => {
			const isCommon = Boolean(block.$ref);

			const blockSchema = SchemaRefResolverUtil.resolveIfRef(block, rootSchema)!;
			const blockNameEnum = GeneratorUtil.getFirstEnum(blockSchema, "name");
			const blockEntityEnum = GeneratorUtil.getFirstEnum(blockSchema, "@entity");
			const blockClassName = GeneratorUtil.sanitizeName(GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(blockNameEnum)), blockEntityEnum === "list" ? "List" : "Table");

			blocksSubtypes.push(`{\n\t\t\t\t\tvalue: ${blockClassName},\n\t\t\t\t\tname: '${blockNameEnum}'\n\t\t\t\t}`);

			const importDir = (blockEntityEnum === "table" ? "tables" : "lists") + (isCommon ? "/common/" : "/");
			const importPath = `../../${importDir}${GeneratorUtil.toKebabCase(blockNameEnum)}/${blockClassName}`;
			blocksImports.push(`import { ${blockClassName} } from '${importPath}'`);

			if (blockEntityEnum === "table") {
				TableGeneratorUtil.generate(blockSchema, blockNameEnum, tablesDir, classNames, isCommon);
			} else if (blockEntityEnum === "list") {
				ListGeneratorUtil.generate(blockSchema, blockNameEnum, listsDir, classNames, isCommon);
			}
		});

		const sheetImportsInner = `
import { Sheet, Block } from '@org-quicko/sheet';
import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import 'reflect-metadata';
${blocksImports.join("\n")}`.trim();

		const sheetClassContent = `${GeneratorUtil.AUTO_GEN_COMMENT}${sheetImportsInner}

@Reflect.metadata('name', '${sheetNameEnum}')
export class ${sheetClassName} extends Sheet {
    @Expose()
    @ValidateNested({ each: true })
    @Type(() => Block, {
        keepDiscriminatorProperty: true,
        discriminator: {
            property: 'name',
            subTypes: [
                ${blocksSubtypes.join(",\n\t\t\t\t")}
            ],
        },
    })
    override blocks: Array<Block> = new Array<Block>();

    constructor() {
        super();
        ${blockOneOf
			.map((blockSchema: JsonSchema) => {
				const block = SchemaRefResolverUtil.resolveIfRef(blockSchema, rootSchema)!;
				const bName = GeneratorUtil.getFirstEnum(block, "name");
				const bEntity = GeneratorUtil.getFirstEnum(block, "@entity");
				const bClassName = GeneratorUtil.sanitizeName(GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(bName)), bEntity === "list" ? "List" : "Table");
				return `this.blocks.push(new ${bClassName}());`;
			})
			.join("\n        ")}
    }

    ${blockOneOf
		.map((blockSchema: JsonSchema) => {
			const block = SchemaRefResolverUtil.resolveIfRef(blockSchema, rootSchema)!;
			const bName = GeneratorUtil.getFirstEnum(block, "name");
			const bEntity = GeneratorUtil.getFirstEnum(block, "@entity");
			const bClassName = GeneratorUtil.sanitizeName(GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(bName)), bEntity === "list" ? "List" : "Table");

			return `
    add${GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(bName))}(${bEntity}: ${bClassName}): void {
        this.addBlock(${bEntity});
    }

    get${GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(bName))}(): ${bClassName} {
        return this.getBlock('${bName}') as ${bClassName};
    }`;
		})
		.join("\n")}
}
`.trim();

		FileUtil.write(path.join(sheetsDir, GeneratorUtil.toKebabCase(sheetNameEnum), `${sheetClassName}.ts`), sheetClassContent);
	}
}
