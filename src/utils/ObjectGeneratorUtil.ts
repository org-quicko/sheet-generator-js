import fs from "fs";
import path from "path";
import { JsonSchema } from "../beans/JsonSchema";
import { FileUtil } from "./FileUtil";
import { GeneratorUtil } from "./GeneratorUtil";
import { MixinGeneratorUtil } from "./MixinGeneratorUtil";
import { SheetGeneratorUtil } from "./SheetGeneratorUtil";
import { WorkbookGeneratorUtil } from "./WorkbookGeneratorUtil";
import { SchemaRefResolverUtil } from "./SchemaRefResolverUtil";

// --- Core Code-Generation Logic -----------------------------

/**
 * Given a JSON Schema that describes a "Workbook" object,
 * parse it to find all the Sheets and Blocks definitions.
 * Then generate TypeScript files for them, and also generate
 * "mixin" classes for each type.
 */
export class ObjectGeneratorUtil {
	/**
	 * Generate TypeScript classes and mixins from a JSON Schema.
	 * @param schema - The JSON Schema to generate classes from.
	 * @param outputDir - The directory to output the generated files to.
	 */
	public static generate(schema: JsonSchema, outputDir: string): void {
		// Create class name tracking objects for this generation run
		const classNames = {
			workbook: [] as string[],
			sheet: [] as string[],
			table: [] as string[],
			list: [] as string[],
			row: [] as string[],
		};

		// Create output folders if needed
		const baseDir = outputDir;
		const workbookDir = path.join(baseDir, "workbook");
		const sheetsDir = path.join(baseDir, "sheets");
		const tablesDir = path.join(baseDir, "tables");
		const listsDir = path.join(baseDir, "lists");
		const mixinsDir = path.join(baseDir, "mixins");

		// Create all directories
		[baseDir, workbookDir, sheetsDir, tablesDir, listsDir, mixinsDir].forEach((dir) => FileUtil.mkdir(dir));

		// Read the "sheets" schema definition
		const sheetsSchema = schema.properties?.sheets;
		if (!sheetsSchema || sheetsSchema.type !== "array" || !sheetsSchema.items) {
			throw new Error(`Invalid JSON Schema: "sheets" definition not found or malformed.`);
		}

		// Handle multiple sheet types if items is oneOf
		const sheetSchemas = sheetsSchema.items.oneOf || [sheetsSchema.items];

		// Generate workbook class with all sheet types
		WorkbookGeneratorUtil.generate(schema, sheetSchemas, workbookDir, classNames);

		// Generate sheet classes for each sheet type
		sheetSchemas.forEach((sheetSchema) => SheetGeneratorUtil.generate(schema, sheetSchema, sheetsDir, tablesDir, listsDir, classNames));

		    const commonBlocks = new Set<string>();

		    sheetSchemas.forEach(sheet => {
		        const sheetSchema = SchemaRefResolverUtil.resolveIfRef(sheet, schema)!;

		        let blocksSchema = sheetSchema.properties?.blocks;
		        blocksSchema = SchemaRefResolverUtil.resolveIfRef(blocksSchema, schema)!;
		        if (!blocksSchema || blocksSchema.type !== 'array') {
		            throw new Error(`Invalid JSON Schema: "blocks" definition not found or malformed.`);
		        }

		        let blockItems = blocksSchema.items;
		        blockItems = SchemaRefResolverUtil.resolveIfRef(blockItems, schema)!;
		        if (!blockItems) {
		                    throw new Error(`Invalid JSON Schema: "blocks.items" not found.`);
		                }

		                let blockOneOf = blockItems?.oneOf;
		                blockOneOf = SchemaRefResolverUtil.resolveIfRef(blockOneOf, schema)!;
		                if (!Array.isArray(blockOneOf)) {
		                    throw new Error(`Invalid JSON Schema: "blocks.items.oneOf" not found or not an array.`);
		                }

		        blockOneOf.forEach((block: JsonSchema) => {
		          if (Boolean(block.$ref)) {
		            const blockSchema = SchemaRefResolverUtil.resolveIfRef(block, schema)!;
		        const blockNameEnum = GeneratorUtil.getFirstEnum(blockSchema, 'name');
		        const blockEntityEnum = GeneratorUtil.getFirstEnum(blockSchema, '@entity');
		        const blockClassName = GeneratorUtil.sanitizeName(
		            GeneratorUtil.capitalize(GeneratorUtil.toCamelCase(blockNameEnum)),
		            blockEntityEnum === 'list' ? 'List' : 'Table'
		        );
		        commonBlocks.add(blockClassName);
		      }
		    });
		  });

		// Generate mixin classes (one per type)
		MixinGeneratorUtil.generate(mixinsDir, classNames, commonBlocks);

		// Generate index file
		this.generateIndexFile(baseDir, [
			{ folderPath: workbookDir, importPath: "./workbook" },
			{ folderPath: sheetsDir, importPath: "./sheets" },
			{ folderPath: tablesDir, importPath: "./tables" },
			{ folderPath: listsDir, importPath: "./lists" },
			{ folderPath: mixinsDir, importPath: "./mixins" },
		]);
	}

	/**
	 * Generate an index file in the base directory that re-exports all generated classes
	 * from the subdirectories (workbook, sheets, tables, lists, rows, mixins).
	 */
	private static generateIndexFile(baseDir: string, subfolders: { folderPath: string; importPath: string }[]): void {
		try {
			const exportsMap = new Map<string, string>();
			const indexContent = [GeneratorUtil.AUTO_GEN_COMMENT];

			for (const { folderPath, importPath } of subfolders) {
				// Validate subfolder entries
				if (typeof folderPath !== "string" || typeof importPath !== "string") {
					throw new TypeError("Invalid subfolder entry: folderPath and importPath must be strings");
				}

				// Resolve and validate folder path
				const resolvedFolderPath = path.resolve(folderPath);
				if (!fs.existsSync(resolvedFolderPath)) {
					// Skipping non-existent directory
					continue;
				}

				try {
					// Get all files with safety checks
					const files = FileUtil.getAllFiles(resolvedFolderPath).filter((file) => {
						const isValidExtension = file.endsWith(".ts");
						const isIndexFile = file.includes("index.ts");
						const isWithinAllowedPath = file.startsWith(resolvedFolderPath);

						if (!isWithinAllowedPath) {
							// Skipping file outside allowed directory
							return false;
						}

						return isValidExtension && !isIndexFile;
					});

					// Process files and collect exports
					for (const file of files) {
						const relativePath = path.relative(resolvedFolderPath, file);
						const normalizedPath = path.posix.normalize(relativePath).replace(/\\/g, "/").replace(/\.ts$/, "");

						const fullImport = `${importPath}/${normalizedPath}`;
						const exportStatement = `export * from '${fullImport}';`;

						// Deduplicate exports
						if (!exportsMap.has(fullImport)) {
							exportsMap.set(fullImport, exportStatement);
							indexContent.push(exportStatement);
						}
					}
				} catch (error) {
					throw new Error(`Failed to process directory ${resolvedFolderPath}: ${(error as Error).message}`);
				}
			}

			// Sort exports alphabetically for consistency
			indexContent.sort((a, b) => a.localeCompare(b));

			// Add newline at end of file
			indexContent.push("");

			// Write index file with improved FileUtil.write
			const indexPath = path.join(baseDir, "index.ts");
			FileUtil.write(indexPath, indexContent.join("\n"));
		} catch (error) {
			throw new Error(`Index generation failed: ${(error as Error).message}`);
		}
	}
}
