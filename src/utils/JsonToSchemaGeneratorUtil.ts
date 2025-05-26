/* eslint-disable @typescript-eslint/no-explicit-any */

import { Block } from '../beans/Block.js';
import { Workbook } from '../beans/Workbook.js';

/**
 * Utility class for generating JSON schemas from workbook data
 */
export class JsonToSchemaGeneratorUtil {
    /**
     * Takes a workbook object and produces a JSON Schema that uses `oneOf` for each
     * block definition. It supports blocks of @entity = "table" or "list".
     * @param data The workbook data to generate schema from
     * @returns Generated JSON schema as a Record
     */
    public static generate(data: Workbook): Record<string, any> {
        // Basic validations
        if (!data || !data.sheets || !data.sheets.length) {
            throw new Error('Invalid data: No sheets found.');
        }

        // Process all sheets
        const sheetSchemas = data.sheets.map(sheet => {
            if (!sheet.blocks || !sheet.blocks.length) {
                throw new Error(`Invalid data: No blocks found in sheet "${sheet.name}".`);
            }

            // Build a oneOf array for all blocks in this sheet
            const blocksOneOf: Array<Record<string, any>> = [];

            for (const block of sheet.blocks) {
                const blockName = block.name;
                const blockEntity = block['@entity'];

                if (blockEntity === 'table') {
                    this.handleTableBlock(block, blockName, blocksOneOf);
                }
                else if (blockEntity === 'list') {
                    this.handleListBlock(block, blockName, blocksOneOf);
                }
            }

            return {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        enum: [sheet.name],
                    },
                    '@entity': {
                        type: 'string',
                        enum: [sheet['@entity']],
                    },
                    blocks: {
                        type: 'array',
                        items: {
                            oneOf: blocksOneOf,
                        },
                    },
                },
                required: ['name', '@entity', 'blocks'],
            };
        });

        const schema: Record<string, any> = {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    enum: [data.name],
                },
                '@entity': {
                    type: 'string',
                    enum: [data['@entity']],
                },
                sheets: {
                    type: 'array',
                    items: {
                        oneOf: sheetSchemas
                    },
                },
            },
            required: ['name', '@entity', 'sheets'],
        };

        // Deduplicate common blocks across sheets
        const definitions = this.deduplicateBlocks(schema);
        if (Object.keys(definitions).length > 0) {
            schema.definitions = definitions;
        }

        return schema;
    }

    /**
     * Handles generation of schema for table blocks
     */
    private static handleTableBlock(block: Block, blockName: string, blocksOneOf: Array<Record<string, any>>): void {
        let columnTypes: Record<string, any>[] | undefined;
        if (block.header && block.header.length > 0) {
            columnTypes = block.header.map((_, colIndex) => {
                // Get all unique types for this column across all rows
                const uniqueTypes = new Set<string>();
                if (block.rows) {
                    for (const row of block.rows) {
                        const type = this.deriveJsonSchemaType(row![colIndex]);
                        if (type) {
                            uniqueTypes.add(type);
                        }
                    }
                }

                // Convert Set to array of types
                const types = Array.from(uniqueTypes);

                // If only one type, return simple schema
                if (types.length === 1) {
                    return { type: types[0] };
                }
                // If multiple types including null, return array of types
                if (types.length > 0) {
                    return { type: types };
                }
                // Fallback if no valid types found
                return { type: 'null' };
            });
        }

        const headerSize = block.header?.length ?? 0;

        blocksOneOf.push({
            type: 'object',
            properties: {
                name: { type: 'string', enum: [blockName] },
                '@entity': { type: 'string', enum: ['table'] },
                header: {
                    type: 'array',
                    items: block.header?.map(h => ({ type: 'string', enum: [h] })) ?? [],
                    additionalItems: false,
                    minItems: headerSize,
                    maxItems: headerSize
                },
                rows: {
                    type: 'array',
                    items: {
                        type: 'array',
                        items: columnTypes ?? [],
                        additionalItems: false,
                        minItems: headerSize,
                        maxItems: headerSize
                    },
                },
            },
            required: ['name', '@entity', 'header', 'rows'],
        });
    }

    /**
     * Handles generation of schema for list blocks
     */
    private static handleListBlock(block: Block, blockName: string, blocksOneOf: Array<Record<string, any>>): void {
        const properties: Record<string, any> = {};

        if (block.items && block.items.length > 0) {
            block.items.forEach((item) => {
                const [key, value] = Object.entries(item!)[0];
                properties[key] = { type: this.deriveJsonSchemaType(value) };
            });
        }

        blocksOneOf.push({
            type: 'object',
            properties: {
                name: { type: 'string', enum: [blockName] },
                '@entity': { type: 'string', enum: ['list'] },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties,
                        additionalProperties: false
                    }
                }
            },
            required: ['name', '@entity', 'items'],
        });
    }

    /**
     * A helper to guess the JSON Schema type from a sample cell value
     * @param value The value to derive type from
     * @returns JSON Schema type definition
     */
    private static deriveJsonSchemaType(value: any): string | null {
        if (value === null) {
            return 'null';
        }

        if (typeof value === 'boolean') {
            return 'boolean';
        }

        if (typeof value === 'number') {
            return 'number';
        }

        if (Array.isArray(value)) {
            return 'array';
        }

        if (typeof value === 'object') {
            return 'object';
        }

        return 'string';
    }

    /**
     * Deduplicates common block definitions across sheets and moves them to definitions
     */
    private static deduplicateBlocks(schema: Record<string, any>): Record<string, any> {
        // Map to store canonical JSON -> definition name
        const blockDefNames = new Map<string, string>();
        // Map to count occurrences of each block definition
        const definitionUsageCount = new Map<string, number>();

        // Find all block schemas
        const blockLocations = this.findAllBlockSchemas(schema);

        // Count occurrences of each block schema
        for (const loc of blockLocations) {
            const canonical = JSON.stringify(loc.blockSchema);
            definitionUsageCount.set(canonical, (definitionUsageCount.get(canonical) || 0) + 1);
        }

        // Create definitions for blocks that appear more than once
        const definitions: Record<string, any> = {};
        for (const [canonical, count] of definitionUsageCount.entries()) {
            if (count > 1) {
                const blockSchema = JSON.parse(canonical);
                const blockName = blockSchema.properties.name.enum[0];
                const hash = Math.abs(canonical.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)).toString();
                const defName = `${blockName}_${hash}`;
                blockDefNames.set(canonical, defName);
                definitions[defName] = blockSchema;
            }
        }

        // Replace repeated blocks with $refs
        for (const loc of blockLocations) {
            const canonical = JSON.stringify(loc.blockSchema);
            if (blockDefNames.has(canonical)) {
                const defName = blockDefNames.get(canonical)!;
                loc.blocksOneOf[loc.index] = { $ref: `#/definitions/${defName}` };
            }
        }

        return definitions;
    }

    /**
     * Helper to find all block schemas in the schema structure
     */
    private static findAllBlockSchemas(schema: Record<string, any>): Array<{ blocksOneOf: Array<Record<string, any>>, index: number, blockSchema: Record<string, any> }> {
        const results: Array<{ blocksOneOf: Array<Record<string, any>>, index: number, blockSchema: Record<string, any> }> = [];
        const sheets = schema.properties?.sheets?.items?.oneOf || [];

        for (const sheetSchema of sheets) {
            const blocksOneOf = sheetSchema.properties?.blocks?.items?.oneOf;
            if (Array.isArray(blocksOneOf)) {
                for (let i = 0; i < blocksOneOf.length; i += 1) {
                    results.push({
                        blocksOneOf,
                        index: i,
                        blockSchema: blocksOneOf[i]
                    });
                }
            }
        }

        return results;
    }
}
