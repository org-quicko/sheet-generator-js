import path from "path";
import { JsonSchema } from "../beans";
import { FileUtil } from "./FileUtil";
import { GeneratorUtil } from "./GeneratorUtil";

export class ListGeneratorUtil {
	public static generate(blockSchema: JsonSchema, blockName: string, listsDir: string, classNames: { list: string[] }, isCommon: boolean) {
		const listDirectoryName = GeneratorUtil.toKebabCase(blockName);
		const listDirectory = isCommon ? path.join(listsDir, "common", listDirectoryName) : path.join(listsDir, listDirectoryName);

		const className = GeneratorUtil.sanitizeName(GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(blockName)), "List");

		// Keep track for mixin generation
		classNames.list.push(className);

		// Get properties from schema
		const properties = blockSchema.properties?.items?.items?.properties;
		if (!properties) return;

		// Generate getters and setters for each property
		const gettersSetters = Object.entries(properties)
			.map(([key, value]: [string, any]) => {
				const camelKey = GeneratorUtil.toCamelCase(key);
				const validVarName = /^[0-9]/.test(camelKey) ? `_${camelKey}` : camelKey;
				const capitalizedKey = GeneratorUtil.capitalize(camelKey);
				const type = GeneratorUtil.getTypeScriptType(value.type);
				const nullable = type.includes("null");

				return `
                add${capitalizedKey}(${validVarName}: ${type}) {
                    super.addItem(new Item('${key}', ${nullable ? `${validVarName}!` : validVarName}));
                }
            
                valueOf${capitalizedKey}(): ${type} {
                    return super.getItem('${key}')?.getValue() as ${type};
                }`;
			})
			.join("\n");

		const listClass = `${GeneratorUtil.AUTO_GEN_COMMENT}import { Item, List } from '@org-quicko/sheet';

@Reflect.metadata('name', '${blockName}')
export class ${className} extends List {${gettersSetters}
}
`.trim();

		FileUtil.write(path.join(listDirectory, `${className}.ts`), listClass);
	}
}
